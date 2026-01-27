const STORAGE_KEY = "taskflow_demo_v3";
const API_BASE = "http://localhost:5000";


const DEFAULT_STATE = {
  user: { id: 1, name: "John Doe", role: "user", initials: "JD" },

  users: [
    { id: 1, name: "John Doe" },
    { id: 2, name: "Jane Smith" },
    { id: 3, name: "Ali Khan" },
    { id: 4, name: "Sara Lee" }
  ],

  projects: [
    { id: 1, name: "Marketing Website Redesign", description: "Refresh public website and landing pages", owner: 1, members: [1,2] },
    { id: 2, name: "Mobile App Launch", description: "Prepare for v1.0 launch", owner: 1, members: [1,3,4] },
    { id: 3, name: "Internal Tools", description: "Improve internal admin workflows", owner: 1, members: [1] }
  ],

  tasks: [
    {
      id: 1,
      title: "Design new hero section",
      projectId: 1,
      status: "in-progress",
      priority: "high",
      assigneeIds: [1,2],
      dueDate: "2026-02-01",
      tags: ["Design", "UI"],
      description: "Create a new hero section with updated brand visuals and responsive layout.",
      comments: [{ id: 1, user: "Jane Smith", text: "Include mobile breakpoint and contrast checks.", createdAt: "Just now" }],
      subtasks: [
        { title: "Design mockups", completed: true },
        { title: "Get client approval", completed: false }
      ],
      activity: ["Task created", "Status set to In Progress"]
    },
    {
      id: 2,
      title: "Copy for pricing page",
      projectId: 1,
      status: "todo",
      priority: "medium",
      assigneeIds: [1],
      dueDate: "2026-02-05",
      tags: ["Content"],
      description: "Write updated pricing copy for new plans and feature list.",
      comments: [],
      activity: ["Task created"]
    },
    {
      id: 3,
      title: "QA test on Android",
      projectId: 2,
      status: "todo",
      priority: "urgent",
      assigneeIds: [1,3],
      dueDate: "2026-01-25",
      tags: ["Testing"],
      description: "Smoke testing on Android 13 and 14 devices.",
      comments: [],
      activity: ["Task created"]
    },
    {
      id: 4,
      title: "Prepare release notes",
      projectId: 2,
      status: "in-progress",
      priority: "medium",
      assigneeIds: [4],
      dueDate: "2026-01-28",
      tags: ["Release"],
      description: "Draft release notes for v1.0.",
      comments: [],
      activity: ["Task created"]
    },
    {
      id: 5,
      title: "Review accessibility",
      projectId: 1,
      status: "done",
      priority: "low",
      assigneeIds: [2],
      dueDate: "2026-01-15",
      tags: ["Accessibility"],
      description: "Check basic WCAG 2.1 AA compliance.",
      comments: [],
      activity: ["Task created", "Marked as Done"]
    }
  ],

  notifications: [
    { id: 1, text: "You were assigned: QA test on Android", createdAt: "5 min ago" },
    { id: 2, text: "Jane mentioned you in: Design new hero section", createdAt: "1 h ago" }
  ],

  currentProjectId: 1,
  currentView: "dashboard",
  currentProjectTab: "board",
  taskModalTaskId: null,
  searchTerm: "",

  // per project+status ordering
  orderMap: {}
};

let state = loadState();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusLabel(status) {
  return {
    todo: "To Do",
    "in-progress": "In Progress",
    done: "Done",
  }[status] || status;
}

function userById(id){ return state.users.find(u => u.id === id); }

