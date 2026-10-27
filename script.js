"use strict";

// یہاں اپنے Google Apps Script Web App کا URL ڈالیں۔
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyORZaaxg3fpd9BnkPokg_XeC36FxzbVDWgnvFwZ2X9FZPsurQ97VifFORKAD27lWxQ/exec";

const $ = id => document.getElementById(id);
const today = new Date().toISOString().slice(0, 10);

let transactions = readStore("abu_transactions");
let tasks = readStore("abu_tasks");
let notes = readStore("abu_notes");

function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}

function saveStore() {
  localStorage.setItem("abu_transactions", JSON.stringify(transactions));
  localStorage.setItem("abu_tasks", JSON.stringify(tasks));
  localStorage.setItem("abu_notes", JSON.stringify(notes));
}

function money(value) {
  return "Rs " + Number(value || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// Google Sheets کو ڈیٹا بھیجیں۔ no-cors میں سرور کا جواب پڑھا نہیں جا سکتا۔
function sendToSheets(action, data) {
  if (!SCRIPT_URL || SCRIPT_URL.includes("PASTE_YOUR")) return;
  fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, data })
  }).catch(() => {
    notify("آن لائن کنکشن میں مسئلہ ہے؛ مقامی ریکارڈ برقرار ہے۔");
  });
}

function persist(action, data) {
  saveStore();
  sendToSheets(action, data);
  renderAll();
}

function showSection(name) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  $(name).classList.remove("hidden");
  document.querySelectorAll(".nav").forEach(b =>
    b.classList.toggle("active", b.dataset.section === name)
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});
document.querySelectorAll("[data-open]").forEach(button => {
  button.addEventListener("click", () => showSection(button.dataset.open));
});

$("todayText") && ($("todayText").textContent = new Date().toLocaleDateString("ur-PK"));
$("txDate").value = today;
$("taskDate").value = today;

$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("txTitle").value.trim();
  const amount = Number($("txAmount").value);
  if (!title || !Number.isFinite(amount) || amount <= 0) {
    notify("تفصیل اور درست رقم درج کریں۔");
    return;
  }
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title, amount, type: $("txType").value,
    category: $("txCategory").value.trim() || "دیگر",
    date: $("txDate").value || today,
    createdAt: new Date().toISOString()
  };
  transactions.unshift(item);
  persist("addTransaction", item);
  event.target.reset();
  $("txDate").value = today;
  notify("ریکارڈ محفوظ کر دیا گیا۔");
});

$("txSearch").addEventListener("input", renderTransactions);

function deleteTransaction(id) {
  const item = transactions.find(t => t.id === id);
  if (!item || !confirm("کیا آپ یہ ریکارڈ حذف کرنا چاہتے ہیں؟")) return;
  transactions = transactions.filter(t => t.id !== id);
  // شیٹ میں بھی حذف درج کیا جائے گا۔
  persist("deleteTransaction", { id });
  notify("ریکارڈ حذف کر دیا گیا۔");
}

$("taskForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("taskTitle").value.trim();
  if (!title) return;
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title, date: $("taskDate").value || "", done: false,
    createdAt: new Date().toISOString()
  };
  tasks.unshift(item);
  persist("addTask", item);
  event.target.reset();
  $("taskDate").value = today;
  notify("نیا کام شامل ہو گیا۔");
});

function toggleTask(id) {
  const item = tasks.find(t => t.id === id);
  if (!item) return;
  item.done = !item.done;
  persist("updateTask", item);
}

function deleteTask(id) {
  if (!confirm("کیا یہ کام حذف کرنا ہے؟")) return;
  tasks = tasks.filter(t => t.id !== id);
  persist("deleteTask", { id });
}

$("noteForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("noteTitle").value.trim();
  const body = $("noteBody").value.trim();
  if (!title || !body) return;
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title, body, createdAt: new Date().toISOString()
  };
  notes.unshift(item);
  persist("addNote", item);
  event.target.reset();
  notify("نوٹ محفوظ ہو گیا۔");
});

function deleteNote(id) {
  if (!confirm("کیا یہ نوٹ حذف کرنا ہے؟")) return;
  notes = notes.filter(n => n.id !== id);
  persist("deleteNote", { id });
}

