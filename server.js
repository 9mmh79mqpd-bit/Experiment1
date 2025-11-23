const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const { v4: uuidv4 } = require('uuid');

const DB_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple file-backed DB
function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// API: get all todos
app.get('/api/todos', (req, res) => {
  const todos = readDB();
  res.json(todos);
});

// API: create todo
app.post('/api/todos', (req, res) => {
  const { title, notes, due } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const todo = {
    id: uuidv4(),
    title,
    notes: notes || '',
    due: due || null,          // ISO date string or null
    done: false,
    reminded: false,          // whether reminder was already fired
    createdAt: new Date().toISOString()
  };
  const todos = readDB();
  todos.push(todo);
  writeDB(todos);
  res.status(201).json(todo);
});

// API: update todo
app.put('/api/todos/:id', (req, res) => {
  const id = req.params.id;
  const todos = readDB();
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const updated = Object.assign(todos[idx], req.body);
  todos[idx] = updated;
  writeDB(todos);
  res.json(updated);
});

// API: delete
app.delete('/api/todos/:id', (req, res) => {
  const id = req.params.id;
  let todos = readDB();
  const before = todos.length;
  todos = todos.filter(t => t.id !== id);
  writeDB(todos);
  res.json({ deleted: before - todos.length });
});

// API: export single todo as .ics (calendar event)
app.get('/api/todos/:id/ics', (req, res) => {
  const id = req.params.id;
  const todos = readDB();
  const t = todos.find(x => x.id === id);
  if (!t) return res.status(404).send('Not found');
  // If no due date -> not exportable
  if (!t.due) return res.status(400).send('No due date set');

  const dt = new Date(t.due);
  const dtStart = dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `${t.id}@todo-reminder-app`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//todo-reminder-app//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${(new Date()).toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
    `DTSTART:${dtStart}`,
    `SUMMARY:${escapeICSText(t.title)}`,
    `DESCRIPTION:${escapeICSText(t.notes || '')}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  res.setHeader('Content-disposition', `attachment; filename=todo-${t.id}.ics`);
  res.setHeader('Content-type', 'text/calendar');
  res.send(ics);
});

function escapeICSText(s) {
  return (s || '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
}

// Scheduled checker to mark reminders and log to console (or integrate with e.g. email)
function checkReminders() {
  const todos = readDB();
  const now = new Date();
  let changed = false;
  todos.forEach(t => {
    if (t.due && !t.reminded && !t.done) {
      const due = new Date(t.due);
      // if due time is in the past or within next minute -> mark reminder
      if (due <= now) {
        console.log(`[REMINDER] ${t.title} (due ${t.due})`);
        t.reminded = true;
        changed = true;
      }
    }
  });
  if (changed) writeDB(todos);
}
// run every minute
schedule.scheduleJob('* * * * *', checkReminders);

// Ensure DB exists
if (!fs.existsSync(DB_FILE)) {
  writeDB([]);
}

app.get('*', (req, res) => {
  // Serve frontend for any other route (SPA)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