function initials(name){
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

/* ---------------- Storage ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      orderMap: parsed.orderMap || {},
      users: parsed.users || structuredClone(DEFAULT_STATE.users),
      projects: parsed.projects || structuredClone(DEFAULT_STATE.projects),
      tasks: normalizeTasks(parsed.tasks || structuredClone(DEFAULT_STATE.tasks)),
      notifications: parsed.notifications || structuredClone(DEFAULT_STATE.notifications),
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function normalizeTasks(tasks){
  // Backward compatibility: if old "assigneeId" exists, convert to assigneeIds
  return (tasks || []).map(t => {
    if (Array.isArray(t.assigneeIds)) return t;
    if (t.assigneeId != null) return { ...t, assigneeIds: [t.assigneeId] };
    return { ...t, assigneeIds: [1] };
  });
}

function saveState() {
  const toSave = { ...state, taskModalTaskId: null };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function resetDemoData() {
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(DEFAULT_STATE);
}

/* ---------------- Ordering helpers ---------------- */

function orderKey(projectId, status){ return `${projectId}|${status}`; }

function ensureOrderForColumn(projectId, status, taskIdsInColumn) {
  const key = orderKey(projectId, status);
  const existing = state.orderMap[key] || [];
  const newOrder = [
    ...existing.filter(id => taskIdsInColumn.includes(id)),
    ...taskIdsInColumn.filter(id => !existing.includes(id))
  ];
  state.orderMap[key] = newOrder;
}

function sortTasksByOrder(projectId, status, tasks) {
  const key = orderKey(projectId, status);
  const order = state.orderMap[key] || [];
  const pos = new Map(order.map((id, idx) => [id, idx]));
  return [...tasks].sort((a,b) => (pos.get(a.id) ?? 999999) - (pos.get(b.id) ?? 999999));
}

function setTaskOrder(projectId, status, orderedTaskIds) {
  state.orderMap[orderKey(projectId, status)] = orderedTaskIds;
}


// ===== AUTH NAV (LOGIN / REGISTER / FORGOT / RESET) =====
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const forgotForm = document.getElementById("forgot-form");
const resetForm = document.getElementById("reset-form");
const authDesc = document.getElementById("auth-desc");

const loginMsg = document.getElementById("loginMsg");
const registerMsg = document.getElementById("registerMsg");
const forgotMsg = document.getElementById("forgotMsg");
const resetMsg = document.getElementById("resetMsg");

// links
const goForgot = document.getElementById("goForgot");
const goRegisterLink = document.getElementById("goRegisterLink");
const goLoginLink = document.getElementById("goLoginLink");
const goLoginFromForgot = document.getElementById("goLoginFromForgot");
const goLoginFromReset = document.getElementById("goLoginFromReset");

function hideAll() {
  loginForm.classList.add("hidden");
  registerForm.classList.add("hidden");
  forgotForm.classList.add("hidden");
  resetForm.classList.add("hidden");

  if (loginMsg) loginMsg.textContent = "";
  if (registerMsg) registerMsg.textContent = "";
  if (forgotMsg) forgotMsg.textContent = "";
  if (resetMsg) resetMsg.textContent = "";
}

function showLogin() {
  hideAll();
  loginForm.classList.remove("hidden");
  authDesc.textContent = "Sign in to manage tasks, projects, and deadlines.";
}
function showRegister() {
  hideAll();
  registerForm.classList.remove("hidden");
  authDesc.textContent = "Create an account to start managing your tasks.";
}
function showForgot() {
  hideAll();
  forgotForm.classList.remove("hidden");
  authDesc.textContent = "We will send you a reset code (demo).";
}
function showReset() {
  hideAll();
  resetForm.classList.remove("hidden");
  authDesc.textContent = "Enter the reset code and set a new password.";
}

// link handlers
if (goRegisterLink) goRegisterLink.addEventListener("click", (e) => { e.preventDefault(); showRegister(); });
if (goLoginLink) goLoginLink.addEventListener("click", (e) => { e.preventDefault(); showLogin(); });
if (goForgot) goForgot.addEventListener("click", (e) => { e.preventDefault(); showForgot(); });
if (goLoginFromForgot) goLoginFromForgot.addEventListener("click", (e) => { e.preventDefault(); showLogin(); });
if (goLoginFromReset) goLoginFromReset.addEventListener("click", (e) => { e.preventDefault(); showLogin(); });

// Default
showLogin();

// ===== REGISTER (Real API) =====
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. Get values from the HTML form
    const first = document.getElementById("regFirstName").value.trim();
    const last = document.getElementById("regLastName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirmPassword").value;
    const msg = document.getElementById("registerMsg");

    // 2. Basic Validation
    msg.style.color = "red";
    if (!first || !last || !email || !pass) {
      msg.textContent = "All fields are required";
      return;
    }
    if (pass !== confirm) {
      msg.textContent = "Passwords do not match";
      return;
    }

    // 3. Send Data to Backend
    try {
      // Use the 'api' helper function already defined in your app.js
      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ first, last, email, pass }),
      });

      // 4. Handle Success
      setToken(data.token); // Save the JWT token
      
      msg.style.color = "lightgreen";
      msg.textContent = "✅ Registration successful! Logging in...";
      
      // Update the user state immediately
      state.user = { 
        id: data.user.id, 
        name: data.user.name, 
        role: data.user.role, 
        initials: initials(data.user.name) 
      };

      // Wait a moment, then show the app
      setTimeout(() => {
        showApp();
      }, 1000);

    } catch (err) {
      // 5. Handle Error
      console.error(err);
      msg.textContent = err.message || "Registration failed. Try again.";
    }
  });
}

// ===== LOGIN (Real API) =====
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. Get values
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const msg = document.getElementById("loginMsg");

    msg.style.color = "red";

    try {
      // 2. Call the Backend API
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      // 3. Handle Success
      setToken(data.token); // Save the login token
      msg.style.color = "lightgreen";
      msg.textContent = "✅ Login successful!";

      // 4. Load User Data into App State
      state.user = { 
        id: data.user.id, 
        name: data.user.name, 
        role: data.user.role, 
        initials: initials(data.user.name) 
      };

      // 5. Open the Dashboard
      setTimeout(() => {
        showApp();
      }, 500);

    } catch (err) {
      // 6. Handle Error
      console.error(err);
      msg.textContent = err.message || "Invalid email or password";
    }
  });
}

// ===== FORGOT PASSWORD (API) =====
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("forgotEmail").value.trim();
    const msg = document.getElementById("forgotMsg");
    msg.style.color = "red";

    if (!email) {
      msg.textContent = "Email is required";
      return;
    }

    try {
      const data = await api("/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      msg.style.color = "lightgreen";
      msg.textContent = "✅ Reset code sent!";
      
      // FOR DEMO PURPOSES: Show the token in an alert so you can copy it
  


      // Switch to Reset Form
      setTimeout(showReset, 1000);

    } catch (err) {
      msg.textContent = err.message || "Request failed";
    }
  });
}

// ===== RESET PASSWORD (API) =====
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = document.getElementById("resetCode").value.trim();
    const newPass = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmNewPassword").value;
    const msg = document.getElementById("resetMsg");

    msg.style.color = "red";

    if (newPass !== confirm) {
      msg.textContent = "Passwords do not match";
      return;
    }

    try {
      await api("/auth/reset", {
        method: "POST",
        body: JSON.stringify({ resetToken: code, newPassword: newPass }),
      });

      msg.style.color = "lightgreen";
      msg.textContent = "✅ Password reset successful! Please login.";

      setTimeout(showLogin, 2000);

    } catch (err) {
      msg.textContent = err.message || "Invalid or expired token";
    }
  });
}

/* ---------------- Auth ---------------- */

const TOKEN_KEY = "taskflow_token";