function renderTransactions() {
  const query = $("txSearch").value.trim().toLowerCase();
  const filtered = transactions.filter(t =>
    `${t.title} ${t.category} ${t.type}`.toLowerCase().includes(query)
  );
  $("transactionRows").innerHTML = filtered.map(t => `
    <tr>
      <td>${escapeHTML(t.title)}</td>
      <td><span class="type ${t.type}">${t.type === "income" ? "آمدنی" : "اخراجات"}</span></td>
      <td>${escapeHTML(t.category)}</td>
      <td>${escapeHTML(t.date)}</td>
      <td>${money(t.amount)}</td>
      <td><button class="delete-btn" data-delete-tx="${escapeHTML(t.id)}">حذف</button></td>
    </tr>`).join("");
  $("txEmpty").classList.toggle("hidden", filtered.length > 0);
  document.querySelectorAll("[data-delete-tx]").forEach(b =>
    b.addEventListener("click", () => deleteTransaction(b.dataset.deleteTx))
  );
}

function renderTasks() {
  const open = tasks.filter(t => !t.done);
  $("pendingTotal").textContent = open.length;

  const html = list => list.map(t => `
    <div class="task-row ${t.done ? "done" : ""}">
      <input type="checkbox" ${t.done ? "checked" : ""}
        aria-label="کام مکمل کریں" data-task-check="${escapeHTML(t.id)}">
      <span class="task-name">${escapeHTML(t.title)}</span>
      <span class="task-date">${escapeHTML(t.date || "")}</span>
      <button class="delete-btn" data-delete-task="${escapeHTML(t.id)}">×</button>
    </div>`).join("");

  $("taskList").innerHTML = html(tasks);
  $("dashboardTasks").innerHTML = html(tasks.slice(0, 4));
  $("taskEmpty").classList.toggle("hidden", tasks.length > 0);
  $("taskSummaryText").textContent = `${open.length} کام باقی ہیں`;
  $("taskSummarySub").textContent = open.length
    ? "ایک ایک کرکے کام مکمل کرتے جائیں۔" : "بہت خوب! تمام کام مکمل ہیں۔";

  document.querySelectorAll("[data-task-check]").forEach(b =>
    b.addEventListener("change", () => toggleTask(b.dataset.taskCheck))
  );
  document.querySelectorAll("[data-delete-task]").forEach(b =>
    b.addEventListener("click", () => deleteTask(b.dataset.deleteTask))
  );
}

function renderNotes() {
  $("noteList").innerHTML = notes.map(n => `
    <article class="note-card">
      <h3>${escapeHTML(n.title)}</h3>
      <p>${escapeHTML(n.body)}</p>
      <small>${escapeHTML(new Date(n.createdAt).toLocaleDateString("ur-PK"))}</small><br>
      <button class="delete-btn" data-delete-note="${escapeHTML(n.id)}">نوٹ حذف کریں</button>
    </article>`).join("");
  document.querySelectorAll("[data-delete-note]").forEach(b =>
    b.addEventListener("click", () => deleteNote(b.dataset.deleteNote))
  );
}

function renderDashboard() {
  const income = transactions.filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const max = Math.max(income, expense, 1);

  $("incomeTotal").textContent = money(income);
  $("expenseTotal").textContent = money(expense);
  $("balanceTotal").textContent = money(income - expense);
  $("incomeBar").style.width = `${income / max * 100}%`;
  $("expenseBar").style.width = `${expense / max * 100}%`;
  $("chartText").textContent = transactions.length
    ? `کل ${transactions.length} مالی انٹریز محفوظ ہیں۔`
    : "ریکارڈ شامل کریں تو یہاں خلاصہ نظر آئے گا۔";

  const recent = transactions.slice(0, 5);
  $("recentRows").innerHTML = recent.map(t => `
    <tr><td>${escapeHTML(t.title)}</td>
    <td><span class="type ${t.type}">${t.type === "income" ? "آمدنی" : "اخراجات"}</span></td>
    <td>${escapeHTML(t.date)}</td><td>${money(t.amount)}</td></tr>`).join("");
  $("recentEmpty").classList.toggle("hidden", recent.length > 0);
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderTasks();
  renderNotes();
}

$("pdfBtn").addEventListener("click", () => {
  // براؤزر میں Print کھلے گا؛ Destination میں Save as PDF منتخب کریں۔
  window.print();
});

renderAll();