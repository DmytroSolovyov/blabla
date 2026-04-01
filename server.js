import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDB() {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      worker_id INTEGER,
      FOREIGN KEY(worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      color TEXT NOT NULL,
      maxHours INTEGER NOT NULL DEFAULT 40
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      worker_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY(location_id) REFERENCES locations(id),
      FOREIGN KEY(worker_id) REFERENCES workers(id)
    );
  `);

  // Create default admin if not exists
  const admin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!admin) {
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', 'admin', 'boss']);
  }
}

// Middleware to check auth
const requireAuth = async (req, res, next) => {
  const userId = req.cookies.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await db.get('SELECT id, username, role, worker_id FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'boss' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Auth API
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (user) {
    res.cookie('userId', user.id, { httpOnly: true });
    res.json({ id: user.id, username: user.username, role: user.role, worker_id: user.worker_id });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('userId');
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// Users API
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await db.all('SELECT id, username, role, worker_id FROM users');
  res.json(users);
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role, worker_id } = req.body;
  try {
    const result = await db.run(
      'INSERT INTO users (username, password, role, worker_id) VALUES (?, ?, ?, ?)',
      [username, password, role, worker_id || null]
    );
    res.json({ id: result.lastID, username, role, worker_id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role, worker_id } = req.body;
  try {
    if (password) {
      await db.run(
        'UPDATE users SET username = ?, password = ?, role = ?, worker_id = ? WHERE id = ?',
        [username, password, role, worker_id || null, req.params.id]
      );
    } else {
      await db.run(
        'UPDATE users SET username = ?, role = ?, worker_id = ? WHERE id = ?',
        [username, role, worker_id || null, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id == req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// Workers API
app.get('/api/workers', requireAuth, async (req, res) => {
  const workers = await db.all('SELECT * FROM workers');
  res.json(workers);
});

app.post('/api/workers', requireAuth, requireAdmin, async (req, res) => {
  const { name, position, color, maxHours } = req.body;
  const result = await db.run(
    'INSERT INTO workers (name, position, color, maxHours) VALUES (?, ?, ?, ?)',
    [name, position, color, maxHours || 40]
  );
  res.json({ id: result.lastID, name, position, color, maxHours });
});

app.put('/api/workers/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, position, color, maxHours } = req.body;
  await db.run(
    'UPDATE workers SET name = ?, position = ?, color = ?, maxHours = ? WHERE id = ?',
    [name, position, color, maxHours || 40, req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/workers/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM workers WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// Locations API
app.get('/api/locations', requireAuth, async (req, res) => {
  const locations = await db.all('SELECT * FROM locations');
  res.json(locations);
});

app.post('/api/locations', requireAuth, requireAdmin, async (req, res) => {
  const { name, address } = req.body;
  const result = await db.run('INSERT INTO locations (name, address) VALUES (?, ?)', [name, address]);
  res.json({ id: result.lastID, name, address });
});

app.delete('/api/locations/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM locations WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// Shifts API
app.get('/api/shifts', requireAuth, async (req, res) => {
  const { location_id, start_date, end_date } = req.query;
  let query = 'SELECT * FROM shifts WHERE 1=1';
  const params = [];
  if (location_id) {
    query += ' AND location_id = ?';
    params.push(location_id);
  }
  if (start_date) {
    query += ' AND date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND date <= ?';
    params.push(end_date);
  }
  const shifts = await db.all(query, params);
  res.json(shifts);
});

app.post('/api/shifts', requireAuth, async (req, res) => {
  const { location_id, worker_id, date, start_time, end_time, notes } = req.body;
  if (req.user.role !== 'boss' && req.user.role !== 'manager') {
    if (req.user.worker_id !== parseInt(worker_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const result = await db.run(
    'INSERT INTO shifts (location_id, worker_id, date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [location_id, worker_id, date, start_time, end_time, notes || '']
  );
  res.json({ id: result.lastID, location_id, worker_id, date, start_time, end_time, notes });
});

app.put('/api/shifts/:id', requireAuth, async (req, res) => {
  const { location_id, worker_id, date, start_time, end_time, notes } = req.body;
  if (req.user.role !== 'boss' && req.user.role !== 'manager') {
    const existingShift = await db.get('SELECT worker_id FROM shifts WHERE id = ?', [req.params.id]);
    if (!existingShift || existingShift.worker_id !== req.user.worker_id || parseInt(worker_id) !== req.user.worker_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  await db.run(
    'UPDATE shifts SET location_id = ?, worker_id = ?, date = ?, start_time = ?, end_time = ?, notes = ? WHERE id = ?',
    [location_id, worker_id, date, start_time, end_time, notes || '', req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/shifts/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'boss' && req.user.role !== 'manager') {
    const existingShift = await db.get('SELECT worker_id FROM shifts WHERE id = ?', [req.params.id]);
    if (!existingShift || existingShift.worker_id !== req.user.worker_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  await db.run('DELETE FROM shifts WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// Fallback to index.html for SPA routing if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
