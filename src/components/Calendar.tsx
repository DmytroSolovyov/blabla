import React, { useState, useEffect, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc, addDoc, where } from 'firebase/firestore';
import { Shift, User, Worker } from '../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Copy } from 'lucide-react';
import { cn } from '../lib/utils';
import AddShiftModal from './AddShiftModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const DAYS_OF_WEEK = ['PON', 'TOR', 'SRE', 'ČET', 'PET', 'SOB', 'NED'];

export default function Calendar({ user, locationId }: { user: User, locationId: string }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  const isManager = user.role === 'manager' || user.role === 'boss';
  const myWorker = workers.find(w => w.userId === user.uid);
  const canEditAny = isManager;
  const canEditOwn = !!myWorker;

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

    // Fetch shifts for the current month
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    
    // We fetch a bit more to cover the visible grid
    const gridStart = startOfWeek(start, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(end, { weekStartsOn: 1 });

    const q = query(
      collection(db, 'shifts'),
      where('date', '>=', format(gridStart, 'yyyy-MM-dd')),
      where('date', '<=', format(gridEnd, 'yyyy-MM-dd')),
      where('locationId', '==', locationId)
    );

    const unsubscribeShifts = onSnapshot(q, (snapshot) => {
      const fetchedShifts: Shift[] = [];
      snapshot.forEach((doc) => {
        fetchedShifts.push({ id: doc.id, ...doc.data() } as Shift);
      });
      setShifts(fetchedShifts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    return () => {
      unsubscribeShifts();
      unsubscribeWorkers();
    };
  }, [currentDate, locationId]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleAddShiftClick = (date: Date, period: 'AM' | 'PM') => {
    if (!canEditAny && !canEditOwn) return;
    setSelectedDate(date);
    setSelectedPeriod(period);
    setIsModalOpen(true);
  };

  const handleDeleteShift = async (e: React.MouseEvent, shift: Shift) => {
    e.stopPropagation();
    const canDelete = isManager || (myWorker && shift.workerId === myWorker.id);
    if (!canDelete) return;
    
    if (window.confirm('Are you sure you want to delete this shift?')) {
      try {
        await deleteDoc(doc(db, 'shifts', shift.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `shifts/${shift.id}`);
      }
    }
  };

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Dropped outside a valid droppable area
    if (!destination) return;

    // Dropped in the same place
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Find the shift being dragged
    const draggedShift = shifts.find(s => s.id === draggableId);
    if (!draggedShift) return;

    const canDrag = isManager || (myWorker && draggedShift.workerId === myWorker.id);
    if (!canDrag) return;

    // Parse destination droppableId (format: "YYYY-MM-DD-AM" or "YYYY-MM-DD-PM")
    const [destYear, destMonth, destDay, destPeriod] = destination.droppableId.split('-');
    const destDateString = `${destYear}-${destMonth}-${destDay}`;

    try {
      // Create a copy of the shift for the new date/period
      const newShiftData = {
        date: destDateString,
        period: destPeriod as 'AM' | 'PM',
        employeeName: draggedShift.employeeName,
        startTime: draggedShift.startTime,
        endTime: draggedShift.endTime,
        color: draggedShift.color,
        locationId: draggedShift.locationId,
        ...(draggedShift.workerId ? { workerId: draggedShift.workerId } : {}),
        createdBy: user.uid,
      };

      await addDoc(collection(db, 'shifts'), newShiftData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shifts');
    }
  }, [shifts, isManager, myWorker]);

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        const dateString = format(cloneDay, 'yyyy-MM-dd');
        
        const dayShifts = shifts.filter(s => s.date === dateString);
        const amShifts = dayShifts.filter(s => s.period === 'AM').sort((a, b) => a.startTime.localeCompare(b.startTime));
        const pmShifts = dayShifts.filter(s => s.period === 'PM').sort((a, b) => a.startTime.localeCompare(b.startTime));

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "flex flex-col border-r border-b border-gray-700/50 min-h-[160px] relative transition-colors",
              !isSameMonth(day, monthStart) ? "bg-[#1a1f2e]/50 text-gray-600" : "bg-[#242b3d] text-gray-300",
            )}
          >
            {/* Date Number */}
            <div className="absolute top-1 right-2 text-xs font-bold text-gray-500 z-10">
              {formattedDate}
            </div>

            {/* AM Section */}
            <Droppable droppableId={`${dateString}-AM`} isDropDisabled={!canEditAny && !canEditOwn}>
              {(provided, snapshot) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-1 p-1 flex flex-col gap-1 relative group", 
                    (canEditAny || canEditOwn) && "cursor-pointer hover:bg-white/5",
                    snapshot.isDraggingOver && "bg-blue-500/10 ring-1 ring-inset ring-blue-500/50"
                  )}
                  onClick={() => handleAddShiftClick(cloneDay, 'AM')}
                >
                  <div className="absolute bottom-0 right-1 text-[10px] text-gray-600 font-mono opacity-50">AM</div>
                  {(canEditAny || canEditOwn) && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"><Plus size={24} className="text-white/20" /></div>}
                  
                  <div className="z-10 flex flex-col gap-1 mt-4 min-h-[24px]">
                    {amShifts.map((shift, index) => {
                      const canEditThisShift = isManager || (myWorker && shift.workerId === myWorker.id);
                      return (
                      // @ts-expect-error - React 19 types issue with @hello-pangea/dnd
                      <Draggable key={shift.id} draggableId={shift.id} index={index} isDragDisabled={!canEditThisShift}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                            }}
                          >
                            <ShiftBlock shift={shift} onDelete={(e) => handleDeleteShift(e, shift)} canEdit={canEditThisShift} isDragging={snapshot.isDragging} />
                          </div>
                        )}
                      </Draggable>
                    )})}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>

            {/* Divider */}
            <div className="h-px bg-gray-700/50 border-t border-dashed border-gray-600 mx-2"></div>

            {/* PM Section */}
            <Droppable droppableId={`${dateString}-PM`} isDropDisabled={!canEditAny && !canEditOwn}>
              {(provided, snapshot) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-1 p-1 flex flex-col gap-1 relative group", 
                    (canEditAny || canEditOwn) && "cursor-pointer hover:bg-white/5",
                    snapshot.isDraggingOver && "bg-blue-500/10 ring-1 ring-inset ring-blue-500/50"
                  )}
                  onClick={() => handleAddShiftClick(cloneDay, 'PM')}
                >
                  <div className="absolute bottom-0 right-1 text-[10px] text-gray-600 font-mono opacity-50">PM</div>
                  {(canEditAny || canEditOwn) && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"><Plus size={24} className="text-white/20" /></div>}
                  
                  <div className="z-10 flex flex-col gap-1 min-h-[24px]">
                    {pmShifts.map((shift, index) => {
                      const canEditThisShift = isManager || (myWorker && shift.workerId === myWorker.id);
                      return (
                      // @ts-expect-error - React 19 types issue with @hello-pangea/dnd
                      <Draggable key={shift.id} draggableId={shift.id} index={index} isDragDisabled={!canEditThisShift}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                            }}
                          >
                            <ShiftBlock shift={shift} onDelete={(e) => handleDeleteShift(e, shift)} canEdit={canEditThisShift} isDragging={snapshot.isDragging} />
                          </div>
                        )}
                      </Draggable>
                    )})}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 flex-1" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="flex flex-col flex-1 border-l border-t border-gray-700/50">{rows}</div>;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-center py-4 mb-2 relative max-w-7xl mx-auto w-full px-4">
        <button onClick={prevMonth} className="absolute left-4 p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-blue-400 uppercase tracking-widest text-center">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <button onClick={nextMonth} className="absolute right-4 p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Responsive Calendar Container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto bg-[#1a1f2e]">
        <div className="min-w-[800px] max-w-7xl mx-auto flex flex-col h-full p-4 pt-0">
          {/* Days of week */}
          <div className="grid grid-cols-7 bg-[#2a324a] rounded-t-lg overflow-hidden border border-gray-700/50 border-b-0">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="py-3 text-center text-sm font-bold text-gray-300 tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex-1 flex flex-col bg-[#1a1f2e] rounded-b-lg overflow-hidden shadow-2xl">
              {renderCells()}
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* Add Shift Modal */}
      {isModalOpen && selectedDate && (
        <AddShiftModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          date={selectedDate}
          period={selectedPeriod}
          user={user}
          locationId={locationId}
          workers={workers}
          myWorker={myWorker}
        />
      )}
    </div>
  );
}

function ShiftBlock({ shift, onDelete, canEdit, isDragging }: { key?: string | number, shift: Shift, onDelete: (e: React.MouseEvent) => void, canEdit: boolean, isDragging?: boolean }) {
  // Determine text color based on background color brightness
  // For simplicity, we'll use black text for most bright colors, white for dark ones.
  // The image shows black text for yellow, green, orange, white, and white text for purple, blue.
  const isDarkBg = ['#d500f9', '#2962ff'].includes(shift.color.toLowerCase());
  
  return (
    <div 
      className={cn(
        "flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm relative group/block",
        isDarkBg ? "text-white" : "text-black",
        isDragging && "shadow-lg scale-105 z-50 cursor-grabbing"
      )}
      style={{ backgroundColor: shift.color }}
    >
      <div className="truncate flex-1">
        <span className="mr-1">{shift.startTime} - {shift.endTime}</span>
        <span className="uppercase">{shift.employeeName}</span>
      </div>
      
      {isDragging && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-0.5 shadow-md">
           <Copy size={10} />
        </div>
      )}

      {canEdit && !isDragging && (
        <button 
          onClick={onDelete}
          className="ml-1 opacity-0 group-hover/block:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10"
        >
          <X size={10} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
