import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// Import Leaflet and React-Leaflet directly
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Import the CSS file

// Polyfill for crypto.randomUUID for non-secure contexts
if (typeof crypto === 'undefined' || typeof crypto.randomUUID === 'undefined') {
  window.crypto = window.crypto || {};
  window.crypto.randomUUID = function() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> c / 4).toString(16)
    );
  };
}

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, addDoc, deleteDoc, updateDoc, writeBatch, getDocs, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Icons from lucide-react
import { Plus, Trash2, Edit, Save, X, Settings, Upload, MapPin, Check, Clock, DollarSign, ListChecks, Route, Sun, Moon, AlertTriangle, User, Users, CalendarDays, Bed, Camera, Building } from 'lucide-react';


// --- Custom Leaflet Icons ---
const createIcon = (icon) => {
    // Updated the class for a new blue theme
    return L.divIcon({
        html: icon,
        className: 'bg-indigo-500 text-white shadow-lg rounded-full p-2 border-2 border-white/50',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });
};

const icons = {
    // Changed stroke color to white for better contrast on blue background
    hotel: createIcon('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H2Z"/><path d="M9 9v6"/><path d="M15 9v6"/></svg>'),
    attraction: createIcon('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>'),
    general: createIcon('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>')
};

const getLocationIcon = (type) => {
    if (type === 'מלון') return icons.hotel;
    if (type === 'אטרקציה') return icons.attraction;
    return icons.general;
};


// Fix for default Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
});


// --- Firebase Configuration (Corrected) ---
const firebaseConfig = {
    apiKey: "AIzaSyB11HU1nmZwjY5sGQjyyWud_stNoqEwsi4",
    authDomain: "mytravelapp2025.firebaseapp.com",
    projectId: "mytravelapp2025",
    storageBucket: "mytravelapp2025.appspot.com",
    messagingSenderId: "287931178675",
    appId: "1:287931178675:web:5a8ea129b9e86727f45ac6"
};


// --- Helper Components ---
const Card = ({ title, icon, children, controls }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden w-full">
    <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {controls}
      </div>
    </div>
    <div className="p-4 sm:p-6 text-gray-700 dark:text-gray-300">
      {children}
    </div>
  </div>
);

const Toast = ({ message, show, onDismiss }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  return (
    <div className={`fixed bottom-5 right-5 bg-gray-900 text-white py-2 px-4 rounded-lg shadow-xl transition-transform duration-300 ${show ? 'transform translate-y-0 opacity-100' : 'transform translate-y-10 opacity-0'}`}>
      {message}
    </div>
  );
};


// --- Main App Components ---
const Countdown = ({ tripDetails, editMode, onUpdate }) => {
    const tripDate = tripDetails?.startDate || new Date().toISOString();

    const calculateTimeLeft = useCallback(() => {
        const difference = +new Date(tripDate) - +new Date();
        let newTimeLeft = {};
        if (difference > 0) {
            newTimeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }
        return newTimeLeft;
    }, [tripDate]);

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(interval);
    }, [calculateTimeLeft]);


    const timerComponents = Object.keys(timeLeft).map(interval => (
        <div key={interval} className="text-center">
            <span className="text-3xl sm:text-4xl font-bold text-indigo-500 dark:text-indigo-400">{String(timeLeft[interval]).padStart(2, '0')}</span>
            <span className="block text-xs uppercase text-gray-500 dark:text-gray-400">{interval}</span>
        </div>
    ));

    return (
        <Card title="הספירה לאחור לטיול" icon={<Clock className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />}>
            {Object.keys(timeLeft).length > 0 ? (
                <div className="flex justify-around items-center gap-2">{timerComponents}</div>
            ) : (
                <div className="text-center text-xl font-bold text-green-500">הטיול התחיל! תהנו!</div>
            )}
             <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                {editMode ? (
                    <div className='flex justify-center items-center gap-2'>
                        <label htmlFor="trip-start-date">תאריך התחלה:</label>
                        <input 
                          id="trip-start-date"
                          type="date"
                          value={tripDetails?.startDate?.split('T')[0] || ''} 
                          onChange={(e) => onUpdate({ startDate: e.target.value })}
                          className="bg-gray-100 dark:bg-gray-700 p-1 rounded-md"
                        />
                    </div>
                ) : (
                     <p>
                        <CalendarDays className="inline w-4 h-4 mr-1"/>
                        יוצאים בתאריך: <strong>{new Date(tripDate).toLocaleDateString('he-IL')}</strong>
                    </p>
                )}
             </div>
        </Card>
    );
};

