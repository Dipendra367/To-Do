/* ============================================================
   TaskFlow — Full-Featured To-Do App Engine
   Features: LocalStorage, Dark/Light, Categories, Priorities,
             Due Dates, Search, Filter, Sort, Subtasks,
             Inline Edit, Drag & Drop, Confetti, Toast, Modal
   ============================================================ */

'use strict';

/* ── State ── */
let tasks        = [];
let activeFilter = 'all';
let activeCat    = 'all';
let activeSort   = 'created';
let searchQuery  = '';
let dragSrcIndex = null;
let modalResolve = null;

const STORAGE_KEY = 'taskflow_tasks_v2';

/* ── DOM References ── */
const taskInput    = document.getElementById('taskInput');
const taskNote     = document.getElementById('taskNote');
const taskCategory = document.getElementById('taskCategory');
const taskPriority = document.getElementById('taskPriority');
const taskDue      = document.getElementById('taskDue');
const addBtn       = document.getElementById('addBtn');
const taskList     = document.getElementById('taskList');
const emptyState   = document.getElementById('emptyState');
const searchInput  = document.getElementById('searchInput');
const sortSelect   = document.getElementById('sortSelect');
const themeToggle  = document.getElementById('themeToggle');
const clearAllBtn  = document.getElementById('clearAllBtn');
const toggleFormBtn= document.getElementById('toggleFormBtn');
const addForm      = document.getElementById('addForm');
const toast        = document.getElementById('toast');
const modal        = document.getElementById('modal');
const modalMsg     = document.getElementById('modalMsg');
const modalCancel  = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');

/* ============================================================
   PERSISTENCE
   ============================================================ */
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
  // Seed with sample tasks if empty
  if (tasks.length === 0) seedSampleTasks();
}

function seedSampleTasks() {
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  const past  = new Date(today); past.setDate(today.getDate() - 2);
  const soon  = new Date(today); soon.setDate(today.getDate() + 1);
  const future= new Date(today); future.setDate(today.getDate() + 5);

  tasks = [
    makeTask('Finish project report',    'work',     'high',   fmt(past),   false, 'Add charts and executive summary', []),
    makeTask('Morning workout',           'health',   'high',   fmt(today),  false, '30 min run + stretching', [
      { id: uid(), text: 'Warm-up 5 min', done: true },
      { id: uid(), text: '5km run',       done: false },
      { id: uid(), text: 'Cool-down',     done: false },
    ]),
    makeTask('Buy groceries',             'shopping', 'medium', fmt(soon),   false, 'Milk, eggs, bread, fruits', []),
    makeTask('Read "Atomic Habits"',      'learning', 'low',    fmt(future), false, 'Chapter 5-8 today', []),
    makeTask('Call mom',                  'personal', 'medium', '',          true,  '', []),
  ];
  saveTasks();
}

