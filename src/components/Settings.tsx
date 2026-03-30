import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { User, Role } from '../types';
import { Shield } from 'lucide-react';

export default function Settings({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: User[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ ...doc.data() } as User);
      });
      setUsers(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-6">
      <div className="bg-[#242b3d] rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-6 border-b border-gray-700/50 bg-[#1a1f2e]">
          <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
            <Shield className="text-blue-400" />
            APP SETTINGS & PERMISSIONS
          </h2>
          <p className="text-sm text-gray-400 mt-1">Manage user roles and access levels.</p>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-700/50 text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-3 font-bold">Name</th>
                  <th className="pb-3 font-bold">Email</th>
                  <th className="pb-3 font-bold">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {users.map(user => (
                  <tr key={user.uid} className="text-sm">
                    <td className="py-4 text-gray-200">{user.name || 'N/A'}</td>
                    <td className="py-4 text-gray-400">{user.email}</td>
                    <td className="py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.uid, e.target.value as Role)}
                        disabled={user.uid === currentUser.uid}
                        className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="boss">Boss</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
