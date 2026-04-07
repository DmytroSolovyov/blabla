import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from './firebase-init.js';

// Add polyfill initialization at the top of app.js
MobileDragDrop.polyfill({
    dragImageTranslateOverride: MobileDragDrop.scrollBehaviourDragImageTranslateOverride,
    holdToDrag: 150 // Make it snappy on mobile
});
window.addEventListener('touchmove', function() {}, {passive: false});

// State
let currentUser = null;
let workers = [];
let locations = [];
let shifts = [];
let users = [];
let currentMonthStart = new Date();
currentMonthStart.setDate(1);
currentMonthStart.setHours(0,0,0,0);

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

const userNameDisplay = document.getElementById('user-name-display');
const userRoleBadge = document.getElementById('user-role-badge');
const mobileUserName = document.getElementById('mobile-user-name');
const mobileUserRole = document.getElementById('mobile-user-role');
const mobileUserAvatar = document.getElementById('mobile-user-avatar');

const navBtns = document.querySelectorAll('.nav-btn, .mobile-nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const adminOnlyElements = document.querySelectorAll('.admin-only');

const locationSelect = document.getElementById('location-select');
const mobileLocationSelect = document.getElementById('mobile-location-select');
const noLocationsMsg = document.getElementById('no-locations-msg');
const calendarView = document.getElementById('calendar-view');
const goToLocationsBtn = document.getElementById('go-to-locations-btn');

const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

// Calendar Elements
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthDisplay = document.getElementById('current-month-display');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');

// Modals
const modalOverlay = document.getElementById('modal-overlay');
const closeModals = document.querySelectorAll('.close-modal');

const shiftModal = document.getElementById('shift-modal');
const shiftForm = document.getElementById('shift-form');
const deleteShiftBtn = document.getElementById('delete-shift-btn');

const workerModal = document.getElementById('worker-modal');
const workerForm = document.getElementById('worker-form');

const locationModal = document.getElementById('location-modal');
const locationForm = document.getElementById('location-form');

const userModal = document.getElementById('user-modal');
const userForm = document.getElementById('user-form');

// Initialize
async function init() {
    lucide.createIcons();
    await checkAuth();
    setupEventListeners();
}

// API Calls mapped to Firestore
async function apiCall(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    
    // Parse URL
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    const searchParams = urlObj.searchParams;
    
    const parts = path.split('/').filter(Boolean);
    // e.g. ['api', 'workers', '123']
    const collectionName = parts[1];
    const docId = parts[2];
    
    try {
        if (method === 'GET') {
            if (docId) {
                const docSnap = await getDoc(doc(db, collectionName, docId));
                if (!docSnap.exists()) throw new Error('Not found');
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                let q = collection(db, collectionName);
                
                // Handle shifts query
                if (collectionName === 'shifts') {
                    const locId = searchParams.get('location_id');
                    const startDate = searchParams.get('start_date');
                    const endDate = searchParams.get('end_date');
                    
                    if (locId) {
                        q = query(collection(db, 'shifts'), where('location_id', '==', locId));
                    }
                    
                    const querySnapshot = await getDocs(q);
                    let results = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    
                    if (startDate) {
                        results = results.filter(s => s.date >= startDate);
                    }
                    if (endDate) {
                        results = results.filter(s => s.date <= endDate);
                    }
                    return results;
                }
                
                const querySnapshot = await getDocs(q);
                return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            }
        } else if (method === 'POST') {
            const newDocRef = doc(collection(db, collectionName));
            await setDoc(newDocRef, body);
            return { id: newDocRef.id, ...body };
        } else if (method === 'PUT') {
            await updateDoc(doc(db, collectionName, docId), body);
            return { id: docId, ...body };
        } else if (method === 'DELETE') {
            await deleteDoc(doc(db, collectionName, docId));
            return { success: true };
        }
    } catch (e) {
        console.error("Firestore Error:", e);
        alert("Error: " + (e.message || 'API Error'));
        throw new Error(e.message || 'API Error');
    }
}

// Auth
function checkAuth() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    let userDoc = await getDoc(doc(db, 'users', user.uid));
                    let userData = null;
                    
                    if (userDoc.exists()) {
                        userData = userDoc.data();
                    } else {
                        // Check if admin pre-registered them by email
                        const q = query(collection(db, 'users'), where('email', '==', user.email));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            const preRegDoc = querySnapshot.docs[0];
                            userData = preRegDoc.data();
                            // Move data to UID doc
                            await setDoc(doc(db, 'users', user.uid), userData);
                            await deleteDoc(doc(db, 'users', preRegDoc.id));
                        } else {
                            // Create default user profile
                            userData = { email: user.email, role: 'worker' };
                            // If it's the admin email, make them boss
                            if (user.email === 'dmytro.solovyov1998@gmail.com') {
                                userData.role = 'boss';
                            }
                            await setDoc(doc(db, 'users', user.uid), userData);
                        }
                    }
                    
                    currentUser = { id: user.uid, email: user.email, username: user.displayName || user.email.split('@')[0], ...userData };
                    await loadInitialData();
                    showMainScreen();
                } catch (e) {
                    console.error(e);
                    showAuthScreen();
                }
            } else {
                showAuthScreen();
            }
            resolve();
        });
    });
}

