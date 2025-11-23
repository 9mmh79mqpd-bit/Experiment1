const $ = id => document.getElementById(id);
const todoList = $('todoList');
const remindersList = $('reminders');
const calendarDiv = $('calendar');

// --- API helper ---
async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error('API error ' + res.status);
  return res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text();
}

// --- Fetch todos ---
async function fetchTodos() {
  const res = await fetch('/api/todos');
  const todos = await res.json();
  return todos.sort((a,b) => (a.due||'').localeCompare(b.due||''));
}

// --- Format date ---
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString();
}

// --- Browser notifications ---
function notifyBrowser(todo) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(todo.title, { body: todo.notes || 'Reminder', tag: todo.id });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(todo.title, { body: todo.notes || 'Reminder', tag: todo.id });
    });
  }
}

// --- Create todo item element ---
function createTodoItemEl(t) {
  const li = document.createElement('li');
  const left = document.createElement('div'); left.style.flex='1';
  const title = document.createElement('div'); title.textContent=t.title;
  if(t.done) title.classList.add('completed');
  left.appendChild(title);
  const meta = document.createElement('div'); meta.className='small';
  meta.innerText = (t.due?`due: ${formatDate(t.due)} `:'') + (t.reminded?'• reminded':'');
  left.appendChild(meta);

  const actions = document.createElement('div');
  const toggle = document.createElement('button'); toggle.textContent=t.done?'Undone':'Done';
  toggle.onclick = async()=>{ await fetch('/api/todos/'+t.id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({done:!t.done})}); load(); };
  const del = document.createElement('button'); del.textContent='Delete';
  del.onclick=async()=>{ await fetch('/api/todos/'+t.id,{method:'DELETE'}); load(); };
  const ics = document.createElement('button'); ics.textContent='Export .ics';
  ics.onclick = ()=>{ if(!t.due){alert('Set a due date'); return;} window.location='/api/todos/'+t.id+'/ics'; };
  actions.appendChild(toggle); actions.appendChild(ics); actions.appendChild(del);

  li.appendChild(left); li.appendChild(actions);
  return li;
}

// --- Load todos ---
async function load() {
  const todos = await fetchTodos();
  todoList.innerHTML=''; remindersList.innerHTML=''; calendarDiv.innerHTML='';

  const now = new Date();

  todos.forEach(t=>todoList.appendChild(createTodoItemEl(t)));

  const upcoming = todos.filter(t=>t.due&&!t.done).sort((a,b)=>new Date(a.due)-new Date(b.due));
  upcoming.slice(0,10).forEach(t=>{
    const li = document.createElement('li'); li.textContent=`${t.title} — ${formatDate(t.due)}${t.reminded?' (reminded)':''}`;
    const btn = document.createElement('button'); btn.textContent='Notify now'; btn.onclick=()=>notifyBrowser(t);
    li.appendChild(btn);
    remindersList.appendChild(li);
  });

  // Calendar grouping
  const groups = {};
  todos.forEach(t=>{if(!t.due) return; const d=new Date(t.due); const key=d.toISOString().slice(0,10); groups[key]=groups[key]||[]; groups[key].push(t);});
  const keys=Object.keys(groups).sort();
  if(keys.length===0){calendarDiv.innerText='No events. Use "due" to add reminders.';} else{
    keys.forEach(k=>{
      const dateDiv=document.createElement('div');
      const header=document.createElement('strong'); header.textContent=new Date(k).toDateString(); dateDiv.appendChild(header);
      const ul=document.createElement('ul'); groups[k].forEach(t=>{const li=document.createElement('li'); li.textContent=`${t.title} — ${new Date(t.due).toLocaleTimeString()}`; ul.appendChild(li);});
      dateDiv.appendChild(ul); calendarDiv.appendChild(dateDiv);
    });
  }
}

// --- Add new todo ---
$('addBtn').onclick = async()=>{
  const title=$('title').value.trim(), notes=$('notes').value.trim(), due=$('due').value?new Date($('due').value).toISOString():null;
  if(!title){alert('Add a title'); return;}
  await fetch('/api/todos',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,notes,due})});
  $('title').value=''; $('notes').value=''; $('due').value=''; load();
};

// --- Auto-refresh & reminders every minute ---
setInterval(async()=>{
  const todos = await fetchTodos();
  todos.forEach(t=>{if(t.due&&!t.reminded&&!t.done&&new Date(t.due)<=new Date()){notifyBrowser(t); fetch('/api/todos/'+t.id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({reminded:true})});}});
  load();
},60*1000);

window.addEventListener('load',()=>{ load(); });

// --- Dark mode toggle ---
$('darkModeBtn').onclick = () => document.body.classList.toggle('dark');

// --- Make todos sortable (drag & drop) ---
new Sortable(todoList, { animation: 150 });