function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error("Backend returned HTML / not JSON. Check backend route/CORS."); }

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function showApp() {
  $("#auth-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  initApp();
}

function showAuth() {
  $("#auth-screen").classList.remove("hidden");
  $("#app").classList.add("hidden");
}

async function loadUser() {
  try {
    const data = await api("/auth/me");
    state.user = { id: data._id, name: data.name, role: data.role, initials: initials(data.name) };
    enableAdminUIIfNeeded();
    await loadProjects();
    await loadTasks();
    showApp();
  } catch (err) {
    console.error("Failed to load user:", err);
    clearToken();
    showAuth();
  }
}

async function loadProjects() {
  try {
    const projects = await api("/projects");
    state.projects = projects.map(p => ({
      id: p._id,
      name: p.name,
      description: p.description,
      owner: p.owner,
      members: p.members
    }));
    if (state.projects.length > 0 && !state.currentProjectId) {
      state.currentProjectId = state.projects[0].id;
    }
  } catch (err) {
    console.error("Failed to load projects:", err);
  }
}

async function loadTasks() {
  if (!state.currentProjectId) return;
  try {
    const tasks = await api(`/projects/${state.currentProjectId}/tasks`);
    state.tasks = tasks.map(t => ({
      id: t._id,
      title: t.title,
      projectId: state.currentProjectId,
      status: t.status,
      priority: t.priority,
      assigneeIds: t.assignees || [],
      dueDate: t.dueDate,
      tags: t.tags || [],
      description: t.description || "",
      comments: t.comments || [],
      subtasks: t.subtasks || [],
      activity: t.activity || []
    }));
  } catch (err) {
    console.error("Failed to load tasks:", err);
  }
}

async function createProject(name, description) {
  try {
    const project = await api("/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
    state.projects.push({
      id: project._id,
      name: project.name,
      description: project.description,
      owner: project.owner,
      members: project.members
    });
    renderProjectsList();
    return project;
  } catch (err) {
    console.error("Failed to create project:", err);
    throw err;
  }
}

function renderProjectsList() {
  const container = $("#projects-list");
  container.innerHTML = state.projects.map(project => `
    <div class="project-card" data-project-id="${project.id}">
      <div class="project-header">
        <h3>${project.name}</h3>
        <span class="project-owner">${project.owner === state.user.id ? "Owner" : "Member"}</span>
      </div>
      <p class="project-description">${project.description || "No description"}</p>
      <div class="project-members">
        <span class="member-count">${project.members.length} member${project.members.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="project-actions">
        <button class="btn btn-primary btn-sm" onclick="openProject('${project.id}')">Open Project</button>
        ${project.owner === state.user.id ? `<button class="btn btn-outline btn-sm" onclick="manageProject('${project.id}')">Manage</button>` : ""}
      </div>
    </div>
  `).join("");
}

function openProject(projectId) {
  state.currentProjectId = projectId;
  loadTasks().then(() => {
    state.currentView = "dashboard";
    setActiveView("dashboard");
    saveState();
  });
}

function manageProject(projectId) {
  // TODO: Implement project management (add/remove members)
  console.log("Manage project:", projectId);
}

function initAuth() {
  // Auto-login if token exists
  if (getToken()) {
    loadUser();
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = $("#email").value.trim();
    const password = $("#password").value;

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setToken(data.token);
      loadUser();
    } catch (err) {
      alert(err.message);
      showAuth();
    }
  });
}


/* ---------------- App init ---------------- */

function initApp() {
  const avatar = $(".avatar");
  if (avatar) avatar.textContent = state.user.initials;

  bindNavigation();
  bindSidebar();
  bindTopbar();
  bindProjectTabs();
  bindModals();
  bindProjectModal();

  $("#reset-demo").addEventListener("click", () => {
    if (!confirm("Reset demo data? This will remove all your saved changes.")) return;
    resetDemoData();
    renderSidebarProjects();
    rerenderAll();
    setActiveProject(state.currentProjectId, { silentScroll: true });
    renderNotifications();
  });

  $("#add-project").addEventListener("click", openProjectModal);

  // Projects view form handler
  $("#create-project-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#project-name").value.trim();
    const description = $("#project-description").value.trim();

    if (!name) {
      alert("Project name is required");
      return;
    }

    try {
      await createProject(name, description);
      $("#project-name").value = "";
      $("#project-description").value = "";
      alert("Project created successfully!");
    } catch (err) {
      alert("Failed to create project: " + err.message);
    }
  });

  renderSidebarProjects();
  rerenderAll();
  setActiveProject(state.currentProjectId, { silentScroll: true });
  renderNotifications();
}

/* ---------------- Navigation ---------------- */

function bindNavigation() {
  $$(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentView = btn.dataset.view;
      setActiveView(state.currentView);
      saveState();
    });
  });
}

function setActiveView(view) {
  $$(".nav-link").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  $$(".view").forEach((v) => v.classList.remove("active"));

  if (view === "dashboard") $("#view-dashboard").classList.add("active");
  if (view === "my-tasks") $("#view-my-tasks").classList.add("active");
  if (view === "projects") {
    $("#view-projects").classList.add("active");
    renderProjectsList();
  }
  if (view === "calendar") $("#view-calendar").classList.add("active");
  if (view === "reports") $("#view-reports").classList.add("active");
  if (view === "project") $("#view-project").classList.add("active");
  if (view === "admin") {
    $("#view-admin").classList.add("active");
    loadAdminUsers();
  }
}

/* ---------------- Sidebar ---------------- */

function bindSidebar() {
  const sidebarToggle = $("#sidebar-toggle");
  const sidebar = $("#sidebar");
  const overlay = $("#sidebar-overlay");

  function open(){ sidebar.classList.add("open"); overlay.classList.add("show"); }
  function close(){ sidebar.classList.remove("open"); overlay.classList.remove("show"); }

  sidebarToggle.addEventListener("click", () => sidebar.classList.contains("open") ? close() : open());
  overlay.addEventListener("click", close);

  $$(".nav-link").forEach(btn => btn.addEventListener("click", close));
  $("#project-list").addEventListener("click", (e) => {
    if (e.target.closest(".sidebar-project")) close();
  });
}

/* ---------------- Topbar ---------------- */

function bindTopbar() {
  $("#add-task-top").addEventListener("click", openQuickTaskModal);

  $("#logout-button").addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    }
    clearToken();
    showAuth();
  });

  $("#notifications-button").addEventListener("click", () => {
    $("#notifications-dropdown").classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#notifications-button") && !e.target.closest("#notifications-dropdown")) {
      $("#notifications-dropdown").classList.add("hidden");
    }
  });

  $("#global-search").addEventListener("input", (e) => {
    state.searchTerm = e.target.value.toLowerCase().trim();
    if (state.searchTerm.length > 0) {
      state.currentView = "my-tasks";
      setActiveView("my-tasks");
    }
    renderMyTasks();
    updateMyTasksSubtitle();
    saveState();
  });

  $("#clear-search").addEventListener("click", () => {
    state.searchTerm = "";
    $("#global-search").value = "";
    renderMyTasks();
    updateMyTasksSubtitle();
    saveState();
  });
}

/* ---------------- Notifications ---------------- */