const googleSignInBtn = document.getElementById('google-signin-btn');

function isInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return (ua.indexOf("FBAN") > -1) || 
           (ua.indexOf("FBAV") > -1) || 
           (ua.indexOf("Instagram") > -1) || 
           (ua.indexOf("Line") > -1) || 
           (ua.indexOf("Messenger") > -1) ||
           (ua.indexOf("Snapchat") > -1);
}

if (isInAppBrowser()) {
    loginError.innerHTML = "⚠️ <b>Warning:</b> You are using an in-app browser (like Messenger). Google Sign-In will likely fail. Please tap the three dots in the top right corner and select <b>'Open in Chrome'</b> or <b>'Open in system browser'</b>.";
    loginError.classList.remove('hidden');
    loginError.style.backgroundColor = "#fff3cd";
    loginError.style.color = "#856404";
    loginError.style.padding = "10px";
    loginError.style.borderRadius = "4px";
    loginError.style.marginTop = "15px";
}

if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
            loginError.classList.add('hidden');
        } catch (e) {
            loginError.textContent = e.message;
            loginError.classList.remove('hidden');
        }
    });
}

async function logout() {
    await signOut(auth);
    currentUser = null;
    showAuthScreen();
}

logoutBtn.addEventListener('click', logout);
mobileLogoutBtn.addEventListener('click', logout);

// UI State
function showAuthScreen() {
    authScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');
}

function showMainScreen() {
    authScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    
    userNameDisplay.textContent = currentUser.username;
    userRoleBadge.textContent = currentUser.role;
    mobileUserName.textContent = currentUser.username;
    mobileUserRole.textContent = currentUser.role;
    mobileUserAvatar.textContent = currentUser.username.charAt(0).toUpperCase();

    const isAdmin = currentUser.role === 'boss' || currentUser.role === 'manager';
    adminOnlyElements.forEach(el => {
        if (isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    switchTab('calendar');
    updateLocationSelects();
    renderCalendar();
}

// Navigation
navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        switchTab(tab);
        mobileMenu.classList.add('hidden');
    });
});

function switchTab(tabId) {
    navBtns.forEach(btn => {
        if (btn.dataset.tab === tabId) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    tabContents.forEach(content => {
        if (content.id === `tab-${tabId}`) content.classList.remove('hidden');
        else content.classList.add('hidden');
    });

    if (tabId === 'calendar') {
        locationSelect.classList.remove('hidden');
        mobileLocationSelect.classList.remove('hidden');
        renderCalendar();
    } else {
        locationSelect.classList.add('hidden');
        mobileLocationSelect.classList.add('hidden');
    }

    if (tabId === 'reports') renderReports();
    if (tabId === 'workers') renderWorkers();
    if (tabId === 'locations') renderLocations();
    if (tabId === 'users') renderUsers();
}

mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
});

