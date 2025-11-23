// frontend logic: simple SPA
const api = (path, opts) => fetch(path, opts).then(r => {
  if (!r.ok) throw new Error('API error ' + r.status);
  return r.json ? r.json() : r.text();
});

const $ = id => document.getElementById(id);
const todoList = $('todoList');
const remindersList = $('reminders');
const calendarDiv = $('calendar');

async function fetchTodos() {
  const res = await fetch('/api/todos');
  const todos = await res.json();
  return todos.sort((a,b) => (a.due||'').localeCompare(b.due||''));
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString();
}

function createTodoItemEl(t) {
  const li = document.createElement('li');
  const left = document.createElement('div');
  left.style.flex = '1';
  const title = document.createElement('div');
  title.textContent = t.title;
  if (t.done) title.classList.add('completed');
  left.appendChild(title);
  const meta = document.createElement('div');
  meta.className = 'small';
  meta.innerText = (t.due ? `due: ${formatDate(t.due)} ` : '') + (t.reminded ? ' • reminded' : '');
  left.appendChild(meta);

  const actions = document.createElement('div');
  const toggle = document.createElement('button');
  toggle.textContent = t.done ? 'Undone' : 'Done';
  toggle.onclick = async () => {
    await fetch('/api/todos/' + t.id, {
      method: 'PUT',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({ done: !t.done })
    });
    load();
  };
  const del = document.createElement('button');
  del.textContent = 'Delete';
  del.onclick = async () => {
    await fetch('/api/todos/' + t.id, { method: 'DELETE' });
    load();
  };
  const ics = document.createElement('button');
  ics.textContent = 'Export .ics';
  ics.onclick = () => {
    if (!t.due) { alert('Set a due date to export'); return; }
    window.location = '/api/todos/' + t.id + '/ics';
  };

  actions.appendChild(toggle);
  actions.appendChild(ics);
  actions.appendChild(del);

  li.appendChild(left);
  li.appendChild(actions);
  return li;
}

async function load() {
  const todos = await fetchTodos();
  todoList.innerHTML = '';
  remindersList.innerHTML = '';
  calendarDiv.innerHTML = '';

  const now = new Date();

  // Todo list
  todos.forEach(t => {
    todoList.appendChild(createTodoItemEl(t));
  });

  // Upcoming reminders (next 7 days)
  const upcoming = todos.filter(t => t.due && !t.done).sort((a,b)=>new Date(a.due)-new Date(b.due));
  upcoming.slice(0, 10).forEach(t => {
    const li = document.createElement('li');
    li.textContent = `${t.title} — ${formatDate(t.due)}${t.reminded ? ' (reminded)' : ''}`;
    // add notify button (client-side)
    const btn = document.createElement('button');
    btn.textContent = 'Notify now';
    btn.onclick = () => {
      notifyBrowser(t);
    };
    li.appendChild(btn);
    remindersList.appendChild(li);
  });

  // Calendar: grouped by date
  const groups = {};
  todos.forEach(t => {
    if (!t.due) return;
    const d = new Date(t.due);
    const key = d.toISOString().slice(0,10);
    groups[key] = groups[key] || [];
    groups[key].push(t);
  });
  const keys = Object.keys(groups).sort();
  if (keys.length === 0) {
    calendarDiv.innerText = 'No events. Use "due" field to add reminders.';
  } else {
    keys.forEach(k => {
      const dateDiv = document.createElement('div');
      const header = document.createElement('strong');
      header.textContent = new Date(k).toDateString();
      dateDiv.appendChild(header);
      const ul = document.createElement('ul');
      groups[k].forEach(t => {
        const li = document.createElement('li');
        li.textContent = `${t.title} — ${new Date(t.due).toLocaleTimeString()}`;
        ul.appendChild(li);
      });
      dateDiv.appendChild(ul);
      calendarDiv.appendChild(dateDiv);
    });
  }
}

// Client-side browser notification (will only work if user grants permission)
function notifyBrowser(todo) {
  if (!('Notification' in window)) {
    alert('Notifications not supported here.');
    return;
  }
  if (Notification.permission === 'granted') {
    new Notification(todo.title, { body: todo.notes || 'Reminder', tag: todo.id });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(todo.title, { body: todo.notes || 'Reminder', tag: todo.id });
    });
  }
}

// Add new todo
$('addBtn').onclick = async () => {
  const title = $('title').value.trim();
  const notes = $('notes').value.trim();
  const due = $('due').value ? new Date($('due').value).toISOString() : null;
  if (!title) { alert('Add a title'); return; }
  await fetch('/api/todos', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({ title, notes, due })
  });
  $('title').value = '';
  $('notes').value = '';
  $('due').value = '';
  load();
};

// Auto-refresh and check for reminders (client-side polling)
setInterval(async () => {
  const todos = await fetchTodos();
  // notify for any todo that is due and not reminded (client-side)
  todos.forEach(t => {
    if (t.due && !t.reminded && !t.done && new Date(t.due) <= new Date()) {
      notifyBrowser(t);
      // optimistically mark reminded on server
      fetch('/api/todos/' + t.id, {
        method: 'PUT',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({ reminded: true })
      });
    }
  });
  load();
}, 60 * 1000);

window.addEventListener('load', () => {
  load();
});