function renderNotifications() {
  const list = $("#notifications-list");
  const badge = $("#notification-badge");

  if (!state.notifications.length) {
    list.classList.add("empty-state");
    list.textContent = "No notifications";
    badge.classList.add("hidden");
    return;
  }

  badge.classList.remove("hidden");
  badge.textContent = state.notifications.length.toString();

  list.classList.remove("empty-state");
  list.innerHTML = "";

  state.notifications.forEach((n) => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.innerHTML = `
      <div style="font-weight:650; margin-bottom:.15rem;">${n.text}</div>
      <small class="muted">${n.createdAt}</small>
    `;
    list.appendChild(item);
  });
}

/* ---------------- Sidebar Projects ---------------- */

function renderSidebarProjects() {
  const container = $("#project-list");
  container.innerHTML = "";

  state.projects.forEach((project) => {
    const openTasks = state.tasks.filter((t) => t.projectId === project.id && t.status !== "done").length;

    const div = document.createElement("div");
    div.className = "sidebar-project";
    div.dataset.projectId = project.id;
    div.innerHTML = `
      <span>${project.name}</span>
      <span class="pill">${openTasks}</span>
    `;
    div.addEventListener("click", () => setActiveProject(project.id));
    container.appendChild(div);
  });

  $$(".sidebar-project").forEach((p) => p.classList.toggle("active", Number(p.dataset.projectId) === state.currentProjectId));
}

function setActiveProject(projectId, opts = {}) {
  state.currentProjectId = projectId;

  $$(".sidebar-project").forEach((p) => p.classList.toggle("active", Number(p.dataset.projectId) === projectId));

  state.currentView = "project";
  setActiveView("project");
  renderProjectView();

  saveState();

  if (!opts.silentScroll) {
    document.querySelector(".main-content")?.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
  const myTasks = state.tasks.filter((t) => (t.assigneeIds || []).includes(state.user.id));
  const statsEl = $("#dashboard-stats");
  const upcomingEl = $("#upcoming-deadlines");
  const activityEl = $("#recent-activity");

  const total = myTasks.length;
  const byStatus = {
    todo: myTasks.filter((t) => t.status === "todo").length,
    "in-progress": myTasks.filter((t) => t.status === "in-progress").length,
    done: myTasks.filter((t) => t.status === "done").length
  };

  statsEl.innerHTML = `
    <div class="stat-chip"><span>Total tasks</span><span>${total}</span></div>
    <div class="stat-chip"><span>To Do</span><span>${byStatus.todo}</span></div>
    <div class="stat-chip"><span>In progress</span><span>${byStatus["in-progress"]}</span></div>
    <div class="stat-chip"><span>Done</span><span>${byStatus.done}</span></div>
  `;

  const upcoming = [...myTasks]
    .filter((t) => t.status !== "done" && t.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6);

  upcomingEl.innerHTML = "";
  if (!upcoming.length) {
    upcomingEl.innerHTML = `<li><span class="muted">No upcoming tasks</span><span></span></li>`;
  } else {
    upcoming.forEach((t) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${t.title}</span><span>${formatDate(t.dueDate)}</span>`;
      upcomingEl.appendChild(li);
    });
  }

  activityEl.innerHTML = "";
  const activityItems = [];
  state.tasks.forEach((t) => (t.activity || []).slice(-2).forEach((a) => activityItems.push({ a, title: t.title })));
  activityItems.slice(0, 10).forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${item.a} · <strong>${item.title}</strong></span><span class="muted">Recently</span>`;
    activityEl.appendChild(li);
  });
}

/* ---------------- My Tasks ---------------- */

function updateMyTasksSubtitle() {
  const el = $("#my-tasks-subtitle");
  if (!el) return;
  el.textContent = state.searchTerm
    ? `Showing results for: "${state.searchTerm}" (plus filters).`
    : "Filter by status and priority.";
}

function renderMyTasks() {
  const container = $("#my-tasks-list");
  const filterStatus = $("#my-tasks-filter-status").value;
  const filterPriority = $("#my-tasks-filter-priority").value;

  let tasks = state.tasks.filter((t) => (t.assigneeIds || []).includes(state.user.id));
  if (filterStatus) tasks = tasks.filter((t) => t.status === filterStatus);
  if (filterPriority) tasks = tasks.filter((t) => t.priority === filterPriority);
  if (state.searchTerm) tasks = tasks.filter((t) => t.title.toLowerCase().includes(state.searchTerm));

  container.innerHTML = "";
  const header = document.createElement("div");
  header.className = "table-header";
  header.innerHTML = `<div>Task</div><div>Project</div><div>Status</div><div>Priority</div><div>Assignees</div>`;
  container.appendChild(header);

  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "table-row";
    empty.style.cursor = "default";
    empty.innerHTML = `<div class="muted">No tasks found</div><div></div><div></div><div></div><div></div>`;
    container.appendChild(empty);
    return;
  }

  tasks.forEach((t) => {
    const row = document.createElement("div");
    row.className = "table-row";
    const project = state.projects.find((p) => p.id === t.projectId);
    const assignees = (t.assigneeIds || []).map(id => userById(id)?.name).filter(Boolean).join(", ");

    row.innerHTML = `
      <div>${t.title}</div>
      <div>${project ? project.name : "—"}</div>
      <div><span class="status-pill status-${t.status}">${statusLabel(t.status)}</span></div>
      <div><span class="table-cell-pill priority-${t.priority}">${cap(t.priority)}</span></div>
      <div class="muted" style="font-size:.85rem;">${assignees || "—"}</div>
    `;
    row.addEventListener("click", () => openTaskModal(t.id));
    container.appendChild(row);
  });

  $("#my-tasks-filter-status").onchange = () => renderMyTasks();
  $("#my-tasks-filter-priority").onchange = () => renderMyTasks();
}

/* ---------------- Calendar ---------------- */