goToLocationsBtn.addEventListener('click', () => switchTab('locations'));

// Data Loading
async function loadInitialData() {
    [workers, locations] = await Promise.all([
        apiCall('/api/workers'),
        apiCall('/api/locations')
    ]);
    
    if (currentUser.role === 'boss' || currentUser.role === 'manager') {
        users = await apiCall('/api/users');
    }
    
    updateLocationSelects();
    if (locations.length > 0) {
        await loadShifts();
    }
}

async function loadShifts() {
    const locId = locationSelect.value;
    if (!locId) return;
    
    const year = currentMonthStart.getFullYear();
    const month = currentMonthStart.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const start = new Date(firstDay);
    const startDay = start.getDay();
    start.setDate(start.getDate() - (startDay === 0 ? 6 : startDay - 1));
    
    const end = new Date(lastDay);
    const endDay = end.getDay();
    end.setDate(end.getDate() + (endDay === 0 ? 0 : 7 - endDay));
    
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    shifts = await apiCall(`/api/shifts?location_id=${locId}&start_date=${startStr}&end_date=${endStr}`);
}

function updateLocationSelects() {
    locationSelect.innerHTML = '';
    mobileLocationSelect.innerHTML = '';
    
    locations.forEach(loc => {
        const opt = `<option value="${loc.id}">${loc.name}</option>`;
        locationSelect.innerHTML += opt;
        mobileLocationSelect.innerHTML += opt;
    });

    if (locations.length === 0) {
        noLocationsMsg.classList.remove('hidden');
        calendarView.classList.add('hidden');
        locationSelect.classList.add('hidden');
        mobileLocationSelect.classList.add('hidden');
    } else {
        noLocationsMsg.classList.add('hidden');
        calendarView.classList.remove('hidden');
    }
}

locationSelect.addEventListener('change', async (e) => {
    mobileLocationSelect.value = e.target.value;
    await loadShifts();
    renderCalendar();
});

mobileLocationSelect.addEventListener('change', async (e) => {
    locationSelect.value = e.target.value;
    await loadShifts();
    renderCalendar();
});

// Calendar
prevMonthBtn.addEventListener('click', async () => {
    currentMonthStart.setMonth(currentMonthStart.getMonth() - 1);
    await loadShifts();
    renderCalendar();
});

nextMonthBtn.addEventListener('click', async () => {
    currentMonthStart.setMonth(currentMonthStart.getMonth() + 1);
    await loadShifts();
    renderCalendar();
});

