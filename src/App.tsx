import { useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { Role, User, Location } from './types';
import Calendar from './components/Calendar';
import ManageLocations from './components/ManageLocations';
import ManageWorkers from './components/ManageWorkers';
import Settings from './components/Settings';
import Reports from './components/Reports';
import { LogOut, Calendar as CalendarIcon, Users, MapPin, Menu, X, Settings as SettingsIcon, Clock } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'calendar' | 'workers' | 'locations' | 'settings' | 'reports'>('calendar');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setUser(userSnap.data() as User);
          } else {
            // Create new user
            const isDefaultAdmin = firebaseUser.email === 'dmytro.solovyov1998@gmail.com' && firebaseUser.emailVerified;
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: isDefaultAdmin ? 'boss' : 'employee',
              name: firebaseUser.displayName || '',
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const q = query(collection(db, 'locations'));
    const unsubscribeLocations = onSnapshot(q, (snapshot) => {
      const fetched: Location[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Location);
      });
      setLocations(fetched);
      if (fetched.length > 0 && !selectedLocationId) {
        setSelectedLocationId(fetched[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'locations');
    });

    return () => {
      unsubscribe();
      unsubscribeLocations();
    };
  }, [selectedLocationId]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1f2e] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-4xl font-bold mb-8 text-blue-400 tracking-wider">BELLACAFFE</h1>
        <p className="text-gray-400 mb-8 text-center max-w-md">
          Welcome to the shift manager. Please sign in to view or manage the schedule.
        </p>
        <button
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  const canManage = user.role === 'manager' || user.role === 'boss';

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white flex flex-col font-sans">
      <header className="bg-[#242b3d] border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto w-full px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-blue-400 tracking-widest truncate">BELLACAFFE</h1>
            <span className="hidden sm:inline-block text-xs font-bold text-gray-400 bg-gray-800 px-2 py-1 rounded uppercase">
              {user.role}
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex bg-[#1a1f2e] rounded-lg p-1 border border-gray-700/50">
              <button
                onClick={() => setCurrentTab('calendar')}
                className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", currentTab === 'calendar' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
              >
                <CalendarIcon size={16} /> Calendar
              </button>
              <button
                onClick={() => setCurrentTab('reports')}
                className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", currentTab === 'reports' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
              >
                <Clock size={16} /> Hours
              </button>
              {canManage && (
                <>
                  <button
                    onClick={() => setCurrentTab('workers')}
                    className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", currentTab === 'workers' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                  >
                    <Users size={16} /> Workers
                  </button>
                  <button
                    onClick={() => setCurrentTab('locations')}
                    className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", currentTab === 'locations' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                  >
                    <MapPin size={16} /> Locations
                  </button>
                  <button
                    onClick={() => setCurrentTab('settings')}
                    className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", currentTab === 'settings' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                  >
                    <SettingsIcon size={16} /> Settings
                  </button>
                </>
              )}
            </div>

            {currentTab === 'calendar' && locations.length > 0 && (
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-3 border-l border-gray-700 pl-6">
              <span className="text-sm text-gray-300 hidden lg:inline-block">{user.name || user.email}</span>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                title="Sign out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            {currentTab === 'calendar' && locations.length > 0 && (
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer max-w-[120px] truncate"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-white"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#242b3d] border-t border-gray-800 px-4 py-4 flex flex-col gap-4 shadow-xl absolute w-full z-50">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-800">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {(user.name || user.email)[0].toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">{user.name || user.email}</span>
                <span className="text-xs text-gray-400 uppercase">{user.role}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setCurrentTab('calendar'); setIsMobileMenuOpen(false); }}
                className={cn("px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3", currentTab === 'calendar' ? "bg-blue-600/20 text-blue-400" : "text-gray-300 hover:bg-gray-800")}
              >
                <CalendarIcon size={18} /> Calendar View
              </button>
              <button
                onClick={() => { setCurrentTab('reports'); setIsMobileMenuOpen(false); }}
                className={cn("px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3", currentTab === 'reports' ? "bg-blue-600/20 text-blue-400" : "text-gray-300 hover:bg-gray-800")}
              >
                <Clock size={18} /> Hours Report
              </button>
              {canManage && (
                <>
                  <button
                    onClick={() => { setCurrentTab('workers'); setIsMobileMenuOpen(false); }}
                    className={cn("px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3", currentTab === 'workers' ? "bg-blue-600/20 text-blue-400" : "text-gray-300 hover:bg-gray-800")}
                  >
                    <Users size={18} /> Manage Workers
                  </button>
                  <button
                    onClick={() => { setCurrentTab('locations'); setIsMobileMenuOpen(false); }}
                    className={cn("px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3", currentTab === 'locations' ? "bg-blue-600/20 text-blue-400" : "text-gray-300 hover:bg-gray-800")}
                  >
                    <MapPin size={18} /> Manage Locations
                  </button>
                  <button
                    onClick={() => { setCurrentTab('settings'); setIsMobileMenuOpen(false); }}
                    className={cn("px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3", currentTab === 'settings' ? "bg-blue-600/20 text-blue-400" : "text-gray-300 hover:bg-gray-800")}
                  >
                    <SettingsIcon size={18} /> Settings
                  </button>
                </>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-3 mt-2 border border-red-400/20"
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        )}
      </header>
      
      <main className="flex-1 overflow-auto flex flex-col relative">
        {currentTab === 'calendar' && (
          locations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <MapPin size={48} className="mb-4 opacity-50" />
              <h2 className="text-xl font-bold text-white mb-2">No Locations Found</h2>
              <p className="max-w-md mb-6">You need to add at least one location before you can manage shifts.</p>
              {canManage && (
                <button
                  onClick={() => setCurrentTab('locations')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                >
                  Go to Locations
                </button>
              )}
            </div>
          ) : (
            <Calendar user={user} locationId={selectedLocationId} />
          )
        )}
        {currentTab === 'reports' && <Reports user={user} />}
        {currentTab === 'workers' && canManage && <ManageWorkers user={user} />}
        {currentTab === 'locations' && canManage && <ManageLocations user={user} />}
        {currentTab === 'settings' && canManage && <Settings currentUser={user} />}
      </main>
    </div>
  );
}