function renderCalendar() {
  const container = $("#calendar-list");
  container.innerHTML = "";

  const tasksWithDates = state.tasks
    .filter((t) => t.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (!tasksWithDates.length) {
    container.innerHTML = `<li><span class="muted">No tasks with due dates</span><span></span></li>`;
    return;
  }

  let currentDate = null;
  tasksWithDates.forEach((t) => {
    if (t.dueDate !== currentDate) {
      currentDate = t.dueDate;
      const header = document.createElement("li");
      header.innerHTML = `<strong>${formatDate(currentDate)}</strong><span class="muted"></span>`;
      container.appendChild(header);
    }
    const li = document.createElement("li");
    li.innerHTML = `<span>${t.title}</span><span class="status-pill status-${t.status}">${statusLabel(t.status)}</span>`;
    container.appendChild(li);
  });
}

/* ---------------- Reports ---------------- */

function renderReports() {
  const byStatusList = $("#report-by-status");
  const byPriorityList = $("#report-by-priority");

  const byStatusCounts = { todo:0, "in-progress":0, done:0 };
  const byPriorityCounts = { low:0, medium:0, high:0, urgent:0 };

  state.tasks.forEach((t) => {
    byStatusCounts[t.status] = (byStatusCounts[t.status] || 0) + 1;
    byPriorityCounts[t.priority] = (byPriorityCounts[t.priority] || 0) + 1;
  });

  byStatusList.innerHTML = "";
  Object.entries(byStatusCounts).forEach(([status, count]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${statusLabel(status)}</span><span>${count}</span>`;
    byStatusList.appendChild(li);
  });

  byPriorityList.innerHTML = "";
  Object.entries(byPriorityCounts).forEach(([priority, count]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${cap(priority)}</span><span>${count}</span>`;
    byPriorityList.appendChild(li);
  });
}

/* ---------------- Project Tabs ---------------- */

function bindProjectTabs() {
  $("#project-tab-board").onclick = () => switchProjectTab("board");
  $("#project-tab-list").onclick = () => switchProjectTab("list");
  $("#project-tab-activity").onclick = () => switchProjectTab("activity");
}

function switchProjectTab(tab) {
  state.currentProjectTab = tab;

  $("#project-tab-board").classList.toggle("active", tab === "board");
  $("#project-tab-list").classList.toggle("active", tab === "list");
  $("#project-tab-activity").classList.toggle("active", tab === "activity");

  $("#project-board").classList.toggle("hidden", tab !== "board");
  $("#project-list-view").classList.toggle("hidden", tab !== "list");
  $("#project-activity-view").classList.toggle("hidden", tab !== "activity");

  saveState();
}

/* ---------------- Project View + Drag/Drop + Reorder ---------------- */

function renderProjectView() {
  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  $("#project-title").textContent = project.name;
  $("#project-subtitle").textContent = project.description || "";

  // demo: filter options from users list
  const assigneeSelect = $("#project-filter-assignee");
  assigneeSelect.innerHTML = `<option value="">All assignees</option>` + state.users
    .map(u => `<option value="${u.id}">${u.name}</option>`).join("");

  $("#project-filter-status").onchange = () => { renderProjectBoard(); renderProjectList(); };
  $("#project-filter-assignee").onchange = () => { renderProjectBoard(); renderProjectList(); };
  $("#project-filter-priority").onchange = () => { renderProjectBoard(); renderProjectList(); };

  $("#add-task-project").onclick = openQuickTaskModal;

  renderProjectBoard();
  renderProjectList();
  renderProjectActivity();
  switchProjectTab(state.currentProjectTab);
}

function filteredProjectTasks() {
  const statusFilter = $("#project-filter-status").value;
  const assigneeFilter = $("#project-filter-assignee").value;
  const priorityFilter = $("#project-filter-priority").value;

  return state.tasks.filter((t) => {
    if (t.projectId !== state.currentProjectId) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (assigneeFilter && !(t.assigneeIds || []).includes(Number(assigneeFilter))) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });
}

function renderProjectBoard() {
  const container = $("#project-board");
  container.innerHTML = "";

  const columns = [
    { key: "todo", label: "To Do" },
    { key: "in-progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];

  const allFiltered = filteredProjectTasks();

  // ensure order exists for each column based on all tasks in project (not filtered)
  const allInProject = state.tasks.filter(t => t.projectId === state.currentProjectId);
  for (const col of columns) {
    const ids = allInProject.filter(t => t.status === col.key).map(t => t.id);
    ensureOrderForColumn(state.currentProjectId, col.key, ids);
  }

  columns.forEach((col) => {
    const colTasksFiltered = allFiltered.filter((t) => t.status === col.key);
    const colTasks = sortTasksByOrder(state.currentProjectId, col.key, colTasksFiltered);

    const colEl = document.createElement("div");
    colEl.className = "board-column";
    colEl.innerHTML = `
      <div class="board-column-header">
        <span>${col.label}</span>
        <span class="count-pill">${colTasksFiltered.length}</span>
      </div>
      <div class="board-tasks" data-drop-status="${col.key}"></div>
    `;

    const zone = colEl.querySelector(".board-tasks");
    const marker = document.createElement("div");
    marker.className = "drop-marker";
    zone.appendChild(marker);

    attachDropzoneHandlers(zone, marker);

    colTasks.forEach((t) => {
      const card = document.createElement("div");
      card.className = "board-card";
      card.draggable = true;
      card.dataset.taskId = t.id;
      card.dataset.status = t.status;

      const tagsHtml = (t.tags || []).slice(0, 3).map(tag => `<span class="tag-pill">${tag}</span>`).join("");
      const avatarsHtml = renderMiniAvatars(t.assigneeIds || []);

      card.innerHTML = `
        <div class="board-card-title">${t.title}</div>
        <div class="board-card-meta">
          <span>${formatDate(t.dueDate)}</span>
          <span class="table-cell-pill priority-${t.priority}">${cap(t.priority)}</span>
        </div>
        <div class="board-card-tags">${tagsHtml}</div>
        <div class="assignee-avatars">${avatarsHtml}</div>
      `;

      card.addEventListener("dragstart", (e) => {
        card.classList.add("dragging");
        e.dataTransfer.setData("text/plain", String(t.id));
        e.dataTransfer.effectAllowed = "move";
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        $$(".board-tasks").forEach(z => z.classList.remove("dropzone-active"));
        $$(".drop-marker").forEach(m => m.classList.remove("show"));
      });

      card.addEventListener("click", () => openTaskModal(t.id));
      zone.appendChild(card);
    });

    container.appendChild(colEl);
  });

  saveState();
}

function renderMiniAvatars(assigneeIds) {
  const names = assigneeIds.map(id => userById(id)?.name).filter(Boolean);
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;

  const html = shown.map(n => `<span class="mini-avatar" title="${n}">${initials(n)}</span>`).join("");
  if (rest > 0) return html + `<span class="mini-avatar more" title="${rest} more">+${rest}</span>`;
  return html || `<span class="muted" style="font-size:.78rem;">Unassigned</span>`;
}

function attachDropzoneHandlers(zoneEl, markerEl) {
  zoneEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    zoneEl.classList.add("dropzone-active");

    const afterEl = getDragAfterElement(zoneEl, e.clientY);
    markerEl.classList.add("show");
    if (!afterEl) zoneEl.appendChild(markerEl);
    else zoneEl.insertBefore(markerEl, afterEl);
  });

  zoneEl.addEventListener("dragleave", (e) => {
    if (!zoneEl.contains(e.relatedTarget)) {
      zoneEl.classList.remove("dropzone-active");
      markerEl.classList.remove("show");
    }
  });

  zoneEl.addEventListener("drop", (e) => {
    e.preventDefault();
    zoneEl.classList.remove("dropzone-active");
    markerEl.classList.remove("show");

    const taskId = Number(e.dataTransfer.getData("text/plain"));
    const newStatus = zoneEl.dataset.dropStatus;

    const newIndex = Math.max(0, Array.from(zoneEl.children).indexOf(markerEl) - 1);
    moveAndReorderTask(taskId, newStatus, zoneEl, newIndex);
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".board-card:not(.dragging)")];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function moveAndReorderTask(taskId, newStatus, zoneEl, newIndex) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const oldStatus = task.status;
  const projectId = task.projectId;

  if (oldStatus !== newStatus) {
    task.status = newStatus;
    task.activity = task.activity || [];
    task.activity.push(`Status changed: ${statusLabel(oldStatus)} → ${statusLabel(newStatus)}`);
  } else {
    task.activity = task.activity || [];
    task.activity.push(`Task reordered in ${statusLabel(newStatus)}`);
  }

  const targetIds = Array.from(zoneEl.querySelectorAll(".board-card"))
    .map(el => Number(el.dataset.taskId))
    .filter(id => id !== taskId);

  targetIds.splice(Math.min(newIndex, targetIds.length), 0, taskId);
  setTaskOrder(projectId, newStatus, targetIds);

  if (oldStatus !== newStatus) {
    const oldKey = orderKey(projectId, oldStatus);
    state.orderMap[oldKey] = (state.orderMap[oldKey] || []).filter(id => id !== taskId);
  }

  saveState();
  renderSidebarProjects();
  rerenderAll();
}

/* ---------------- Project List & Activity ---------------- */

function renderProjectList() {
  const container = $("#project-list-view");
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "table-header";
  header.innerHTML = `<div>Task</div><div>Status</div><div>Priority</div><div>Due</div><div>Assignees</div>`;
  container.appendChild(header);

  const tasks = filteredProjectTasks();
  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "table-row";
    empty.style.cursor = "default";
    empty.innerHTML = `<div class="muted">No tasks in this project (or filters hide them)</div><div></div><div></div><div></div><div></div>`;
    container.appendChild(empty);
    return;
  }

  tasks.forEach((t) => {
    const row = document.createElement("div");
    row.className = "table-row";
    const assignees = (t.assigneeIds || []).map(id => userById(id)?.name).filter(Boolean).join(", ");

    row.innerHTML = `
      <div>${t.title}</div>
      <div><span class="status-pill status-${t.status}">${statusLabel(t.status)}</span></div>
      <div><span class="table-cell-pill priority-${t.priority}">${cap(t.priority)}</span></div>
      <div>${formatDate(t.dueDate)}</div>
      <div class="muted" style="font-size:.85rem;">${assignees || "—"}</div>
    `;
    row.onclick = () => openTaskModal(t.id);
    container.appendChild(row);
  });
}