document.getElementById('export-calendar-btn').addEventListener('click', async () => {
    const calendarGrid = document.getElementById('calendar-grid');
    const btn = document.getElementById('export-calendar-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="spin" style="width: 16px; height: 16px;"></i> Exporting...';
    lucide.createIcons();
    
    let wrapper = null;
    try {
        // Create a wrapper to include the location name
        wrapper = document.createElement('div');
        wrapper.style.backgroundColor = '#1a1f2e';
        wrapper.style.padding = '24px';
        wrapper.style.width = 'max-content';
        wrapper.style.borderRadius = '8px';
        
        const title = document.createElement('h2');
        const locationSelect = document.getElementById('location-select');
        const locationName = locationSelect.options[locationSelect.selectedIndex]?.text || 'Calendar';
        const monthName = document.getElementById('current-month-display').textContent;
        title.textContent = `${locationName} - ${monthName}`;
        title.style.color = '#ffffff';
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        title.style.fontFamily = "'Inter', sans-serif";
        title.style.fontSize = '24px';
        title.style.fontWeight = '600';
        
        const parent = calendarGrid.parentNode;
        parent.insertBefore(wrapper, calendarGrid);
        wrapper.appendChild(title);
        wrapper.appendChild(calendarGrid);
        
        const canvas = await html2canvas(wrapper, {
            backgroundColor: '#1a1f2e',
            scale: 2
        });
        
        // Restore DOM
        parent.insertBefore(calendarGrid, wrapper);
        parent.removeChild(wrapper);
        
        const link = document.createElement('a');
        link.download = `bellacaffe-${locationName.replace(/\s+/g, '-').toLowerCase()}-${currentMonthStart.getFullYear()}-${(currentMonthStart.getMonth()+1).toString().padStart(2, '0')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('Export failed', err);
        // Ensure DOM is restored even if it fails
        if (wrapper && wrapper.parentNode) {
            const parent = wrapper.parentNode;
            if (calendarGrid.parentNode === wrapper) {
                parent.insertBefore(calendarGrid, wrapper);
            }
            parent.removeChild(wrapper);
        }
        customAlert('Failed to export calendar');
    } finally {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
});

// Drag and Drop Logic
let draggedShiftId = null;

window.handleDragStart = (e, shiftId) => {
    draggedShiftId = shiftId;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', shiftId);
};

window.handleDragEnter = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
};

window.handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
};

window.handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
};

window.handleDrop = async (e, dateStr) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!draggedShiftId) return;

    const originalShift = shifts.find(s => s.id === draggedShiftId);
    if (!originalShift) return;

    const isAdmin = currentUser.role === 'boss' || currentUser.role === 'manager';
    if (!isAdmin && originalShift.worker_id !== currentUser.worker_id) {
        customAlert("You can only copy your own shifts.");
        draggedShiftId = null;
        return;
    }

    const newShift = {
        location_id: originalShift.location_id,
        worker_id: originalShift.worker_id,
        date: dateStr,
        start_time: originalShift.start_time,
        end_time: originalShift.end_time,
        notes: originalShift.notes
    };

    // Optimistic UI update for snappiness
    const tempId = Date.now();
    shifts.push({ ...newShift, id: tempId });
    renderCalendar();

    try {
        await apiCall('/api/shifts', { method: 'POST', body: JSON.stringify(newShift) });
        await loadShifts();
        renderCalendar();
    } catch (err) {
        console.error('Failed to copy shift', err);
        // Revert optimistic update on failure
        shifts = shifts.filter(s => s.id !== tempId);
        renderCalendar();
    }
    draggedShiftId = null;
};

window.deleteShiftFast = async (e, id) => {
    e.stopPropagation();
    customConfirm('Delete this shift?', async () => {
        // Optimistic UI update
        shifts = shifts.filter(s => s.id !== id);
        renderCalendar();
        
        try {
            await apiCall(`/api/shifts/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Failed to delete shift', err);
            await loadShifts(); // Reload to revert
            renderCalendar();
        }
    });
};