const Checklist = ({ db, userId, tripId, editMode, showToast }) => {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState("");
    useEffect(() => {
        if (!tripId || !db) return;
        const unsubscribe = onSnapshot(collection(db, 'trips', tripId, 'checklist'), (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [db, tripId]);
    const handleAddTask = async () => {
        if (newTask.trim() === "" || !tripId || !db) return;
        await addDoc(collection(db, 'trips', tripId, 'checklist'), { text: newTask, completed: false });
        setNewTask("");
        showToast("משימה חדשה נוספה!");
    };
    const handleToggleTask = async (id, completed) => {
        if (!tripId || !db) return;
        await updateDoc(doc(db, 'trips', tripId, 'checklist', id), { completed: !completed });
    };
    const handleDeleteTask = async (id) => {
        if (!tripId || !db) return;
        await deleteDoc(doc(db, 'trips', tripId, 'checklist', id));
        showToast("המשימה נמחקה.");
    };
    const completedTasks = tasks.filter(task => task.completed).length;
    const totalTasks = tasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    return (
        <Card title="רשימת משימות" icon={<ListChecks className="w-6 h-6 text-green-500 dark:text-green-400" />} >
            <div className="space-y-3">
                {tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                             <button onClick={() => handleToggleTask(task.id, task.completed)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500'}`}>
                                {task.completed && <Check className="w-4 h-4 text-white" />}
                            </button>
                            <span className={`${task.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{task.text}</span>
                        </div>
                        {editMode && <button onClick={() => handleDeleteTask(task.id)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400"><Trash2 className="w-5 h-5" /></button>}
                    </div>
                ))}
            </div>
             <div className="mt-4">
                <div className="flex items-center gap-2">
                    <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTask()} placeholder="הוסף משימה חדשה..." className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none" />
                    <button onClick={handleAddTask} className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"><Plus className="w-5 h-5" /></button>
                </div>
            </div>
            <div className="mt-6">
                <div className="flex justify-between mb-1"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">התקדמות</span><span className="text-sm font-medium text-green-700 dark:text-green-400">{Math.round(progress)}%</span></div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5"><div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
            </div>
        </Card>
    );
};

const Budget = ({ tripDetails, editMode, onUpdate, db, tripId, showToast }) => {
    const [expenses, setExpenses] = useState([]);
    const [editingExpense, setEditingExpense] = useState(null);
    const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'אחר' });
    const [isAddingExpense, setIsAddingExpense] = useState(false);

    useEffect(() => {
        if (!tripId || !db) return;
        const unsubscribe = onSnapshot(collection(db, 'trips', tripId, 'budget'), (snapshot) => {
            setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [db, tripId]);

    const totalSpent = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount), 0), [expenses]);
    const spentPerPerson = (tripDetails?.participants || 1) > 0 ? totalSpent / (tripDetails?.participants || 1) : 0;
    
    const handleUpdateExpense = async () => {
        if (!editingExpense || !tripId || !db) return;
        const { id, ...dataToUpdate } = editingExpense;
        await updateDoc(doc(db, 'trips', tripId, 'budget', id), { ...dataToUpdate, amount: Number(dataToUpdate.amount) });
        setEditingExpense(null);
        showToast("ההוצאה עודכנה.");
    };

    const handleDeleteExpense = async (id) => {
        if (!tripId || !db) return;
        await deleteDoc(doc(db, 'trips', tripId, 'budget', id));
        showToast("ההוצאה נמחקה.");
    };
    
    const handleAddNewExpense = async () => {
        if (!newExpense.description || !newExpense.amount || !tripId || !db) {
            showToast("יש למלא תיאור וסכום להוצאה.");
            return;
        }
        await addDoc(collection(db, 'trips', tripId, 'budget'), {
            ...newExpense,
            amount: Number(newExpense.amount)
        });
        setNewExpense({ description: '', amount: '', category: 'אחר' });
        setIsAddingExpense(false);
        showToast("הוצאה חדשה נוספה.");
    };

    const categoryColors = { 'טיסות': 'bg-blue-500', 'לינה': 'bg-purple-500', 'אוכל': 'bg-orange-500', 'תחבורה': 'bg-yellow-500', 'אטרקציות': 'bg-pink-500', 'אחר': 'bg-gray-500' };

    const EditableField = ({ value, onChange, isEditing, prefix = '$' }) => {
        const [localValue, setLocalValue] = useState(value);
        useEffect(() => setLocalValue(value), [value]);

        if (isEditing) {
            return (
                <input
                    type="number"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={() => onChange(localValue)}
                    className="text-2xl font-bold text-center bg-transparent border-b-2 border-indigo-500 outline-none w-24 transition-all"
                />
            );
        }
        return <p className="text-2xl font-bold text-gray-800 dark:text-white">{prefix}{Number(value).toLocaleString()}</p>;
    };

    return (
        <Card title="תקציב הטיול" icon={<DollarSign className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />} controls={
            editMode ? <button onClick={() => setIsAddingExpense(true)} className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600"><Plus className="w-4 h-4" /></button> : null
        }>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
                <div><p className="text-sm text-gray-500 dark:text-gray-400">תקציב כולל</p><EditableField value={tripDetails?.totalBudget || 0} onChange={(val) => onUpdate({ totalBudget: Number(val)})} isEditing={editMode} /></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400">הוצאות</p><p className="text-2xl font-bold text-red-500">${totalSpent.toLocaleString()}</p></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400">משתתפים</p><EditableField value={tripDetails?.participants || 0} onChange={(val) => onUpdate({ participants: Number(val)})} isEditing={editMode} prefix="" /></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400">הוצאה לאדם</p><p className="text-2xl font-bold text-gray-800 dark:text-white">${spentPerPerson.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
            </div>

            {isAddingExpense && editMode && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3 mb-4 transition-all">
                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">הוספת הוצאה חדשה</h4>
                     <input type="text" placeholder="תיאור ההוצאה" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full p-2 bg-transparent border rounded-md dark:border-gray-600" />
                    <div className="flex gap-2">
                        <input type="number" placeholder="סכום" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="w-1/2 p-2 bg-transparent border rounded-md dark:border-gray-600" />
                        <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="w-1/2 p-2 bg-transparent border rounded-md dark:border-gray-600">
                             {Object.keys(categoryColors).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                         <button onClick={() => setIsAddingExpense(false)} className="px-4 py-2 text-sm font-semibold rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">ביטול</button>
                        <button onClick={handleAddNewExpense} className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-500 text-white hover:bg-green-600">שמור הוצאה</button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {expenses.map(item => (
                    <div key={item.id}>
                        {editingExpense && editingExpense.id === item.id ? (
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg space-y-2">
                                <input type="text" value={editingExpense.description} onChange={(e) => setEditingExpense({...editingExpense, description: e.target.value})} className="w-full p-1 bg-transparent border-b dark:border-gray-500"/>
                                <input type="number" value={editingExpense.amount} onChange={(e) => setEditingExpense({...editingExpense, amount: e.target.value})} className="w-full p-1 bg-transparent border-b dark:border-gray-500"/>
                                <select value={editingExpense.category} onChange={(e) => setEditingExpense({...editingExpense, category: e.target.value})} className="w-full p-1 bg-transparent border-b dark:border-gray-500">{Object.keys(categoryColors).map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                                <div className="flex gap-2 justify-end"><button onClick={handleUpdateExpense} className="p-1 text-green-500"><Save className="w-5 h-5"/></button><button onClick={() => setEditingExpense(null)} className="p-1 text-red-500"><X className="w-5 h-5"/></button></div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-2 rounded-lg group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${categoryColors[item.category] || 'bg-gray-500'}`}></div>
                                    <div><p className="font-semibold text-gray-800 dark:text-gray-200">{item.description}</p><p className="text-sm text-gray-500 dark:text-gray-400">{item.category}</p></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="font-bold text-lg text-gray-900 dark:text-white">${Number(item.amount).toLocaleString()}</p>
                                    {editMode && <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2"><button onClick={() => setEditingExpense({...item})} className="text-blue-500 hover:text-blue-700"><Edit className="w-5 h-5"/></button><button onClick={() => handleDeleteExpense(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5"/></button></div>}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
};

// --- Map Components ---
function ChangeView({ locations }) {
  const map = useMap();
  useEffect(() => {
    if (L && locations && locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);
  return null;
}

const Routes = ({ db, userId, tripId, editMode, showToast }) => {
    const [routes, setRoutes] = useState([]);
    const [activeRouteId, setActiveRouteId] = useState(null);
    const [locations, setLocations] = useState([]);
    const [newLocation, setNewLocation] = useState({ name: '', lat: '', lng: '', type: 'כללי', note: '', address: '' });
    const [newRouteName, setNewRouteName] = useState('');

    // This effect now also handles seeding the initial data
    useEffect(() => {
        if (!tripId || !db) return;

        const seedInitialData = async () => {
            const routesRef = collection(db, 'trips', tripId, 'routes');
            const querySnapshot = await getDocs(routesRef);

            if (querySnapshot.empty) {
                showToast("יוצר מסלולים התחלתיים...");
                const batch = writeBatch(db);

                // 1. Maine to Baltimore Route
                const maineRouteRef = doc(collection(db, 'trips', tripId, 'routes'));
                batch.set(maineRouteRef, { name: "מסלול מיין לבלטימור" });
                const maineLocations = [
                    { name: "The Press Hotel", lat: 43.6579, lng: -70.2593, order: 1, type: 'מלון', note: "לילה ראשון, Autograph Collection", address: "119 Exchange St, Portland, ME" },
                    { name: "Boston Harbor Hotel", lat: 42.3571, lng: -71.0504, order: 2, type: 'מלון', note: "מלון על המים", address: "70 Rowes Wharf, Boston, MA" },
                    { name: " מוזיאון המדע, בוסטון", lat: 42.3678, lng: -71.0709, order: 3, type: 'אטרקציה', note: "מומלץ למשפחות", address: "1 Science Park, Boston, MA" },
                    { name: "Four Seasons Hotel Baltimore", lat: 39.2789, lng: -76.598, order: 4, type: 'מלון', note: "מלון יוקרתי לסיום", address: "200 International Drive, Baltimore, MD" }
                ];
                maineLocations.forEach(loc => {
                    const locRef = doc(collection(db, 'trips', tripId, 'routes', maineRouteRef.id, 'locations'));
                    batch.set(locRef, loc);
                });

                // 2. New York Route
                const nyRouteRef = doc(collection(db, 'trips', tripId, 'routes'));
                batch.set(nyRouteRef, { name: "מסלול ניו יורק 4 ימים" });
                const nyLocations = [
                    { name: "Moxy Times Square", lat: 40.7513, lng: -73.9882, order: 1, type: 'מלון', note: "מלון מודרני, מיקום מרכזי", address: "485 7th Ave, New York, NY" },
                    { name: "טיימס סקוור", lat: 40.7580, lng: -73.9855, order: 2, type: 'אטרקציה', note: "אורות ושלטים", address: "Manhattan, NY 10036" },
                    { name: "פסל החירות", lat: 40.6892, lng: -74.0445, order: 3, type: 'אטרקציה', note: "לקחת מעבורת מ-Battery Park", address: "New York, NY 10004" },
                    { name: "גשר ברוקלין", lat: 40.7061, lng: -73.9969, order: 4, type: 'אטרקציה', note: "הליכה לעת שקיעה, נוף מדהים", address: "Brooklyn Bridge, New York, NY" }
                ];
                nyLocations.forEach(loc => {
                    const locRef = doc(collection(db, 'trips', tripId, 'routes', nyRouteRef.id, 'locations'));
                    batch.set(locRef, loc);
                });
                
                await batch.commit();
            }
        };

        seedInitialData();

        const unsubscribe = onSnapshot(collection(db, 'trips', tripId, 'routes'), (snapshot) => {
            const routesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRoutes(routesData);
            if (!activeRouteId && routesData.length > 0) {
                setActiveRouteId(routesData[0].id);
            } else if (routesData.length === 0) {
                setActiveRouteId(null);
            }
        });

        return () => unsubscribe();
    }, [db, tripId, showToast]);


    useEffect(() => {
        if (!tripId || !activeRouteId || !db) { setLocations([]); return; };
        const unsubscribe = onSnapshot(collection(db, 'trips', tripId, 'routes', activeRouteId, 'locations'), (snapshot) => {
            let locationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            locationsData.sort((a, b) => (a.order || 0) - (b.order || 0));
            setLocations(locationsData);
        });
        return () => unsubscribe();
    }, [db, tripId, activeRouteId]);

    const handleAddRoute = async () => {
        if (newRouteName.trim() === '' || !tripId || !db) return;
        const newRouteRef = await addDoc(collection(db, 'trips', tripId, 'routes'), { name: newRouteName });
        setActiveRouteId(newRouteRef.id);
        setNewRouteName('');
        showToast(`מסלול "${newRouteName}" נוצר!`);
    };

    const handleDeleteRoute = async (routeId, routeName) => {
        if (!tripId || !db) return;
        if(window.confirm(`האם אתה בטוח שברצונך למחוק את המסלול "${routeName}"?`)){
            await deleteDoc(doc(db, 'trips', tripId, 'routes', routeId));
            showToast(`המסלול "${routeName}" נמחק.`);
        }
    };
    
    const handleAddLocation = async () => {
        if (!tripId || !activeRouteId || !db || !newLocation.name || !newLocation.lat || !newLocation.lng) {
            showToast('יש למלא את כל השדות עבור המיקום.', 'error'); return;
        }
        await addDoc(collection(db, 'trips', tripId, 'routes', activeRouteId, 'locations'), {
            ...newLocation,
            lat: parseFloat(newLocation.lat),
            lng: parseFloat(newLocation.lng),
            order: locations.length + 1
        });
        setNewLocation({ name: '', lat: '', lng: '', type: 'כללי', note: '', address: '' });
        showToast("מיקום חדש נוסף למסלול!");
    };

    const handleDeleteLocation = async (locationId) => {
         if (!tripId || !activeRouteId || !db) return;
         await deleteDoc(doc(db, 'trips', tripId, 'routes', activeRouteId, 'locations', locationId));
         showToast("המיקום נמחק.");
    };
    
    const activeRoute = useMemo(() => routes.find(r => r.id === activeRouteId), [routes, activeRouteId]);
    
    return (
        <Card title="מסלולי טיול" icon={<Route className="w-6 h-6 text-indigo-500" />}>
            <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                    {routes.map(route => (
                        <div key={route.id} className="relative group">
                             <button onClick={() => setActiveRouteId(route.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeRouteId === route.id ? 'bg-indigo-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{route.name}</button>
                             {editMode && <button onClick={() => handleDeleteRoute(route.id, route.name)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>}
                        </div>
                    ))}
                    {editMode && <div className="flex items-center gap-2"><input type="text" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} placeholder="שם מסלול חדש" className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm w-32"/><button onClick={handleAddRoute} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"><Plus className="w-5 h-5" /></button></div>}
                </div>
            </div>
            
            {activeRoute ? (
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="lg:w-2/3 w-full">
                        <div className="h-80 lg:h-full w-full rounded-lg overflow-hidden shadow-md">
                           <MapContainer center={[40.7128, -74.0060]} zoom={4} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'/>
                                {locations.map(loc => (
                                <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={getLocationIcon(loc.type)}>
                                    <Popup>
                                        <div className="text-right">
                                            <h3 className="font-bold text-lg">{loc.name}</h3>
                                            <p className="text-sm text-gray-500">{loc.type}</p>
                                            {loc.address && <p className="mt-1 text-xs">{loc.address}</p>}
                                            {loc.note && <p className="mt-2 text-sm italic">"{loc.note}"</p>}
                                        </div>
                                    </Popup>
                                </Marker>
                                ))}
                                {locations.length > 1 && <Polyline positions={locations.map(loc => [loc.lat, loc.lng])} color="#4f46e5" />}
                                <ChangeView locations={locations} />
                           </MapContainer>
                        </div>
                    </div>
                    <div className="lg:w-1/3 w-full space-y-3">
                         <h3 className="font-bold text-lg text-gray-800 dark:text-white">מיקומים ב"{activeRoute.name}"</h3>
                         <div className="space-y-2 max-h-60 lg:max-h-full lg:overflow-y-auto pr-2">
                            {locations.map((loc, index) => (
                                <div key={loc.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                    <div className="flex items-center gap-2"><span className="text-indigo-500 font-bold">{index + 1}</span><span>{loc.name}</span></div>
                                    {editMode && <button onClick={() => handleDeleteLocation(loc.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>}
                                </div>
                            ))}
                         </div>
                         {editMode && (
                             <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h4 className="font-semibold">הוסף מיקום חדש</h4>
                                <input type="text" placeholder="שם המיקום" value={newLocation.name} onChange={e => setNewLocation({...newLocation, name: e.target.value})} className="w-full p-2 bg-transparent border rounded-md dark:border-gray-600" />
                                <div className="flex gap-2">
                                    <input type="number" placeholder="קו רוחב (lat)" value={newLocation.lat} onChange={e => setNewLocation({...newLocation, lat: e.target.value})} className="w-1/2 p-2 bg-transparent border rounded-md dark:border-gray-600" />
                                    <input type="number" placeholder="קו אורך (lng)" value={newLocation.lng} onChange={e => setNewLocation({...newLocation, lng: e.target.value})} className="w-1/2 p-2 bg-transparent border rounded-md dark:border-gray-600" />
                                </div>
                                <input type="text" placeholder="כתובת (אופציונלי)" value={newLocation.address} onChange={e => setNewLocation({...newLocation, address: e.target.value})} className="w-full p-2 bg-transparent border rounded-md dark:border-gray-600" />
                                 <textarea placeholder="הערות (אופציונלי)" value={newLocation.note} onChange={e => setNewLocation({...newLocation, note: e.target.value})} className="w-full p-2 bg-transparent border rounded-md dark:border-gray-600 h-20"></textarea>
                                <select value={newLocation.type} onChange={e => setNewLocation({...newLocation, type: e.target.value})} className="w-full p-2 bg-transparent border rounded-md dark:border-gray-600">
                                    <option value="כללי">כללי</option>
                                    <option value="מלון">מלון</option>
                                    <option value="אטרקציה">אטרקציה</option>
                                </select>
                                <button onClick={handleAddLocation} className="w-full p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> הוסף מיקום</button>
                            </div>
                         )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-10"><p className="text-gray-500">בחר מסלול או צור אחד חדש במצב עריכה.</p></div>
            )}
        </Card>
    );
};

// --- The Main App Component ---
export default function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [tripId, setTripId] = useState('mainTrip');
    const [editMode, setEditMode] = useState(false);
    const [toastInfo, setToastInfo] = useState({ show: false, message: '' });
    const [darkMode, setDarkMode] = useState(false);
    const fileInputRef = useRef(null);
    const [tripDetails, setTripDetails] = useState(null);
    
    const showToast = useCallback((message) => { setToastInfo({ show: true, message }); }, []);

    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const authInstance = getAuth(app);
            setDb(firestoreDb);
            setAuth(authInstance);

            onAuthStateChanged(authInstance, (user) => {
                if (user) { 
                    setUserId(user.uid);
                    // Once user is authenticated, set up the main trip listener
                    const tripDocRef = doc(firestoreDb, 'trips', tripId);
                    const unsubscribe = onSnapshot(tripDocRef, (doc) => {
                        if (doc.exists()) {
                            setTripDetails(doc.data());
                        } else {
                            // If the main trip document doesn't exist, create it with defaults.
                            const defaultTripData = {
                                name: "הטיול הגדול לאמריקה",
                                startDate: "2025-07-20T00:00:00",
                                totalBudget: 15000,
                                participants: 3
                            };
                            setDoc(tripDocRef, defaultTripData);
                            setTripDetails(defaultTripData);
                        }
                    });
                    return () => unsubscribe(); // Cleanup listener on unmount
                }
                else { 
                    signInAnonymously(authInstance).catch(console.error); 
                }
            });
        } catch (e) {
            console.error("Error initializing Firebase:", e);
        }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setDarkMode(true);
        }
    }, [tripId]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);
    
    const handleUpdateTripDetails = async (newDetails) => {
        if (!db || !tripId) return;
        const tripDocRef = doc(db, 'trips', tripId);
        // Special handling for date to keep the time part
        if (newDetails.startDate) {
            newDetails.startDate = `${newDetails.startDate}T00:00:00`;
        }
        await updateDoc(tripDocRef, newDetails);
        showToast("פרטי הטיול עודכנו!");
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file || !db) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (window.confirm("האם אתה בטוח? פעולה זו תחליף את כל נתוני הטיול הנוכחיים.")) {
                    await importDataToFirestore(data);
                    showToast('הנתונים יובאו בהצלחה!');
                }
            } catch (error) {
                console.error("Error parsing or importing JSON:", error);
                showToast('שגיאה בייבוא הקובץ.', 'error');
            }
        };
        reader.readAsText(file);
    };
    const importDataToFirestore = async (data) => {
        if (!db || !tripId) return;
        const batch = writeBatch(db);
        if (data.checklist) data.checklist.forEach(item => batch.set(doc(collection(db, 'trips', tripId, 'checklist')), item));
        if (data.budget) data.budget.forEach(item => batch.set(doc(collection(db, 'trips', tripId, 'budget')), item));
        if (data.routes) {
            for (const route of data.routes) {
                const { locations, ...routeData } = route;
                const routeDocRef = doc(collection(db, 'trips', tripId, 'routes'));
                batch.set(routeDocRef, routeData);
                if (locations) locations.forEach(loc => batch.set(doc(collection(db, 'trips', tripId, 'routes', routeDocRef.id, 'locations')), loc));
            }
        }
        await batch.commit();
    };
    
    if (!auth || !tripDetails) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900"><p className="text-lg text-gray-700 dark:text-gray-300">מתחבר לשירות התכנון...</p></div>;
    }
    
    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen font-sans">
            <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500">{tripDetails?.name || "מתכנן הטיולים PRO"}</h1>
                        <div className="flex items-center gap-3 sm:gap-4">
                            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">{darkMode ? <Sun/> : <Moon />}</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden"/>
                             <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400"><Upload className="w-5 h-5"/><span className="hidden sm:inline">ייבא JSON</span></button>
                            <button onClick={() => setEditMode(!editMode)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${editMode ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}><Settings className="w-5 h-5"/><span className="hidden sm:inline">{editMode ? 'סיום עריכה' : 'מצב עריכה'}</span></button>
                        </div>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="text-center mb-4 text-xs text-gray-400">User ID: {userId} | Trip ID: {tripId}</div>
                <div className="space-y-6 lg:space-y-8">
                    <Countdown tripDetails={tripDetails} editMode={editMode} onUpdate={handleUpdateTripDetails} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                        <Checklist db={db} userId={userId} tripId={tripId} editMode={editMode} showToast={showToast} />
                        <Budget tripDetails={tripDetails} editMode={editMode} onUpdate={handleUpdateTripDetails} db={db} tripId={tripId} showToast={showToast} />
                    </div>
                    <Routes db={db} userId={userId} tripId={tripId} editMode={editMode} showToast={showToast} />
                </div>
            </main>
            <Toast message={toastInfo.message} show={toastInfo.show} onDismiss={() => setToastInfo({ show: false, message: '' })} />
        </div>
    );
}