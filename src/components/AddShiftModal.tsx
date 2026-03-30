import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { User, Worker } from '../types';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { COLORS } from './ManageWorkers';

interface AddShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  period: 'AM' | 'PM';
  user: User;
  locationId: string;
  workers: Worker[];
  myWorker?: Worker;
}

export default function AddShiftModal({ isOpen, onClose, date, period, user, locationId, workers, myWorker }: AddShiftModalProps) {
  const isManager = user.role === 'manager' || user.role === 'boss';
  
  const [startTime, setStartTime] = useState(period === 'AM' ? '06:00' : '14:00');
  const [endTime, setEndTime] = useState(period === 'AM' ? '14:00' : '22:00');
  const [selectedWorkerId, setSelectedWorkerId] = useState(isManager ? '' : (myWorker?.id || ''));
  const [color, setColor] = useState(isManager ? COLORS[0].value : (myWorker?.defaultColor || COLORS[0].value));
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) return;

    const worker = workers.find(w => w.id === selectedWorkerId);
    if (!worker) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'shifts'), {
        date: format(date, 'yyyy-MM-dd'),
        startTime,
        endTime,
        employeeName: worker.name,
        workerId: worker.id,
        locationId,
        color,
        period,
        createdBy: user.uid,
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shifts');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#242b3d] rounded-xl shadow-2xl w-full max-w-md border border-gray-700/50 overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-700/50 bg-[#1a1f2e]">
          <h3 className="text-lg font-bold text-white tracking-wider">
            ADD SHIFT - {format(date, 'MMM d, yyyy')} ({period})
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Employee</label>
            <select
              required
              value={selectedWorkerId}
              onChange={(e) => {
                setSelectedWorkerId(e.target.value);
                const worker = workers.find(w => w.id === e.target.value);
                if (worker && worker.defaultColor) {
                  setColor(worker.defaultColor);
                }
              }}
              disabled={!isManager}
              className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-white uppercase focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>Select a worker</option>
              {workers.map(worker => (
                <option key={worker.id} value={worker.id}>{worker.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    color === c.value ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold text-gray-300 hover:bg-gray-800 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'SAVING...' : 'SAVE SHIFT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
