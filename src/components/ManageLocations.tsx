import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { Location, User } from '../types';
import { Trash2, Plus } from 'lucide-react';

export default function ManageLocations({ user }: { user: User }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'locations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Location[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Location);
      });
      setLocations(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'locations');
    });

    return () => unsubscribe();
  }, []);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'locations'), {
        name: newLocationName.trim(),
        createdBy: user.uid,
      });
      setNewLocationName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'locations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      try {
        await deleteDoc(doc(db, 'locations', locationId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `locations/${locationId}`);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full p-4 md:p-6">
      <div className="bg-[#242b3d] rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-6 border-b border-gray-700/50 bg-[#1a1f2e]">
          <h2 className="text-xl font-bold text-white tracking-wider">MANAGE LOCATIONS</h2>
          <p className="text-sm text-gray-400 mt-1">Add or remove cafe locations.</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleAddLocation} className="flex gap-3 mb-8">
            <input
              type="text"
              placeholder="e.g. Downtown Cafe"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              className="flex-1 bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newLocationName.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Location</span>
            </button>
          </form>

          <div className="space-y-3">
            {locations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No locations added yet.
              </div>
            ) : (
              locations.map((location) => (
                <div key={location.id} className="flex items-center justify-between bg-[#1a1f2e] p-4 rounded-lg border border-gray-700/50">
                  <span className="font-medium text-gray-200">{location.name}</span>
                  <button
                    onClick={() => handleDeleteLocation(location.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete location"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