function renderCalendar() {
    if (locations.length === 0) return;
    
    const options = { month: 'long', year: 'numeric' };
    currentMonthDisplay.textContent = currentMonthStart.toLocaleDateString(undefined, options);
    
    calendarGrid.innerHTML = '';
    
    // Add day of week headers
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    daysOfWeek.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.style.padding = '0';
        header.innerHTML = `<div class="day-name" style="width: 100%;">${day}</div>`;
        calendarGrid.appendChild(header);
    });
    
    const today = new Date();
    today.setHours(0,0,0,0);

    const year = currentMonthStart.getFullYear();
    const month = currentMonthStart.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const start = new Date(firstDay);
    const startDay = start.getDay();
    start.setDate(start.getDate() - (startDay === 0 ? 6 : startDay - 1));
    
    const end = new Date(lastDay);
    const endDay = end.getDay();
    end.setDate(end.getDate() + (endDay === 0 ? 0 : 7 - endDay));

    const isAdmin = currentUser.role === 'boss' || currentUser.role === 'manager';

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        const isToday = date.getTime() === today.getTime();
        const isOtherMonth = date.getMonth() !== month;
        
        const dayDiv = document.createElement('div');
        dayDiv.className = `calendar-day ${isOtherMonth ? 'other-month' : ''}`;
        
        dayDiv.setAttribute('ondragenter', 'handleDragEnter(event)');
        dayDiv.setAttribute('ondragover', 'handleDragOver(event)');
        dayDiv.setAttribute('ondragleave', 'handleDragLeave(event)');
        dayDiv.setAttribute('ondrop', `handleDrop(event, '${dateStr}')`);
        
        const dayShifts = shifts.filter(s => s.date === dateStr);
        const amShifts = dayShifts.filter(s => parseInt(s.start_time.split(':')[0]) < 12);
        const pmShifts = dayShifts.filter(s => parseInt(s.start_time.split(':')[0]) >= 12);
        
        const renderShift = (shift) => {
            const worker = workers.find(w => w.id === shift.worker_id);
            const color = worker ? worker.color : '#3b82f6';
            const name = worker ? worker.name : 'Unknown';
            const isOwnShift = currentUser.worker_id === shift.worker_id;
            const canEdit = isAdmin || isOwnShift;
            const draggableAttr = canEdit ? `draggable="true" ondragstart="handleDragStart(event, '${shift.id}')"` : '';
            const deleteBtn = canEdit ? `<button class="delete-shift-icon" onclick="deleteShiftFast(event, '${shift.id}')" title="Delete Shift"><i data-lucide="x" style="width: 12px; height: 12px;"></i></button>` : '';
            return `
                <div class="shift-card" ${draggableAttr} style="background-color: ${color}20; border-left-color: ${color}; color: ${color}" onclick="${canEdit ? `openShiftModal('${shift.id}')` : ''}; event.stopPropagation();">
                    <div class="time">${shift.start_time} - ${shift.end_time}</div>
                    <div class="worker">${name}</div>
                    ${deleteBtn}
                </div>
            `;
        };

        const amHtml = amShifts.map(renderShift).join('');
        const pmHtml = pmShifts.map(renderShift).join('');

        const clickAttr = `onclick="openShiftModal(null, '${dateStr}')"`;

        dayDiv.innerHTML = `
            <div class="calendar-day-header ${isToday ? 'today' : ''}" style="pointer-events: none;">
                <div class="day-date">${date.getDate()}</div>
            </div>
            <div class="calendar-shifts" ${clickAttr} style="cursor: pointer">
                <div class="shift-section am-section">
                    <div class="section-label">AM</div>
                    ${amHtml}
                </div>
                <div class="shift-section pm-section">
                    <div class="section-label">PM</div>
                    ${pmHtml}
                </div>
            </div>
        `;
        
        calendarGrid.appendChild(dayDiv);
    }
    lucide.createIcons();
}

// Reports
document.getElementById('generate-report-btn').addEventListener('click', renderReports);

async function renderReports() {
    const startInput = document.getElementById('report-start-date').value;
    const endInput = document.getElementById('report-end-date').value;
    
    let query = '/api/shifts?';
    if (startInput) query += `start_date=${startInput}&`;
    if (endInput) query += `end_date=${endInput}`;
    
    const reportShifts = await apiCall(query);
    
    const workerHours = {};
    workers.forEach(w => workerHours[w.id] = 0);
    
    reportShifts.forEach(shift => {
        if (!shift.start_time || !shift.end_time) return;
        
        const [startHours, startMinutes] = shift.start_time.split(':').map(Number);
        const [endHours, endMinutes] = shift.end_time.split(':').map(Number);
        
        let startDecimal = startHours + (startMinutes / 60);
        let endDecimal = endHours + (endMinutes / 60);
        
        let diff = endDecimal - startDecimal;
        if (diff < 0) diff += 24; // Handle overnight shifts
        
        if (workerHours[shift.worker_id] !== undefined) {
            workerHours[shift.worker_id] += diff;
        }
    });
    
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = '';
    
    // Add debug row
    tbody.innerHTML += `
        <tr>
            <td colspan="5" style="background: #f0f0f0; font-family: monospace; font-size: 10px;">
                Debug: Shifts fetched: ${reportShifts.length}, 
                Worker IDs in shifts: ${JSON.stringify(reportShifts.map(s => s.worker_id))}, 
                Worker IDs in workers: ${JSON.stringify(workers.map(w => w.id))},
                WorkerHours keys: ${JSON.stringify(Object.keys(workerHours))},
                WorkerHours values: ${JSON.stringify(workerHours)}
            </td>
        </tr>
    `;
    
    workers.forEach(worker => {
        const hours = workerHours[worker.id] || 0;
        const isOver = hours > worker.maxHours;
        
        tbody.innerHTML += `
            <tr>
                <td style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${worker.color}"></div>
                    ${worker.name}
                </td>
                <td>${worker.position}</td>
                <td style="font-weight: bold; color: ${isOver ? 'var(--danger)' : 'inherit'}">${hours.toFixed(1)}</td>
                <td>${worker.maxHours}</td>
                <td>
                    ${isOver ? `<span class="badge" style="background-color: rgba(239, 68, 68, 0.2); color: #f87171;">Overtime</span>` : `<span class="badge" style="background-color: rgba(34, 197, 94, 0.2); color: #4ade80;">Normal</span>`}
                </td>
            </tr>
        `;
    });
}