function renderProjectActivity() {
  const container = $("#project-activity-view");
  container.innerHTML = "";

  const tasks = state.tasks.filter((t) => t.projectId === state.currentProjectId);
  const items = [];
  tasks.forEach((t) => (t.activity || []).forEach((a) => items.push({ a, title: t.title })));

  if (!items.length) {
    container.innerHTML = `<li><span class="muted">No activity yet</span><span></span></li>`;
    return;
  }

  items.slice(0, 20).forEach((x) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${x.a} · <strong>${x.title}</strong></span><span class="muted">Recently</span>`;
    container.appendChild(li);
  });
}

/* ---------------- Modals: Task (title inline) + tags + assignees ---------------- */

function bindModals() {
  // Task modal
  $("#task-modal-close").onclick = closeTaskModal;
  $("#task-modal-delete").onclick = deleteCurrentTask;
  $("#task-modal-save").onclick = saveTaskFromModal;
  $("#task-modal-add-comment").onclick = addCommentFromModal;
  $("#task-modal-add-subtask").onclick = addSubtaskFromModal;
  $("#task-modal .modal-backdrop").addEventListener("click", closeTaskModal);

  // Inline title edit
  $("#task-title-edit").onclick = startTitleEdit;
  $("#task-title-cancel").onclick = cancelTitleEdit;
  $("#task-title-save").onclick = saveTitleEdit;
  $("#task-title-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveTitleEdit();
    if (e.key === "Escape") cancelTitleEdit();
  });

  // Tags
  $("#tag-add-btn").onclick = addTagFromModal;
  $("#tag-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTagFromModal();
  });

  // Assignees multi-select
  $("#assignees-select").addEventListener("change", updateAssigneesFromSelect);

  // Quick task modal
  $("#quick-task-close").onclick = closeQuickTaskModal;
  $("#quick-task-create").onclick = createQuickTask;
  $("#quick-task-modal .modal-backdrop").addEventListener("click", closeQuickTaskModal);

  // Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeTaskModal();
      closeQuickTaskModal();
      closeProjectModal();
      $("#notifications-dropdown").classList.add("hidden");
    }
  });

  // Enter comment
  $("#task-modal-comment-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addCommentFromModal();
  });
}

function openTaskModal(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;

  state.taskModalTaskId = taskId;

  // Title view
  $("#task-title-view").textContent = task.title;
  $("#task-title-input").value = task.title;
  endTitleEditUI();

  $("#task-modal-status").value = task.status;
  $("#task-modal-priority").value = task.priority;
  $("#task-modal-due").value = task.dueDate || "";
  $("#task-modal-description").value = task.description || "";

  renderAssigneesEditor(task);
  renderTagEditor(task);

  const subtasksList = $("#task-modal-subtasks-list");
  subtasksList.innerHTML = "";
  (task.subtasks || []).forEach((s, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label class="checkbox-label">
        <input type="checkbox" ${s.completed ? "checked" : ""} onchange="toggleSubtask(${taskId}, ${index})" />
        <span class="${s.completed ? "completed" : ""}">${s.title}</span>
      </label>
    `;
    subtasksList.appendChild(li);
  });

  const commentsList = $("#task-modal-comments-list");
  commentsList.innerHTML = "";
  (task.comments || []).forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML = `<span><strong>${c.user}</strong>: ${c.text}</span><span class="muted">${c.createdAt}</span>`;
    commentsList.appendChild(li);
  });

  $("#task-modal").classList.remove("hidden");
  $("#task-modal-comment-input").value = "";
  $("#tag-input").value = "";
}