function makeTask(title, category, priority, due, done, note, subtasks) {
  return {
    id: uid(), title, category, priority, due,
    done, note, subtasks: subtasks || [],
    createdAt: Date.now(),
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ============================================================
   THEME
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem('taskflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('taskflow_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '🌙' : '☀️';
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function showToast(msg, type = 'info') {
  clearTimeout(toastTimer);
  toast.textContent  = msg;
  toast.className    = `toast ${type} show`;
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}

/* ============================================================
   MODAL (Promise-based)
   ============================================================ */
function confirm(msg) {
  return new Promise(resolve => {
    modalMsg.textContent = msg;
    modal.classList.remove('hidden');
    modalResolve = resolve;
  });
}

modalConfirm.addEventListener('click', () => {
  modal.classList.add('hidden');
  if (modalResolve) modalResolve(true);
});

modalCancel.addEventListener('click', () => {
  modal.classList.add('hidden');
  if (modalResolve) modalResolve(false);
});

modal.addEventListener('click', e => {
  if (e.target === modal) {
    modal.classList.add('hidden');
    if (modalResolve) modalResolve(false);
  }
});

/* ============================================================
   DASHBOARD STATS
   ============================================================ */
function updateDashboard() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  const pending = total - done;
  const pct     = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('totalCount').textContent   = total;
  document.getElementById('doneCount').textContent    = done;
  document.getElementById('overdueCount').textContent = overdue;
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent= pct + '% complete';
}

/* ============================================================
   DATE HELPERS
   ============================================================ */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function isOverdue(task) {
  return !task.done && task.due && task.due < todayStr();
}

function isToday(task) {
  return task.due === todayStr();
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
}

/* ============================================================
   FILTERING & SORTING
   ============================================================ */
function getFilteredTasks() {
  let list = [...tasks];

  // Status filter
  if (activeFilter === 'pending') list = list.filter(t => !t.done);
  if (activeFilter === 'done')    list = list.filter(t => t.done);
  if (activeFilter === 'overdue') list = list.filter(t => isOverdue(t));

  // Category filter
  if (activeCat !== 'all') list = list.filter(t => t.category === activeCat);

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.note && t.note.toLowerCase().includes(q))
    );
  }

  // Sort
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  if (activeSort === 'priority') {
    list.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  } else if (activeSort === 'due') {
    list.sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });
  } else if (activeSort === 'alpha') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // created (default) — keep original index order from tasks[]
    list.sort((a, b) => a.createdAt - b.createdAt);
  }

  return list;
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  updateDashboard();
  const filtered = getFilteredTasks();
  taskList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach((task, idx) => {
    const li = buildTaskElement(task, idx);
    taskList.appendChild(li);
  });
}

function buildTaskElement(task, idx) {
  const overdue = isOverdue(task);
  const today   = isToday(task);

  const li = document.createElement('li');
  li.className   = `task-item${task.done ? ' done' : ''}${overdue ? ' overdue' : ''}`;
  li.dataset.id  = task.id;
  li.dataset.priority = task.priority;
  li.draggable   = true;

  /* ── TOP ROW ── */
  const topRow = document.createElement('div');
  topRow.className = 'task-top';

  // Checkbox
  const checkbox = document.createElement('div');
  checkbox.className = 'task-checkbox';
  checkbox.setAttribute('role', 'checkbox');
  checkbox.setAttribute('aria-checked', task.done ? 'true' : 'false');
  checkbox.setAttribute('tabindex', '0');
  checkbox.title = task.done ? 'Mark incomplete' : 'Mark complete';
  checkbox.addEventListener('click', () => toggleDone(task.id));
  checkbox.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleDone(task.id); } });

  // Body
  const body = document.createElement('div');
  body.className = 'task-body';

  const titleEl = document.createElement('div');
  titleEl.className = 'task-title';
  titleEl.textContent = task.title;

  body.appendChild(titleEl);

  if (task.note) {
    const noteEl = document.createElement('div');
    noteEl.className = 'task-note';
    noteEl.textContent = '📝 ' + task.note;
    body.appendChild(noteEl);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = makeTaskBtn('✏️', 'edit-btn', 'Edit task', () => startInlineEdit(task.id, titleEl));
  const delBtn  = makeTaskBtn('🗑️', 'delete-btn', 'Delete task', () => deleteTask(task.id));

  actions.append(editBtn, delBtn);
  topRow.append(checkbox, body, actions);

  /* ── META ROW ── */
  const meta = document.createElement('div');
  meta.className = 'task-meta';

  // Priority badge
  const priLabel = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
  const priBadge = makeBadge(priLabel[task.priority], `badge badge-priority-${task.priority}`);
  meta.appendChild(priBadge);

  // Category badge
  const catLabel = { personal:'🏠 Personal', work:'💼 Work', health:'💪 Health', shopping:'🛒 Shopping', learning:'📚 Learning', other:'🎯 Other' };
  const catBadge = makeBadge(catLabel[task.category] || task.category, 'badge badge-cat');
  meta.appendChild(catBadge);

  // Due date badge
  if (task.due) {
    let dueClass = 'badge badge-due';
    let dueText  = '📅 ' + formatDate(task.due);
    if (overdue) { dueClass += ' overdue-badge'; dueText = '⚠️ Overdue · ' + formatDate(task.due); }
    else if (today) { dueClass += ' today-badge'; dueText = '🔔 Today · ' + formatDate(task.due); }
    meta.appendChild(makeBadge(dueText, dueClass));
  }

  /* ── SUBTASKS ── */
  const subtasksWrap = buildSubtasksSection(task);

  li.append(topRow, meta, subtasksWrap);

  /* ── DRAG & DROP ── */
  li.addEventListener('dragstart', e => {
    dragSrcIndex = tasks.findIndex(t => t.id === task.id);
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
  });
  li.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    li.classList.add('drag-over');
  });
  li.addEventListener('drop', e => {
    e.preventDefault();
    const targetId  = task.id;
    const targetIdx = tasks.findIndex(t => t.id === targetId);
    if (dragSrcIndex === null || dragSrcIndex === targetIdx) return;
    const [moved] = tasks.splice(dragSrcIndex, 1);
    tasks.splice(targetIdx, 0, moved);
    dragSrcIndex = null;
    saveTasks();
    render();
  });

  return li;
}