// Workers
document.getElementById('add-worker-btn').addEventListener('click', () => openWorkerModal());

function renderWorkers() {
    const list = document.getElementById('workers-list');
    list.innerHTML = '';
    
    workers.forEach(worker => {
        list.innerHTML += `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title" style="display: flex; align-items: center; gap: 0.5rem;">
                            <div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${worker.color}"></div>
                            ${worker.name}
                        </div>
                        <div class="card-subtitle">${worker.position}</div>
                    </div>
                </div>
                <div style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.875rem;">
                    Max Hours: ${worker.maxHours}/week
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary w-full" onclick="openWorkerModal('${worker.id}')">Edit</button>
                    <button class="btn btn-danger w-full" onclick="deleteWorker('${worker.id}')">Delete</button>
                </div>
            </div>
        `;
    });
}

// Locations
document.getElementById('add-location-btn').addEventListener('click', () => openLocationModal());

function renderLocations() {
    const list = document.getElementById('locations-list');
    list.innerHTML = '';
    
    locations.forEach(loc => {
        list.innerHTML += `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${loc.name}</div>
                        <div class="card-subtitle">${loc.address}</div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-danger w-full" onclick="deleteLocation('${loc.id}')">Delete</button>
                </div>
            </div>
        `;
    });
}

// Users
document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());

function renderUsers() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const linkedWorker = workers.find(w => w.id === user.worker_id);
        const workerName = linkedWorker ? linkedWorker.name : 'None';
        
        tbody.innerHTML += `
            <tr>
                <td>${user.email || user.username || 'N/A'}</td>
                <td><span class="badge">${user.role}</span></td>
                <td>${workerName}</td>
                <td>
                    <button class="icon-btn" onclick="openUserModal('${user.id}')" style="display: inline-flex;"><i data-lucide="edit"></i></button>
                    ${user.id !== currentUser.id ? `<button class="icon-btn" onclick="deleteUser('${user.id}')" style="display: inline-flex; color: var(--danger);"><i data-lucide="trash"></i></button>` : ''}
                </td>
            </tr>
        `;
    });
    lucide.createIcons();
}

// Modals Logic
let confirmCallback = null;
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const closeConfirmBtns = document.querySelectorAll('.close-confirm');

window.customAlert = (message) => {
    confirmMessage.textContent = message;
    confirmCallback = null;
    document.querySelector('.close-confirm').classList.add('hidden'); // Hide top X
    document.querySelector('.close-confirm.btn-secondary').classList.add('hidden'); // Hide cancel
    confirmYesBtn.textContent = 'OK';
    
    modalOverlay.classList.remove('hidden');
    confirmModal.classList.remove('hidden');
    confirmModal.style.zIndex = '200';
    modalOverlay.style.zIndex = '199';
};

window.customConfirm = (message, callback) => {
    confirmMessage.textContent = message;
    confirmCallback = callback;
    document.querySelector('.close-confirm').classList.remove('hidden');
    document.querySelector('.close-confirm.btn-secondary').classList.remove('hidden');
    confirmYesBtn.textContent = 'Confirm';
    
    modalOverlay.classList.remove('hidden');
    confirmModal.classList.remove('hidden');
    confirmModal.style.zIndex = '200';
    modalOverlay.style.zIndex = '199';
};