function closeTaskModal() {
  $("#task-modal").classList.add("hidden");
  state.taskModalTaskId = null;
}

function startTitleEdit() {
  $("#task-title-view").classList.add("hidden");
  $("#task-title-input").classList.remove("hidden");
  $("#task-title-edit").classList.add("hidden");
  $("#task-title-save").classList.remove("hidden");
  $("#task-title-cancel").classList.remove("hidden");
  $("#task-title-input").focus();
  $("#task-title-input").select();
}

function endTitleEditUI() {
  $("#task-title-view").classList.remove("hidden");
  $("#task-title-input").classList.add("hidden");
  $("#task-title-edit").classList.remove("hidden");
  $("#task-title-save").classList.add("hidden");
  $("#task-title-cancel").classList.add("hidden");
}

function cancelTitleEdit() {
  const id = state.taskModalTaskId;
  if (id == null) return;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  $("#task-title-input").value = task.title;
  endTitleEditUI();
}

function saveTitleEdit() {
  const id = state.taskModalTaskId;
  if (id == null) return;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const newTitle = $("#task-title-input").value.trim();
  if (!newTitle) return;

  if (newTitle !== task.title) {
    task.title = newTitle;
    task.activity = task.activity || [];
    task.activity.push("Title updated");
    saveState();
    $("#task-title-view").textContent = task.title;
    rerenderAll();
  }

  endTitleEditUI();
}

function renderAssigneesEditor(task) {
  const select = $("#assignees-select");
  select.innerHTML = state.users.map(u => `<option value="${u.id}">${u.name}</option>`).join("");

  // set selected
  const selected = new Set(task.assigneeIds || []);
  Array.from(select.options).forEach(opt => opt.selected = selected.has(Number(opt.value)));

  renderAssigneeChips(task);
}

function renderAssigneeChips(task) {
  const container = $("#assignees-chips");
  container.innerHTML = "";

  const ids = task.assigneeIds || [];
  if (!ids.length) {
    const span = document.createElement("span");
    span.className = "muted";
    span.style.fontSize = ".85rem";
    span.textContent = "No assignees selected.";
    container.appendChild(span);
    return;
  }

  ids.forEach((id) => {
    const u = userById(id);
    if (!u) return;

    const pill = document.createElement("span");
    pill.className = "assignee-pill";
    pill.innerHTML = `<span>${u.name}</span><button type="button" title="Remove">×</button>`;
    pill.querySelector("button").onclick = () => {
      task.assigneeIds = (task.assigneeIds || []).filter(x => x !== id);
      task.activity = task.activity || [];
      task.activity.push(`Removed assignee: ${u.name}`);
      saveState();
      renderAssigneesEditor(task);
      rerenderAll();
    };
    container.appendChild(pill);
  });
}

function updateAssigneesFromSelect() {
  const id = state.taskModalTaskId;
  if (id == null) return;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const select = $("#assignees-select");
  const selectedIds = Array.from(select.selectedOptions).map(o => Number(o.value));

  task.assigneeIds = selectedIds;

  task.activity = task.activity || [];
  task.activity.push("Assignees updated");

  saveState();
  renderAssigneeChips(task);
  rerenderAll();
}

/* Tags */
function renderTagEditor(task) {
  const chips = $("#tag-editor-chips");
  chips.innerHTML = "";

  (task.tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.innerHTML = `<span>${tag}</span><button class="tag-remove" type="button" title="Remove">×</button>`;
    chip.querySelector(".tag-remove").onclick = () => {
      task.tags = (task.tags || []).filter(t => t !== tag);
      task.activity = task.activity || [];
      task.activity.push(`Removed tag: ${tag}`);
      saveState();
      renderTagEditor(task);
      rerenderAll();
    };
    chips.appendChild(chip);
  });

  if (!(task.tags || []).length) {
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.style.fontSize = ".85rem";
    empty.textContent = "No tags yet.";
    chips.appendChild(empty);
  }
}

function addTagFromModal() {
  const id = state.taskModalTaskId;
  if (id == null) return;

  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const input = $("#tag-input");
  const raw = input.value.trim();
  if (!raw) return;

  const tag = raw.replace(/\s+/g, " ").slice(0, 24);

  task.tags = task.tags || [];
  if (!task.tags.includes(tag)) {
    task.tags.push(tag);
    task.activity = task.activity || [];
    task.activity.push(`Added tag: ${tag}`);
  }

  input.value = "";
  saveState();
  renderTagEditor(task);
  rerenderAll();
}

/* Save/Delete/Comments */
function deleteCurrentTask() {
  if (state.taskModalTaskId == null) return;
  const id = state.taskModalTaskId;

  const t = state.tasks.find(x => x.id === id);
  if (t) {
    const key = orderKey(t.projectId, t.status);
    state.orderMap[key] = (state.orderMap[key] || []).filter(x => x !== id);
  }

  state.tasks = state.tasks.filter((t) => t.id !== id);
  closeTaskModal();

  saveState();
  renderSidebarProjects();
  rerenderAll();
}

