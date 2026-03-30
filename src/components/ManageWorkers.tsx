import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { Worker, User } from '../types';
import { Trash2, Plus, Link as LinkIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export const COLORS = [
  { name: 'Yellow', value: '#ffeb3b' },
  { name: 'Green', value: '#00e676' },
  { name: 'Orange', value: '#ff6d00' },
  { name: 'Purple', value: '#d500f9' },
  { name: 'Blue', value: '#2962ff' },
  { name: 'White', value: '#ffffff' },
];

export default function ManageWorkers({ user }: { user: User }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerColor, setNewWorkerColor] = useState(COLORS[0].value);
  const [newWorkerUserId, setNewWorkerUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const qUsers = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const fetched: User[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ ...doc.data() } as User);
      });
      setUsers(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeWorkers();
      unsubscribeUsers();
    };
  }, []);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'workers'), {
        name: newWorkerName.trim().toUpperCase(),
        defaultColor: newWorkerColor,
        createdBy: user.uid,
        userId: newWorkerUserId || null,
      });
      setNewWorkerName('');
      setNewWorkerColor(COLORS[0].value);
      setNewWorkerUserId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'workers');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (window.confirm('Are you sure you want to delete this worker?')) {
      try {
        await deleteDoc(doc(db, 'workers', workerId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `workers/${workerId}`);
      }
    }
  };

  const handleLinkUser = async (workerId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'workers', workerId), { userId: userId || null });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `workers/${workerId}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full p-4 md:p-6">
      <div className="bg-[#242b3d] rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-6 border-b border-gray-700/50 bg-[#1a1f2e]">
          <h2 className="text-xl font-bold text-white tracking-wider">MANAGE WORKERS</h2>
          <p className="text-sm text-gray-400 mt-1">Add or remove employees and their default colors.</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleAddWorker} className="flex flex-col md:flex-row gap-4 mb-8 items-end">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Worker Name</label>
              <input
                type="text"
                placeholder="e.g. SARA"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2 text-white uppercase focus:outline-none focus:border-blue-500 transition-colors placeholder:normal-case placeholder:text-gray-600"
              />
            </div>

            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Link App User (Optional)</label>
              <select
                value={newWorkerUserId}
                onChange={(e) => setNewWorkerUserId(e.target.value)}
                className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">-- No User Linked --</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full md:w-auto">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Default Color</label>
              <div className="flex gap-2 flex-wrap bg-[#1a1f2e] p-2 rounded-lg border border-gray-700 h-[42px] items-center">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewWorkerColor(c.value)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      newWorkerColor === c.value ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]" : "border-transparent opacity-70 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newWorkerName.trim()}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Worker</span>
            </button>
          </form>

          <div className="space-y-3">
            {workers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No workers added yet.
              </div>
            ) : (
              workers.map((worker) => (
                <div key={worker.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#1a1f2e] p-4 rounded-lg border border-gray-700/50 gap-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-4 h-4 rounded-full shadow-sm" 
                      style={{ backgroundColor: worker.defaultColor || '#ffffff' }}
                    />
                    <span className="font-medium text-gray-200 uppercase tracking-wider">{worker.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <LinkIcon size={14} className="text-gray-500" />
                      <select
                        value={worker.userId || ''}
                        onChange={(e) => handleLinkUser(worker.id, e.target.value)}
                        className="bg-[#242b3d] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- No User Linked --</option>
                        {users.map(u => (
                          <option key={u.uid} value={u.uid}>{u.name || u.email}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleDeleteWorker(worker.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete worker"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