window.closeCustomConfirm = () => {
    confirmModal.classList.add('hidden');
    if (document.querySelectorAll('.modal:not(.hidden)').length === 0) {
        modalOverlay.classList.add('hidden');
    }
    modalOverlay.style.zIndex = '100';
    confirmCallback = null;
};

closeConfirmBtns.forEach(btn => btn.addEventListener('click', closeCustomConfirm));
confirmYesBtn.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeCustomConfirm();
});

function openModal(modal) {
    modalOverlay.classList.remove('hidden');
    modal.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    shiftModal.classList.add('hidden');
    workerModal.classList.add('hidden');
    locationModal.classList.add('hidden');
    userModal.classList.add('hidden');
}

closeModals.forEach(btn => btn.addEventListener('click', closeModal));
modalOverlay.addEventListener('click', closeModal);

// Shift Modal
function openShiftModal(shiftId = null, date = null) {
    const workerSelect = document.getElementById('shift-worker');
    const isAdmin = currentUser.role === 'boss' || currentUser.role === 'manager';
    
    if (isAdmin) {
        workerSelect.innerHTML = workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        workerSelect.disabled = false;
    } else {
        const myWorker = workers.find(w => w.id === currentUser.worker_id);
        if (myWorker) {
            workerSelect.innerHTML = `<option value="${myWorker.id}">${myWorker.name}</option>`;
        } else {
            workerSelect.innerHTML = `<option value="">No worker assigned</option>`;
        }
        // If not admin, they can only assign themselves
        workerSelect.disabled = true;
    }
    
    if (shiftId) {
        const shift = shifts.find(s => s.id === shiftId);
        document.getElementById('shift-modal-title').textContent = 'Edit Shift';
        document.getElementById('shift-id').value = shift.id;
        document.getElementById('shift-date').value = shift.date;
        document.getElementById('shift-worker').value = shift.worker_id;
        document.getElementById('shift-start').value = shift.start_time;
        document.getElementById('shift-end').value = shift.end_time;
        document.getElementById('shift-notes').value = shift.notes || '';
        deleteShiftBtn.classList.remove('hidden');
    } else {
        document.getElementById('shift-modal-title').textContent = 'Add Shift';
        shiftForm.reset();
        document.getElementById('shift-id').value = '';
        document.getElementById('shift-date').value = date;
        deleteShiftBtn.classList.add('hidden');
    }
    openModal(shiftModal);
}

shiftForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('shift-id').value;
    const data = {
        location_id: locationSelect.value,
        worker_id: document.getElementById('shift-worker').value,
        date: document.getElementById('shift-date').value,
        start_time: document.getElementById('shift-start').value,
        end_time: document.getElementById('shift-end').value,
        notes: document.getElementById('shift-notes').value
    };

    if (id) {
        await apiCall(`/api/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
        await apiCall('/api/shifts', { method: 'POST', body: JSON.stringify(data) });
    }
    
    closeModal();
    await loadShifts();
    renderCalendar();
});

deleteShiftBtn.addEventListener('click', async () => {
    const id = document.getElementById('shift-id').value;
    customConfirm('Are you sure you want to delete this shift?', async () => {
        await apiCall(`/api/shifts/${id}`, { method: 'DELETE' });
        closeModal();
        await loadShifts();
        renderCalendar();
    });
});

// Worker Modal
function openWorkerModal(workerId = null) {
    if (workerId) {
        const worker = workers.find(w => w.id === workerId);
        document.getElementById('worker-modal-title').textContent = 'Edit Worker';
        document.getElementById('worker-id').value = worker.id;
        document.getElementById('worker-name').value = worker.name;
        document.getElementById('worker-position').value = worker.position;
        document.getElementById('worker-color').value = worker.color;
        document.getElementById('worker-max-hours').value = worker.maxHours;
    } else {
        document.getElementById('worker-modal-title').textContent = 'Add Worker';
        workerForm.reset();
        document.getElementById('worker-id').value = '';
        document.getElementById('worker-color').value = '#' + Math.floor(Math.random()*16777215).toString(16);
    }
    openModal(workerModal);
}

workerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('worker-id').value;
    const data = {
        name: document.getElementById('worker-name').value,
        position: document.getElementById('worker-position').value,
        color: document.getElementById('worker-color').value,
        maxHours: parseInt(document.getElementById('worker-max-hours').value)
    };

    if (id) {
        await apiCall(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
        await apiCall('/api/workers', { method: 'POST', body: JSON.stringify(data) });
    }
    
    closeModal();
    workers = await apiCall('/api/workers');
    renderWorkers();
    if (document.getElementById('tab-calendar').classList.contains('active')) renderCalendar();
});

async function deleteWorker(id) {
    customConfirm('Are you sure? This will delete all shifts for this worker.', async () => {
        await apiCall(`/api/workers/${id}`, { method: 'DELETE' });
        workers = await apiCall('/api/workers');
        renderWorkers();
    });
}

// Location Modal
function openLocationModal() {
    locationForm.reset();
    openModal(locationModal);
}

locationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('location-name').value,
        address: document.getElementById('location-address').value
    };

    await apiCall('/api/locations', { method: 'POST', body: JSON.stringify(data) });
    closeModal();
    locations = await apiCall('/api/locations');
    updateLocationSelects();
    renderLocations();
});

async function deleteLocation(id) {
    customConfirm('Are you sure? This will delete all shifts for this location.', async () => {
        await apiCall(`/api/locations/${id}`, { method: 'DELETE' });
        locations = await apiCall('/api/locations');
        updateLocationSelects();
        renderLocations();
    });
}

// User Modal
function openUserModal(userId = null) {
    const workerSelect = document.getElementById('user-worker-id');
    workerSelect.innerHTML = '<option value="">None</option>' + workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    
    if (userId) {
        const user = users.find(u => u.id === userId);
        document.getElementById('user-modal-title').textContent = 'Edit User';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-email').value = user.email || user.username || '';
        document.getElementById('user-role').value = user.role;
        document.getElementById('user-worker-id').value = user.worker_id || '';
    } else {
        document.getElementById('user-modal-title').textContent = 'Add User';
        userForm.reset();
        document.getElementById('user-id').value = '';
    }
    openModal(userModal);
}

userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const data = {
        email: document.getElementById('user-email').value,
        role: document.getElementById('user-role').value,
        worker_id: document.getElementById('user-worker-id').value || null
    };

    if (id) {
        await apiCall(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        if (currentUser && currentUser.id === id) {
            currentUser = { ...currentUser, ...data };
        }
    } else {
        // For new users, we can't create Auth accounts from client without Admin SDK,
        // but we can create the user document so they have roles when they sign in.
        // We'll use their email as the document ID for simplicity, or let Firestore generate one.
        // Actually, since we need their UID, we should just let Firestore generate an ID,
        // and when they sign in, we can link it if needed.
        // Wait, checkAuth uses user.uid. If we create a document with a random ID, it won't match.
        // So we should use the email as the document ID for users?
        // Let's just create a document. The checkAuth logic creates a new profile if it doesn't exist.
        // If an admin creates a user, they are pre-registering them.
        // Let's use the email as the document ID to make it easy to find.
        await apiCall('/api/users', { method: 'POST', body: JSON.stringify(data) });
    }
    
    closeModal();
    users = await apiCall('/api/users');
    renderUsers();
});

async function deleteUser(id) {
    customConfirm('Are you sure you want to delete this user?', async () => {
        await apiCall(`/api/users/${id}`, { method: 'DELETE' });
        users = await apiCall('/api/users');
        renderUsers();
    });
}

function setupEventListeners() {
    // Set default dates for report
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    document.getElementById('report-start-date').value = lastWeek.toISOString().split('T')[0];
    document.getElementById('report-end-date').value = today.toISOString().split('T')[0];
}

// Start
init();

// Expose functions to window for inline HTML handlers
window.openShiftModal = openShiftModal;
window.openWorkerModal = openWorkerModal;
window.deleteWorker = deleteWorker;
window.deleteLocation = deleteLocation;
window.openUserModal = openUserModal;
window.deleteUser = deleteUser;