function saveTaskFromModal() {
  const id = state.taskModalTaskId;
  if (id == null) return;
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const oldStatus = task.status;

  task.status = $("#task-modal-status").value;
  task.priority = $("#task-modal-priority").value;
  task.dueDate = $("#task-modal-due").value || null;
  task.description = $("#task-modal-description").value;

  task.activity = task.activity || [];
  task.activity.push("Task updated");

  // status change move ordering arrays
  if (oldStatus !== task.status) {
    task.activity.push(`Status changed: ${statusLabel(oldStatus)} → ${statusLabel(task.status)}`);

    const oldKey = orderKey(task.projectId, oldStatus);
    state.orderMap[oldKey] = (state.orderMap[oldKey] || []).filter(x => x !== task.id);

    const newKey = orderKey(task.projectId, task.status);
    const arr = state.orderMap[newKey] || [];
    state.orderMap[newKey] = [task.id, ...arr.filter(x => x !== task.id)];
  }

  closeTaskModal();

  saveState();
  renderSidebarProjects();
  rerenderAll();
}

function addCommentFromModal() {
  const input = $("#task-modal-comment-input");
  const text = input.value.trim();
  if (!text) return;

  const id = state.taskModalTaskId;
  if (id == null) return;
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  task.comments = task.comments || [];
  task.comments.push({ id: Date.now(), user: state.user.name, text, createdAt: "Just now" });

  task.activity = task.activity || [];
  task.activity.push("Added a comment");

  saveState();
  openTaskModal(id);
}

function toggleSubtask(taskId, subtaskIndex) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !task.subtasks) return;
  const subtask = task.subtasks[subtaskIndex];
  if (!subtask) return;
  subtask.completed = !subtask.completed;
  task.activity = task.activity || [];
  task.activity.push(`Subtask "${subtask.title}" ${subtask.completed ? "completed" : "uncompleted"}`);
  saveState();
  openTaskModal(taskId);
}

function addSubtaskFromModal() {
  const input = $("#task-modal-subtask-input");
  const title = input.value.trim();
  if (!title) return;

  const id = state.taskModalTaskId;
  if (id == null) return;
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  task.subtasks = task.subtasks || [];
  task.subtasks.push({ title, completed: false, createdAt: new Date().toISOString() });

  task.activity = task.activity || [];
  task.activity.push("Added a subtask");

  input.value = "";
  saveState();
  openTaskModal(id);
}

/* ---------------- Quick Task Modal ---------------- */

function openQuickTaskModal() {
  $("#quick-task-input-title").value = "";
  $("#quick-task-select-priority").value = "medium";
  $("#quick-task-input-due").value = new Date().toISOString().slice(0, 10);

  $("#quick-task-select-project").innerHTML = state.projects
    .map(p => `<option value="${p.id}" ${p.id === state.currentProjectId ? "selected":""}>${p.name}</option>`)
    .join("");

  $("#quick-task-modal").classList.remove("hidden");
  $("#quick-task-input-title").focus();
}

function closeQuickTaskModal() {
  $("#quick-task-modal").classList.add("hidden");
}

function createQuickTask() {
  const title = $("#quick-task-input-title").value.trim();
  if (!title) return;

  const projectId = Number($("#quick-task-select-project").value);
  const priority = $("#quick-task-select-priority").value;
  const dueDate = $("#quick-task-input-due").value || null;

  const newId = Date.now();

  state.tasks.push({
    id: newId,
    title,
    projectId,
    status: "todo",
    priority,
    assigneeIds: [state.user.id],
    dueDate,
    tags: [],
    description: "",
    comments: [],
    activity: ["Task created"]
  });

  const key = orderKey(projectId, "todo");
  const arr = state.orderMap[key] || [];
  state.orderMap[key] = [newId, ...arr];

  closeQuickTaskModal();

  saveState();
  renderSidebarProjects();
  rerenderAll();
  setActiveProject(projectId);
}

/* ---------------- Project modal (Create Project) ---------------- */

function bindProjectModal() {
  $("#project-modal-close").onclick = closeProjectModal;
  $("#project-modal .modal-backdrop").addEventListener("click", closeProjectModal);
  $("#project-create-btn").onclick = createProjectFromModal;
}

function openProjectModal() {
  $("#project-name-input").value = "";
  $("#project-desc-input").value = "";
  $("#project-modal").classList.remove("hidden");
  $("#project-name-input").focus();
}

function closeProjectModal() {
  $("#project-modal").classList.add("hidden");
}

function createProjectFromModal() {
  const name = $("#project-name-input").value.trim();
  const desc = $("#project-desc-input").value.trim();
  if (!name) return;

  const newId = Date.now();
  state.projects.push({ id: newId, name, description: desc });

  closeProjectModal();

  saveState();
  renderSidebarProjects();
  setActiveProject(newId);
}

/* ---------------- Admin Functions ---------------- */

function enableAdminUIIfNeeded() {
  const btn = document.getElementById("admin-nav");
  if (!btn) return;
  if (state.user.role === "admin") btn.classList.remove("hidden");
  else btn.classList.add("hidden");
}

async function loadAdminUsers() {
  const users = await api("/admin/users", { method: "GET" });
  const el = document.getElementById("admin-users");
  el.innerHTML = users.map(u => `
    <div style="display:flex;gap:.6rem;align-items:center;justify-content:space-between;padding:.6rem;border:1px solid #eee;border-radius:10px;margin:.4rem 0;">
      <div>
        <strong>${u.name}</strong><div class="muted">${u.email}</div>
        <div class="muted">Role: <strong>${u.role}</strong></div>
      </div>
      <div style="display:flex;gap:.4rem;">
        <button class="btn btn-soft btn-sm" onclick="setUserRole('${u._id}','user')">User</button>
        <button class="btn btn-soft btn-sm" onclick="setUserRole('${u._id}','admin')">Admin</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser('${u._id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

async function setUserRole(id, role) {
  await api(`/admin/users/${id}/role`, {
    method: "PUT",
    body: JSON.stringify({ role })
  });
  loadAdminUsers();
}

async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;
  await api(`/admin/users/${id}`, { method: "DELETE" });
  loadAdminUsers();
}

/* ---------------- Global rerender ---------------- */

function rerenderAll() {
  renderDashboard();
  renderMyTasks();
  updateMyTasksSubtitle();
  renderCalendar();
  renderReports();
  renderProjectView();
}


// Test backend connection
fetch(`${API_BASE}/`)
  .then(res => res.text())
  .then(data => console.log("Backend response:", data))
  .catch(err => console.error("Backend not running:", err));

/* ---------------- Start ---------------- */
document.addEventListener("DOMContentLoaded", initAuth);