function makeTaskBtn(icon, cls, title, handler) {
  const btn = document.createElement('button');
  btn.className = `task-btn ${cls}`;
  btn.textContent = icon;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.addEventListener('click', handler);
  return btn;
}

function makeBadge(text, cls) {
  const span = document.createElement('span');
  span.className = cls;
  span.textContent = text;
  return span;
}

/* ── Subtasks ── */
function buildSubtasksSection(task) {
  const wrap = document.createElement('div');
  wrap.className = 'subtasks-wrap';

  // Add subtask input row
  const addRow = document.createElement('div');
  addRow.className = 'subtask-add-row';

  const si = document.createElement('input');
  si.type = 'text'; si.className = 'subtask-input';
  si.placeholder = '+ Add subtask…'; si.maxLength = 80;
  si.setAttribute('aria-label', 'Add subtask');

  const sb = document.createElement('button');
  sb.className = 'subtask-add-btn'; sb.textContent = '+';
  sb.setAttribute('aria-label', 'Add subtask');

  const addSub = () => {
    const text = si.value.trim();
    if (!text) return;
    task.subtasks.push({ id: uid(), text, done: false });
    si.value = '';
    saveTasks();
    render();
  };
  sb.addEventListener('click', addSub);
  si.addEventListener('keydown', e => { if (e.key === 'Enter') addSub(); });
  addRow.append(si, sb);

  // Subtask list
  const ul = document.createElement('ul');
  ul.className = 'subtask-list';

  (task.subtasks || []).forEach(sub => {
    const li = document.createElement('li');
    li.className = 'subtask-item';

    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.className = 'subtask-check';
    chk.checked = sub.done;
    chk.setAttribute('aria-label', sub.text);
    chk.addEventListener('change', () => {
      sub.done = chk.checked;
      saveTasks();
      updateDashboard();
    });

    const lbl = document.createElement('span');
    lbl.textContent = sub.text;
    if (sub.done) lbl.className = 'subtask-text-done';

    const del = document.createElement('button');
    del.className = 'subtask-del'; del.textContent = '✕';
    del.setAttribute('aria-label', 'Delete subtask');
    del.addEventListener('click', () => {
      task.subtasks = task.subtasks.filter(s => s.id !== sub.id);
      saveTasks(); render();
    });

    li.append(chk, lbl, del);
    ul.appendChild(li);
  });

  wrap.append(addRow, ul);
  return wrap;
}

/* ============================================================
   TASK ACTIONS
   ============================================================ */
function addTask() {
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    taskInput.classList.add('pop');
    setTimeout(() => taskInput.classList.remove('pop'), 400);
    showToast('Please enter a task title!', 'error');
    return;
  }

  const task = makeTask(
    title,
    taskCategory.value,
    taskPriority.value,
    taskDue.value,
    false,
    taskNote.value.trim(),
    []
  );

  tasks.unshift(task);
  saveTasks();
  render();

  taskInput.value = '';
  taskNote.value  = '';
  taskDue.value   = '';
  taskInput.focus();

  showToast('✅ Task added!', 'success');
  triggerConfetti();
}

function toggleDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveTasks();
  render();
  showToast(task.done ? '🎉 Task completed!' : '↩️ Marked incomplete', task.done ? 'success' : 'info');
  if (task.done) triggerConfetti();
}

async function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const ok = await confirm(`Delete "${task.title}"?`);
  if (!ok) return;
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
  showToast('🗑️ Task deleted', 'info');
}

function startInlineEdit(id, titleEl) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const input = document.createElement('input');
  input.type  = 'text';
  input.className = 'task-edit-input';
  input.value = task.title;
  input.setAttribute('aria-label', 'Edit task title');

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const save = () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== task.title) {
      task.title = newTitle;
      saveTasks();
      showToast('✏️ Task updated', 'info');
    }
    render();
  };

  input.addEventListener('blur',    save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { render(); }
  });
}

async function clearAll() {
  if (tasks.length === 0) { showToast('Nothing to clear!', 'info'); return; }
  const ok = await confirm(`Clear all ${tasks.length} task(s)? This cannot be undone.`);
  if (!ok) return;
  tasks = [];
  saveTasks();
  render();
  showToast('🧹 All tasks cleared', 'info');
}

/* ============================================================
   CONFETTI 🎉
   ============================================================ */
function triggerConfetti() {
  const colors = ['#7c6ff7','#22d3a4','#fbbf24','#f97171','#60a5fa','#a78bfa'];
  const container = document.body;

  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; z-index:9999; pointer-events:none; border-radius:3px;
      width:${6 + Math.random()*6}px; height:${6 + Math.random()*6}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      left:${20 + Math.random()*60}%; top:0;
      animation: confettiFall ${0.8 + Math.random()*1.2}s ease-in forwards;
      transform:rotate(${Math.random()*360}deg);
      animation-delay:${Math.random()*0.4}s;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
}

// Inject confetti keyframes
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
@keyframes confettiFall {
  0%   { transform: translateY(0)   rotate(0deg)   scale(1);   opacity:1; }
  100% { transform: translateY(90vh) rotate(720deg) scale(0.5); opacity:0; }
}`;
document.head.appendChild(confettiStyle);

/* ============================================================
   COLLAPSIBLE FORM
   ============================================================ */
let formOpen = true;
toggleFormBtn.addEventListener('click', () => {
  formOpen = !formOpen;
  addForm.style.display = formOpen ? '' : 'none';
  toggleFormBtn.textContent = formOpen ? '▲' : '▼';
});

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
addBtn.addEventListener('click', addTask);

taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

themeToggle.addEventListener('click', toggleTheme);
clearAllBtn.addEventListener('click', clearAll);

// Filter tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    activeFilter = tab.dataset.filter;
    render();
  });
});

// Category chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCat = chip.dataset.cat;
    render();
  });
});

// Sort
sortSelect.addEventListener('change', () => {
  activeSort = sortSelect.value;
  render();
});

// Search (debounced)
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    render();
  }, 200);
});

// Keyboard shortcut: Ctrl+/ or Cmd+/ to focus input
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    taskInput.focus();
  }
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
    modal.classList.add('hidden');
    if (modalResolve) modalResolve(false);
  }
});

/* ============================================================
   MOTIVATION QUOTES
   ============================================================ */
const quotes = [
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Your mind is for having ideas, not holding them.", author: "David Allen" },
  { text: "Efficiency is doing things right; effectiveness is doing the right things.", author: "Peter Drucker" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" }
];

function updateQuote() {
  const qText = document.getElementById('quoteText');
  const qAuth = document.getElementById('quoteAuthor');
  if (!qText || !qAuth) return;
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  qText.textContent = `"${quote.text}"`;
  qAuth.textContent = `— ${quote.author}`;
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  initTheme();
  loadTasks();
  updateQuote();
  render();
  taskInput.focus();
}

init();
