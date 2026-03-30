import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Shift, User, Worker } from '../types';
import { format, startOfMonth, endOfMonth, parse, differenceInMinutes, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Reports({ user }: { user: User }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const isManager = user.role === 'manager' || user.role === 'boss';
  const myWorker = workers.find(w => w.userId === user.uid);

  useEffect(() => {
    const qWorkers = query(collection(db, 'workers'));
    const unsubscribeWorkers = onSnapshot(qWorkers, (snapshot) => {
      const fetched: Worker[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Worker);
      });
      setWorkers(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workers');
    });

    return () => unsubscribeWorkers();
  }, []);

  useEffect(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);

    const qShifts = query(
      collection(db, 'shifts'),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );

    const unsubscribeShifts = onSnapshot(qShifts, (snapshot) => {
      const fetched: Shift[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Shift);
      });
      setShifts(fetched);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
      setLoading(false);
    });

    return () => unsubscribeShifts();
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Calculate hours
  const calculateHours = (startTime: string, endTime: string) => {
    try {
      const start = parse(startTime, 'HH:mm', new Date());
      let end = parse(endTime, 'HH:mm', new Date());
      
      // Handle overnight shifts
      if (end < start) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
      
      const diffMinutes = differenceInMinutes(end, start);
      return diffMinutes / 60;
    } catch (e) {
      return 0;
    }
  };

  const reportData = useMemo(() => {
    const data: Record<string, { worker: Worker | null, totalHours: number, shiftCount: number }> = {};
    
    shifts.forEach(shift => {
      // If employee, only process their own shifts
      if (!isManager && myWorker && shift.workerId !== myWorker.id) {
        return;
      }
      
      const workerId = shift.workerId || 'unknown';
      if (!data[workerId]) {
        data[workerId] = {
          worker: workers.find(w => w.id === workerId) || null,
          totalHours: 0,
          shiftCount: 0
        };
      }
      
      data[workerId].totalHours += calculateHours(shift.startTime, shift.endTime);
      data[workerId].shiftCount += 1;
    });

    return Object.values(data).sort((a, b) => b.totalHours - a.totalHours);
  }, [shifts, workers, isManager, myWorker]);

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading reports...</div>;
  }

  if (!isManager && !myWorker) {
    return (
      <div className="p-8 text-center text-gray-400">
        <Clock size={48} className="mx-auto mb-4 opacity-50" />
        <p>Your account is not linked to any worker profile.</p>
        <p className="text-sm mt-2">Please contact your manager to link your account.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-6">
      <div className="bg-[#242b3d] rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-6 border-b border-gray-700/50 bg-[#1a1f2e] flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
              <Clock className="text-blue-400" />
              HOURS REPORT
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {isManager ? 'View total hours for all employees.' : 'View your total hours worked.'}
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-[#242b3d] rounded-lg p-1 border border-gray-700">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-blue-400 uppercase tracking-widest min-w-[120px] text-center">
              {format(currentDate, 'MMM yyyy')}
            </span>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {reportData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock size={48} className="mx-auto mb-4 opacity-20" />
              <p>No shifts recorded for this month.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reportData.map((data, idx) => (
                <div key={idx} className="bg-[#1a1f2e] p-5 rounded-xl border border-gray-700/50 flex flex-col gap-3 relative overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 w-1 h-full"
                    style={{ backgroundColor: data.worker?.defaultColor || '#3b82f6' }}
                  />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border border-gray-700">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-200 uppercase tracking-wider">
                        {data.worker ? data.worker.name : 'Unknown Worker'}
                      </h3>
                      <p className="text-xs text-gray-500">{data.shiftCount} shifts</p>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-end justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Hours</span>
                      <span className="text-3xl font-light text-white">
                        {data.totalHours.toFixed(1)}<span className="text-lg text-gray-500 ml-1">h</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
