import { cloudSyncEnabled, firebaseConfig } from "./firebase-config.js";

const STORAGE_KEY = "pixelTaskNexus::state";
const SESSION_KEY = "pixelTaskNexus::session";
const FLASH_TIMEOUT_MS = 2800;
const CLOUD_COLLECTION = "pixel_task_nexus";
const CLOUD_DOCUMENT = "workspace_main";

const appRoot = document.getElementById("app");

const STATUS_META = {
  bucket: { label: "Bucket", className: "status-bucket" },
  in_progress: { label: "In Progress", className: "status-in_progress" },
  blocked: { label: "Halted", className: "status-blocked" },
  done: { label: "Done", className: "status-done" },
};

const PRIORITY_META = {
  low: { label: "Low", className: "priority-low" },
  medium: { label: "Medium", className: "priority-medium" },
  high: { label: "High", className: "priority-high" },
};

const DEPENDENCY_META = {
  none: { label: "None", className: "dependency-none" },
  low: { label: "Low", className: "dependency-low" },
  medium: { label: "Medium", className: "dependency-medium" },
  high: { label: "High", className: "dependency-high" },
};

const DEPENDENCY_SCOPE_META = {
  none: { label: "None", className: "scope-none" },
  team: { label: "Internal Team", className: "scope-team" },
  external: { label: "External Team/Company", className: "scope-external" },
};

const BOARD_STATUSES = ["in_progress", "blocked", "done"];

function createDefaultFilters() {
  return {
    search: "",
    status: "all",
    priority: "all",
    assignee: "all",
    dependencyScope: "all",
    sort: "updated_desc",
    onlyPinned: false,
    onlyOverdue: false,
  };
}

const uiState = {
  selectedTaskId: null,
  loginError: "",
  flash: null,
  syncStatus: "local",
  syncMessage: "Local mode active. Configure Firebase to enable cross-device realtime sync.",
  filters: createDefaultFilters(),
  selectedTaskIds: [],
};

const cloudState = {
  enabled: false,
  ready: false,
  docRef: null,
  setDocFn: null,
  unsubscribe: null,
  writeQueue: Promise.resolve(),
};

let flashTimerId = null;
let state = loadState();

appRoot.addEventListener("click", handleClick);
appRoot.addEventListener("submit", handleSubmit);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && uiState.selectedTaskId) {
    uiState.selectedTaskId = null;
    render();
  }
});
window.addEventListener("beforeunload", () => {
  if (cloudState.unsubscribe) {
    cloudState.unsubscribe();
  }
});

render();
void initCloudSync();

function createSeedState() {
  const now = new Date();
  const iso = now.toISOString();
  const users = [
    {
      id: "u-admin",
      name: "Avery Admin",
      username: "admin",
      password: "admin123",
      role: "admin",
    },
    {
      id: "u-manager",
      name: "Mia Manager",
      username: "manager",
      password: "manager123",
      role: "manager",
    },
    {
      id: "u-alex",
      name: "Alex Kim",
      username: "alex",
      password: "alex123",
      role: "member",
    },
    {
      id: "u-sam",
      name: "Sam Rivera",
      username: "sam",
      password: "sam123",
      role: "member",
    },
    {
      id: "u-rina",
      name: "Rina Das",
      username: "rina",
      password: "rina123",
      role: "member",
    },
  ];

  const taskA = {
    id: "t-onboarding",
    title: "Design onboarding checklist",
    description:
      "Create a collaborative onboarding checklist that new members can follow during their first week.",
    priority: "medium",
    status: "bucket",
    createdBy: "u-manager",
    assignedTo: null,
    dependencyFactor: "medium",
    dependencyScope: "team",
    dependentOn: "u-rina",
    externalDependencyName: "",
    dependencyNotes: "Waiting for design-system icon set before final pass.",
    label: "Design",
    checklist: [
      { id: "s-a-1", text: "Draft checklist outline", done: true },
      { id: "s-a-2", text: "Validate with support team", done: false },
    ],
    worklogs: [{ id: "w-a-1", userId: "u-manager", hours: 1.5, note: "Initial scoping", createdAt: pastHours(8) }],
    watchers: ["u-manager", "u-rina"],
    involvement: [
      {
        id: "i-a-1",
        userId: "u-manager",
        stars: 3,
        workSummary: "Planning onboarding structure and acceptance criteria.",
        updatedAt: pastHours(7),
      },
      {
        id: "i-a-2",
        userId: "u-rina",
        stars: 1,
        workSummary: "Shadowing design review and collecting notes.",
        updatedAt: pastHours(6),
      },
    ],
    pinned: true,
    attachments: [
      {
        id: "a-a-1",
        title: "Onboarding draft doc",
        url: "https://example.com/onboarding-draft",
        addedBy: "u-manager",
        createdAt: pastHours(7),
      },
    ],
    dueDate: dateOffset(3),
    internalEstimate: estimateFromDetails("medium", "onboarding checklist"),
    comments: [],
    history: [
      {
        id: "h-a-1",
        actorId: "u-manager",
        message: "Task created in the pending bucket.",
        createdAt: iso,
      },
    ],
    createdAt: iso,
    updatedAt: iso,
  };

  const taskB = {
    id: "t-handbook",
    title: "Update policy handbook visuals",
    description:
      "Refresh handbook diagrams, improve section headers, and align with the new visual baseline.",
    priority: "high",
    status: "in_progress",
    createdBy: "u-manager",
    assignedTo: "u-alex",
    dependencyFactor: "high",
    dependencyScope: "team",
    dependentOn: "u-manager",
    externalDependencyName: "",
    dependencyNotes: "Needs manager approval on section hierarchy and legal wording.",
    label: "Content",
    checklist: [
      { id: "s-b-1", text: "Refresh diagrams", done: true },
      { id: "s-b-2", text: "Update typography", done: false },
    ],
    worklogs: [{ id: "w-b-1", userId: "u-alex", hours: 3, note: "Layout updates", createdAt: pastHours(6) }],
    watchers: ["u-manager", "u-rina", "u-alex"],
    involvement: [
      {
        id: "i-b-1",
        userId: "u-alex",
        stars: 4,
        workSummary: "Driving handbook redesign and implementing visual updates.",
        updatedAt: pastHours(3),
      },
      {
        id: "i-b-2",
        userId: "u-manager",
        stars: 2,
        workSummary: "Reviewing hierarchy decisions and legal copy.",
        updatedAt: pastHours(5),
      },
      {
        id: "i-b-3",
        userId: "u-rina",
        stars: 1,
        workSummary: "Shadowing and preparing icon consistency review.",
        updatedAt: pastHours(4),
      },
    ],
    pinned: false,
    attachments: [],
    dueDate: dateOffset(5),
    internalEstimate: estimateFromDetails("high", "visual system update"),
    comments: [
      {
        id: "c-b-1",
        userId: "u-rina",
        body: "I can review icon consistency once the first draft is up.",
        createdAt: pastHours(10),
      },
    ],
    history: [
      {
        id: "h-b-1",
        actorId: "u-manager",
        message: "Task created and assigned to Alex.",
        createdAt: pastHours(14),
      },
      {
        id: "h-b-2",
        actorId: "u-alex",
        message: "Started work and opened collaboration thread.",
        createdAt: pastHours(9),
      },
    ],
    createdAt: pastHours(14),
    updatedAt: pastHours(9),
  };

  const taskC = {
    id: "t-kb",
    title: "Compile FAQ knowledge base",
    description:
      "Pull repeated support questions into a concise FAQ and mark unresolved items for follow-up.",
    priority: "low",
    status: "blocked",
    createdBy: "u-manager",
    assignedTo: "u-sam",
    dependencyFactor: "high",
    dependencyScope: "external",
    dependentOn: null,
    externalDependencyName: "Global Compliance Partners",
    dependencyNotes: "Pending compliance response from external legal partner.",
    label: "Compliance",
    checklist: [{ id: "s-c-1", text: "Collect unresolved legal answers", done: false }],
    worklogs: [{ id: "w-c-1", userId: "u-sam", hours: 2, note: "Prepared pending questions", createdAt: pastHours(4) }],
    watchers: ["u-manager", "u-sam"],
    involvement: [
      {
        id: "i-c-1",
        userId: "u-sam",
        stars: 3,
        workSummary: "Collecting unresolved support questions and legal blockers.",
        updatedAt: pastHours(2),
      },
      {
        id: "i-c-2",
        userId: "u-manager",
        stars: 2,
        workSummary: "Following up with external compliance partner.",
        updatedAt: pastHours(3),
      },
    ],
    pinned: false,
    attachments: [],
    dueDate: dateOffset(4),
    internalEstimate: estimateFromDetails("low", "faq compilation"),
    comments: [
      {
        id: "c-c-1",
        userId: "u-sam",
        body: "Waiting for two pending answers from legal before final pass.",
        createdAt: pastHours(5),
      },
    ],
    history: [
      {
        id: "h-c-1",
        actorId: "u-manager",
        message: "Task moved to halted until dependencies arrive.",
        createdAt: pastHours(5),
      },
    ],
    createdAt: pastHours(18),
    updatedAt: pastHours(5),
  };

  const taskD = {
    id: "t-retro",
    title: "Ship sprint retrospective note",
    description: "Capture key wins, misses, and action items from the sprint closure.",
    priority: "medium",
    status: "done",
    createdBy: "u-manager",
    assignedTo: "u-rina",
    dependencyFactor: "low",
    dependencyScope: "team",
    dependentOn: "u-manager",
    externalDependencyName: "",
    dependencyNotes: "Manager sign-off required at closure.",
    label: "Retro",
    checklist: [{ id: "s-d-1", text: "Archive in wiki", done: true }],
    worklogs: [{ id: "w-d-1", userId: "u-rina", hours: 1, note: "Final clean-up", createdAt: pastHours(1) }],
    watchers: ["u-manager"],
    involvement: [
      {
        id: "i-d-1",
        userId: "u-rina",
        stars: 4,
        workSummary: "Owned retrospective drafting and final wiki packaging.",
        updatedAt: pastHours(2),
      },
      {
        id: "i-d-2",
        userId: "u-manager",
        stars: 2,
        workSummary: "Reviewed and approved closure notes.",
        updatedAt: pastHours(2),
      },
    ],
    pinned: false,
    attachments: [],
    dueDate: dateOffset(-1),
    internalEstimate: estimateFromDetails("medium", "retrospective notes"),
    comments: [
      {
        id: "c-d-1",
        userId: "u-manager",
        body: "Approved. Please archive in the team wiki folder.",
        createdAt: pastHours(2),
      },
    ],
    history: [
      {
        id: "h-d-1",
        actorId: "u-rina",
        message: "Task completed and handed off to manager.",
        createdAt: pastHours(2),
      },
    ],
    createdAt: pastHours(26),
    updatedAt: pastHours(2),
  };

  return {
    version: 6,
    users,
    tasks: [taskA, taskB, taskC, taskD],
    nudges: [
      {
        id: "n-1",
        taskId: "t-kb",
        fromUserId: "u-manager",
        toUserId: "u-sam",
        message: "Please share an ETA update in the thread before standup.",
        createdAt: pastHours(1),
        readAt: null,
      },
    ],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = createSeedState();
    persistLocalState(seed);
    return seed;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = sanitizeState(parsed);
    if (!normalized) {
      throw new Error("Invalid state");
    }
    return normalized;
  } catch {
    const seed = createSeedState();
    persistLocalState(seed);
    return seed;
  }
}

function sanitizeState(input) {
  if (!input || !Array.isArray(input.users) || !Array.isArray(input.tasks) || !Array.isArray(input.nudges)) {
    return null;
  }

  const users = input.users
    .filter((user) => user && typeof user.id === "string" && typeof user.username === "string")
    .map((user) => ({
      id: String(user.id),
      name: String(user.name || "Unknown User"),
      username: String(user.username || ""),
      password: String(user.password || ""),
      role: ["admin", "manager", "member"].includes(user.role) ? user.role : "member",
    }));
  const userIdSet = new Set(users.map((user) => user.id));

  const tasks = input.tasks
    .filter((task) => task && typeof task.id === "string")
    .map((task) => {
      const dependencyFactor = normalizeDependencyFactor(task.dependencyFactor);
      let dependencyScope = normalizeDependencyScope(task.dependencyScope);
      const dependentOn = task.dependentOn && userIdSet.has(String(task.dependentOn)) ? String(task.dependentOn) : null;
      const externalDependencyName = normalizeExternalDependencyName(task.externalDependencyName || "");
      const label = String(task.label || "").trim().slice(0, 28);
      const checklist = Array.isArray(task.checklist)
        ? task.checklist
            .filter((item) => item && typeof item.id === "string")
            .map((item) => ({
              id: String(item.id),
              text: String(item.text || "").trim().slice(0, 120),
              done: Boolean(item.done),
            }))
        : [];
      const worklogs = Array.isArray(task.worklogs)
        ? task.worklogs
            .filter((entry) => entry && typeof entry.id === "string")
            .map((entry) => ({
              id: String(entry.id),
              userId: userIdSet.has(String(entry.userId || "")) ? String(entry.userId) : "",
              hours: normalizeWorklogHours(entry.hours),
              note: String(entry.note || "").trim().slice(0, 180),
              createdAt: String(entry.createdAt || new Date().toISOString()),
            }))
        : [];
      const watchers = Array.isArray(task.watchers)
        ? [...new Set(task.watchers.map((watcherId) => String(watcherId)).filter((watcherId) => userIdSet.has(watcherId)))]
        : [];
      const involvementByUser = new Map();
      if (Array.isArray(task.involvement)) {
        task.involvement.forEach((entry) => {
          if (!entry) {
            return;
          }
          const userId = String(entry.userId || "");
          if (!userIdSet.has(userId)) {
            return;
          }
          const stars = normalizeInvolvementStars(entry.stars);
          const workSummary = String(entry.workSummary || entry.work || "")
            .trim()
            .slice(0, 180);
          if (!workSummary) {
            return;
          }
          const updatedAt = String(entry.updatedAt || new Date().toISOString());
          const nextEntry = {
            id: typeof entry.id === "string" ? String(entry.id) : `involvement-${task.id}-${userId}`,
            userId,
            stars,
            workSummary,
            updatedAt,
          };
          const previous = involvementByUser.get(userId);
          const nextTime = Number.isFinite(new Date(updatedAt).getTime()) ? new Date(updatedAt).getTime() : 0;
          const previousTime =
            previous && Number.isFinite(new Date(previous.updatedAt).getTime()) ? new Date(previous.updatedAt).getTime() : 0;
          if (!previous || nextTime >= previousTime) {
            involvementByUser.set(userId, nextEntry);
          }
        });
      }
      const involvement = [...involvementByUser.values()];
      const attachments = Array.isArray(task.attachments)
        ? task.attachments
            .filter((attachment) => attachment && typeof attachment.id === "string")
            .map((attachment) => ({
              id: String(attachment.id),
              title: String(attachment.title || "").trim().slice(0, 90),
              url: normalizeAttachmentUrl(attachment.url || ""),
              addedBy: userIdSet.has(String(attachment.addedBy || "")) ? String(attachment.addedBy) : "",
              createdAt: String(attachment.createdAt || new Date().toISOString()),
            }))
            .filter((attachment) => attachment.url)
        : [];

      if (dependencyFactor !== "none" && dependencyScope === "none") {
        if (dependentOn) {
          dependencyScope = "team";
        } else if (externalDependencyName) {
          dependencyScope = "external";
        }
      }

      const resolvedDependentOn = dependencyFactor === "none" ? null : dependentOn;
      const resolvedExternalDependencyName = dependencyFactor === "none" ? "" : externalDependencyName;
      const resolvedDependencyScope = dependencyFactor === "none" ? "none" : dependencyScope;

      return {
        id: String(task.id),
        title: String(task.title || "Untitled Task"),
        description: String(task.description || ""),
        priority: PRIORITY_META[task.priority] ? task.priority : "medium",
        status: STATUS_META[task.status] ? task.status : "bucket",
        createdBy: task.createdBy ? String(task.createdBy) : "",
        assignedTo: task.assignedTo ? String(task.assignedTo) : null,
        dependencyFactor,
        dependencyScope: resolvedDependencyScope,
        dependentOn: resolvedDependentOn,
        externalDependencyName: resolvedExternalDependencyName,
        dependencyNotes: String(task.dependencyNotes || ""),
        label,
        referenceLink: normalizeAttachmentUrl(task.referenceLink || ""),
        checklist,
        worklogs,
        watchers,
        involvement,
        pinned: Boolean(task.pinned),
        attachments,
        dueDate: task.dueDate ? String(task.dueDate) : null,
        internalEstimate:
          task.internalEstimate && typeof task.internalEstimate === "object"
            ? {
                optimisticHours: Number(task.internalEstimate.optimisticHours || 1),
                expectedHours: Number(task.internalEstimate.expectedHours || 1),
                pessimisticHours: Number(task.internalEstimate.pessimisticHours || 1),
              }
            : estimateFromDetails(task.priority, task.description),
        comments: Array.isArray(task.comments)
          ? task.comments
              .filter((comment) => comment && typeof comment.id === "string")
              .map((comment) => ({
                id: String(comment.id),
                userId: String(comment.userId || ""),
                body: String(comment.body || ""),
                mentions: Array.isArray(comment.mentions)
                  ? [...new Set(comment.mentions.map((mentionId) => String(mentionId)).filter((mentionId) => userIdSet.has(mentionId)))]
                  : [],
                mentionReadAt:
                  comment.mentionReadAt && typeof comment.mentionReadAt === "object"
                    ? Object.fromEntries(
                        Object.entries(comment.mentionReadAt)
                          .filter(([mentionId]) => userIdSet.has(String(mentionId)))
                          .map(([mentionId, readAt]) => [String(mentionId), String(readAt || "")])
                      )
                    : {},
                createdAt: String(comment.createdAt || new Date().toISOString()),
              }))
          : [],
        history: Array.isArray(task.history)
          ? task.history
              .filter((entry) => entry && typeof entry.id === "string")
              .map((entry) => ({
                id: String(entry.id),
                actorId: String(entry.actorId || ""),
                message: String(entry.message || ""),
                createdAt: String(entry.createdAt || new Date().toISOString()),
              }))
          : [],
        createdAt: String(task.createdAt || new Date().toISOString()),
        updatedAt: String(task.updatedAt || task.createdAt || new Date().toISOString()),
      };
    });

  const nudges = input.nudges
    .filter((nudge) => nudge && typeof nudge.id === "string")
    .map((nudge) => ({
      id: String(nudge.id),
      taskId: String(nudge.taskId || ""),
      fromUserId: String(nudge.fromUserId || ""),
      toUserId: String(nudge.toUserId || ""),
      message: String(nudge.message || ""),
      createdAt: String(nudge.createdAt || new Date().toISOString()),
      readAt: nudge.readAt ? String(nudge.readAt) : null,
    }));

  return {
    version: Number(input.version || 6),
    users,
    tasks,
    nudges,
  };
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function persistLocalState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function saveState(options = {}) {
  persistLocalState(state);
  if (options.localOnly) {
    return;
  }
  queueCloudWrite(state);
}

function queueCloudWrite(nextState) {
  if (!cloudState.enabled || !cloudState.ready || !cloudState.docRef || !cloudState.setDocFn) {
    return;
  }

  const payload = {
    ...cloneState(nextState),
    updatedAt: new Date().toISOString(),
  };

  cloudState.writeQueue = cloudState.writeQueue
    .then(() => cloudState.setDocFn(cloudState.docRef, payload))
    .catch((error) => {
      console.error("Cloud write failed", error);
      uiState.syncStatus = "error";
      uiState.syncMessage = "Cloud write failed. App remains usable with local cache.";
      render();
    });
}

async function initCloudSync() {
  if (!cloudSyncEnabled) {
    uiState.syncStatus = "local";
    uiState.syncMessage = "Cloud mode disabled in firebase-config.js. Running in local mode.";
    render();
    return;
  }

  if (!isFirebaseConfigured(firebaseConfig)) {
    uiState.syncStatus = "local";
    uiState.syncMessage = "Firebase config is incomplete. Fill firebase-config.js to enable realtime sync.";
    render();
    return;
  }

  uiState.syncStatus = "connecting";
  uiState.syncMessage = "Connecting to cloud workspace...";
  render();

  try {
    const [{ initializeApp }, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
    ]);

    const { doc, getDoc, getFirestore, onSnapshot, setDoc } = firestoreModule;
    const firebaseApp = initializeApp(firebaseConfig);
    const firestore = getFirestore(firebaseApp);

    cloudState.enabled = true;
    cloudState.docRef = doc(firestore, CLOUD_COLLECTION, CLOUD_DOCUMENT);
    cloudState.setDocFn = setDoc;

    const existing = await getDoc(cloudState.docRef);
    if (!existing.exists()) {
      await setDoc(cloudState.docRef, {
        ...cloneState(state),
        updatedAt: new Date().toISOString(),
      });
    } else {
      const remote = sanitizeState(existing.data());
      if (remote) {
        state = remote;
        ensureSessionStillValid();
        saveState({ localOnly: true });
      }
    }

    cloudState.unsubscribe = onSnapshot(
      cloudState.docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const incoming = sanitizeState(snapshot.data());
        if (!incoming) {
          return;
        }

        state = incoming;
        ensureSessionStillValid();
        saveState({ localOnly: true });

        cloudState.ready = true;
        uiState.syncStatus = "online";
        uiState.syncMessage = "Realtime sync active across devices.";
        render();
      },
      (error) => {
        console.error("Cloud listener error", error);
        cloudState.ready = false;
        uiState.syncStatus = "error";
        uiState.syncMessage = "Cloud sync listener disconnected. Local mode remains available.";
        render();
      }
    );

    cloudState.ready = true;
    uiState.syncStatus = "online";
    uiState.syncMessage = "Realtime sync active across devices.";
    setFlash("Cloud sync connected.", "success");
    render();
  } catch (error) {
    console.error("Cloud sync initialization failed", error);
    cloudState.enabled = false;
    cloudState.ready = false;
    uiState.syncStatus = "error";
    uiState.syncMessage = "Cloud sync setup failed. Running with local data only.";
    setFlash("Cloud connection failed. Switched to local mode.", "error");
    render();
  }
}

function isFirebaseConfigured(config) {
  if (!config || typeof config !== "object") {
    return false;
  }

  const required = ["apiKey", "authDomain", "projectId", "appId"];
  return required.every((key) => typeof config[key] === "string" && config[key].trim().length > 0);
}

function ensureSessionStillValid() {
  const sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    return;
  }

  const exists = state.users.some((candidate) => candidate.id === sessionId);
  if (exists) {
    return;
  }

  setCurrentUser("");
  uiState.selectedTaskId = null;
  uiState.selectedTaskIds = [];
  uiState.loginError = "Your account no longer exists in this workspace.";
}

function getCurrentUser() {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) {
    return null;
  }
  return state.users.find((user) => user.id === userId) || null;
}

function setCurrentUser(userId) {
  if (!userId) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, userId);
}

function render() {
  const user = getCurrentUser();
  if (!user) {
    appRoot.innerHTML = renderLogin();
    return;
  }

  pruneSelectedTaskIds();
  const visibleTasks = getVisibleTasks();
  const bucketTasks = visibleTasks.filter((task) => task.status === "bucket");
  const board = {
    in_progress: visibleTasks.filter((task) => task.status === "in_progress"),
    blocked: visibleTasks.filter((task) => task.status === "blocked"),
    done: visibleTasks.filter((task) => task.status === "done"),
  };

  const unreadNudges = state.nudges.filter((nudge) => nudge.toUserId === user.id && !nudge.readAt).length;
  const myOpenTasks = state.tasks.filter(
    (task) => task.assignedTo === user.id && task.status !== "done" && task.status !== "bucket"
  ).length;
  const overdueCount = state.tasks.filter((task) => isTaskOverdue(task)).length;
  const mentionCount = getMentionInbox(user.id).filter((mention) => !mention.readAt).length;
  const completedCount = visibleTasks.filter((task) => task.status === "done").length;

  appRoot.innerHTML = `
    <div class="screen">
      <header class="app-header pixel-panel animate-rise">
        <div class="header-left">
          <h1 class="header-title">Pixel Task Nexus</h1>
          <p class="header-subtitle">Shared task board with manager nudges, collaboration threads, and admin controls.</p>
        </div>
        <div class="header-right">
          ${renderSyncBadge()}
          <span class="role-chip ${escapeHtml(user.role)}">${escapeHtml(user.name)} · ${escapeHtml(user.role)}</span>
          ${uiState.syncStatus === "online" ? "" : '<button class="btn small" data-action="reset-data" type="button">Reset Demo Data</button>'}
          <button class="btn small" data-action="logout" type="button">Logout</button>
        </div>
      </header>

      ${renderFlash()}
      ${renderSyncBanner()}

      <section class="stats-grid">
        <article class="stat-card pixel-panel">
          <span class="stat-label">All Tasks</span>
          <span class="stat-value">${visibleTasks.length}</span>
        </article>
        <article class="stat-card pixel-panel">
          <span class="stat-label">Completed Tasks</span>
          <span class="stat-value">${completedCount}</span>
        </article>
        <article class="stat-card pixel-panel">
          <span class="stat-label">My Active</span>
          <span class="stat-value">${myOpenTasks}</span>
        </article>
        <article class="stat-card pixel-panel">
          <span class="stat-label">Unread Nudges</span>
          <span class="stat-value">${unreadNudges}</span>
        </article>
        <article class="stat-card pixel-panel">
          <span class="stat-label">Overdue</span>
          <span class="stat-value">${overdueCount}</span>
        </article>
        <article class="stat-card pixel-panel">
          <span class="stat-label">Mentions</span>
          <span class="stat-value">${mentionCount}</span>
        </article>
      </section>

      <section class="workspace-grid">
        <main class="main-column">
          ${canManage(user) ? renderManagerPanel(user) : ""}
          ${renderBucketSection(bucketTasks, user)}
          ${renderBoard(board, user)}
          ${renderDependencyNodesSection()}
        </main>

        <aside class="side-column">
          ${renderWatchlistPanel(user)}
          ${renderCompletedByYou(user)}
          ${renderMentionInbox(user)}
          ${renderNudgeInbox(user)}
          ${renderActivityFeed()}
          ${isAdmin(user) ? renderAdminPanel() : ""}
        </aside>
      </section>
    </div>

    ${uiState.selectedTaskId ? renderTaskModal(user) : ""}
  `;
}

function renderFlash() {
  if (!uiState.flash) {
    return "";
  }
  return `<div class="flash ${escapeHtml(uiState.flash.type)}">${escapeHtml(uiState.flash.message)}</div>`;
}

function renderSyncBadge() {
  let label = "Local";
  if (uiState.syncStatus === "online") {
    label = "Cloud Live";
  } else if (uiState.syncStatus === "connecting") {
    label = "Connecting";
  } else if (uiState.syncStatus === "error") {
    label = "Sync Error";
  }

  return `<span class="pill sync-pill ${escapeHtml(uiState.syncStatus)}">${escapeHtml(label)}</span>`;
}

function renderSyncBanner() {
  if (uiState.syncStatus === "online") {
    return "";
  }

  return `<div class="sync-banner ${uiState.syncStatus === "error" ? "error" : ""}">${escapeHtml(
    uiState.syncMessage
  )}</div>`;
}

function renderFilterPanel(user) {
  const assigneeOptions = state.users
    .map(
      (candidate) =>
        `<option value="${escapeHtml(candidate.id)}" ${
          uiState.filters.assignee === candidate.id ? "selected" : ""
        }>${escapeHtml(candidate.name)}</option>`
    )
    .join("");

  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Smart Filters</h2>
          <p class="panel-subtitle">Search, filter, and sort tasks quickly. All views update in real-time.</p>
        </div>
        <div class="inline-actions">
          <button class="btn small ghost" type="button" data-action="clear-filters">Clear</button>
        </div>
      </div>

      <form id="filter-form" class="form-grid">
        <div class="field full">
          <label for="filterSearch">Search</label>
          <input id="filterSearch" name="search" value="${escapeHtml(uiState.filters.search)}" placeholder="Title, description, label, dependency" />
        </div>
        <div class="field">
          <label for="filterStatus">Status</label>
          <select id="filterStatus" name="status">
            <option value="all" ${uiState.filters.status === "all" ? "selected" : ""}>All</option>
            <option value="bucket" ${uiState.filters.status === "bucket" ? "selected" : ""}>Bucket</option>
            <option value="in_progress" ${uiState.filters.status === "in_progress" ? "selected" : ""}>In Progress</option>
            <option value="blocked" ${uiState.filters.status === "blocked" ? "selected" : ""}>Halted</option>
            <option value="done" ${uiState.filters.status === "done" ? "selected" : ""}>Done</option>
          </select>
        </div>
        <div class="field">
          <label for="filterPriority">Priority</label>
          <select id="filterPriority" name="priority">
            <option value="all" ${uiState.filters.priority === "all" ? "selected" : ""}>All</option>
            <option value="high" ${uiState.filters.priority === "high" ? "selected" : ""}>High</option>
            <option value="medium" ${uiState.filters.priority === "medium" ? "selected" : ""}>Medium</option>
            <option value="low" ${uiState.filters.priority === "low" ? "selected" : ""}>Low</option>
          </select>
        </div>
        <div class="field">
          <label for="filterAssignee">Assignee</label>
          <select id="filterAssignee" name="assignee">
            <option value="all" ${uiState.filters.assignee === "all" ? "selected" : ""}>All</option>
            <option value="me" ${uiState.filters.assignee === "me" ? "selected" : ""}>Assigned To Me</option>
            ${assigneeOptions}
          </select>
        </div>
        <div class="field">
          <label for="filterScope">Dependency Source</label>
          <select id="filterScope" name="dependencyScope">
            <option value="all" ${uiState.filters.dependencyScope === "all" ? "selected" : ""}>All</option>
            <option value="team" ${uiState.filters.dependencyScope === "team" ? "selected" : ""}>Internal Team</option>
            <option value="external" ${uiState.filters.dependencyScope === "external" ? "selected" : ""}>External</option>
            <option value="none" ${uiState.filters.dependencyScope === "none" ? "selected" : ""}>None</option>
          </select>
        </div>
        <div class="field">
          <label for="filterSort">Sort</label>
          <select id="filterSort" name="sort">
            <option value="updated_desc" ${uiState.filters.sort === "updated_desc" ? "selected" : ""}>Latest Updated</option>
            <option value="due_asc" ${uiState.filters.sort === "due_asc" ? "selected" : ""}>Due Date (Earliest)</option>
            <option value="priority_desc" ${uiState.filters.sort === "priority_desc" ? "selected" : ""}>Priority (High First)</option>
            <option value="title_asc" ${uiState.filters.sort === "title_asc" ? "selected" : ""}>Title (A-Z)</option>
          </select>
        </div>
        <div class="field full">
          <div class="inline-actions">
            <label class="checkbox-row">
              <input type="checkbox" name="onlyPinned" ${uiState.filters.onlyPinned ? "checked" : ""} />
              <span>Pinned Only</span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="onlyOverdue" ${uiState.filters.onlyOverdue ? "checked" : ""} />
              <span>Overdue Only</span>
            </label>
          </div>
        </div>
        <div class="field full">
          <button class="btn primary" type="submit">Apply Filters</button>
        </div>
      </form>
    </section>
  `;
}

function renderLogin() {
  const demoUsers = state.users.filter((user) => ["admin", "manager", "member"].includes(user.role));

  return `
    <section class="login-layout">
      <div class="login-panel pixel-panel animate-rise">
        <div class="login-left">
          <h1 class="login-title">Pixel Task Nexus</h1>
          <p class="login-subtitle">
            Professional, light-mode task collaboration with shared visibility, pending task bucket pickup,
            manager nudges, and admin-level controls.
          </p>
          ${renderSyncBanner()}
          <div class="credential-grid">
            ${demoUsers
              .map(
                (user) => `
                <div class="credential-row">
                  <div>
                    <strong>${escapeHtml(user.role.toUpperCase())}</strong> · ${escapeHtml(user.name)}
                    <div class="text-muted">${escapeHtml(user.username)} / ${escapeHtml(user.username)}123</div>
                  </div>
                  <button class="btn small" type="button" data-action="login-demo" data-username="${escapeHtml(
                    user.username
                  )}">Use</button>
                </div>
              `
              )
              .join("")}
          </div>
          <p class="footer-note">
            Internal task estimates are saved per task for planning, but intentionally hidden from UI surfaces.
          </p>
        </div>

        <div class="login-right">
          <h2 class="panel-title">Secure Login</h2>
          ${uiState.loginError ? `<div class="login-error">${escapeHtml(uiState.loginError)}</div>` : ""}
          <form id="login-form" class="login-form">
            <div class="field">
              <label for="username">Username</label>
              <input id="username" name="username" autocomplete="username" required />
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" autocomplete="current-password" required />
            </div>
            <button class="btn primary" type="submit">Login</button>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderManagerPanel(user) {
  const assignableTasks = sortedTasks().filter((task) => task.assignedTo && task.status !== "done");
  const dependencyOwnerOptions = state.users
    .map((candidate) => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)}</option>`)
    .join("");
  const assigneeOptions = state.users
    .map(
      (candidate) =>
        `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)} (${escapeHtml(candidate.role)})</option>`
    )
    .join("");
  const selectedCount = uiState.selectedTaskIds.length;

  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Manager Controls</h2>
          <p class="panel-subtitle">Create bucket tasks and nudge assignees when progress stalls.</p>
        </div>
      </div>

      <form id="create-task-form" class="form-grid form-centered">
        <div class="field">
          <label for="taskTitle">Task Title</label>
          <input id="taskTitle" name="title" maxlength="90" required />
        </div>
        <div class="field">
          <label for="taskPriority">Priority</label>
          <select id="taskPriority" name="priority" required>
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div class="field full">
          <label for="taskDescription">Description</label>
          <textarea id="taskDescription" name="description" maxlength="360" required></textarea>
        </div>
        <div class="field">
          <label for="taskDueDate">Due Date</label>
          <input id="taskDueDate" name="dueDate" type="date" />
        </div>
        <div class="field">
          <label for="taskDependencyFactor">Dependency Factor</label>
          <select id="taskDependencyFactor" name="dependencyFactor">
            <option value="none" selected>None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div class="field">
          <label for="taskDependencyScope">Dependency Source</label>
          <select id="taskDependencyScope" name="dependencyScope">
            <option value="none" selected>No dependency owner</option>
            <option value="team">Internal Team</option>
            <option value="external">External Team / Company</option>
          </select>
        </div>
        <div class="field">
          <label for="taskDependentOn">Dependent On</label>
          <select id="taskDependentOn" name="dependentOn">
            <option value="">Select team member</option>
            ${dependencyOwnerOptions}
          </select>
        </div>
        <div class="field">
          <label for="taskExternalDependency">External Team/Company</label>
          <input
            id="taskExternalDependency"
            name="externalDependencyName"
            maxlength="72"
            placeholder="Acme Integration Partner"
          />
        </div>
        <div class="field">
          <label for="taskLabel">Label (Optional)</label>
          <input id="taskLabel" name="label" maxlength="28" placeholder="Ops, Design, Policy" />
        </div>
        <div class="field">
          <label for="taskReferenceLink">Reference URL (Optional)</label>
          <input id="taskReferenceLink" name="referenceLink" maxlength="200" placeholder="https://docs.example.com/spec" />
        </div>
        <div class="field full">
          <label for="taskDependencyNotes">Dependency Note (Optional)</label>
          <input
            id="taskDependencyNotes"
            name="dependencyNotes"
            maxlength="140"
            placeholder="Waiting on compliance review, design handoff, or API release"
          />
        </div>
        <div class="field full">
          <button class="btn primary" type="submit">Add To Bucket</button>
        </div>
      </form>

      <form id="nudge-form" class="inline-form">
        <h3>Send Nudge</h3>
        <div class="split">
          <select name="taskId" required>
            <option value="">Select assigned task</option>
            ${assignableTasks
              .map(
                (task) =>
                  `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)} · ${escapeHtml(
                    displayUserName(task.assignedTo)
                  )}</option>`
              )
              .join("")}
          </select>
          <button class="btn warn" type="submit">Nudge Assignee</button>
        </div>
        <div class="field">
          <label for="nudgeMessage">Message</label>
          <input
            id="nudgeMessage"
            name="message"
            maxlength="140"
            placeholder="Share progress before EOD and update blockers"
            required
          />
        </div>
      </form>

      <form id="bulk-action-form" class="inline-form">
        <h3>Bulk Actions (${selectedCount} selected)</h3>
        <div class="split split-even">
          <select name="bulkStatus">
            <option value="">Keep status</option>
            <option value="bucket">Bucket</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Halted</option>
            <option value="done">Done</option>
          </select>
          <select name="bulkAssignee">
            <option value="">Keep assignee</option>
            <option value="__unassign__">Unassign</option>
            ${assigneeOptions}
          </select>
        </div>
        <div class="inline-actions">
          <button class="btn" type="submit" ${selectedCount ? "" : "disabled"}>Apply To Selected</button>
          <button class="btn ghost" type="button" data-action="clear-selected" ${selectedCount ? "" : "disabled"}>Clear Selection</button>
        </div>
        <p class="text-muted">Select tasks using the Select button on cards to use bulk updates.</p>
      </form>
    </section>
  `;
}

function renderBucketSection(bucketTasks, user) {
  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Task Bucket</h2>
          <p class="panel-subtitle">Pending tasks managers dropped in. Team members can pick what they want to execute.</p>
        </div>
      </div>

      ${
        bucketTasks.length
          ? `<div class="bucket-grid">${bucketTasks
              .map((task) => renderTaskCard(task, user, "bucket"))
              .join("")}</div>`
          : '<div class="empty-state">Bucket is clear. Manager can add new tasks using the control panel.</div>'
      }
    </section>
  `;
}

function renderBoard(board, user) {
  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Team Workflow Board</h2>
          <p class="panel-subtitle">Everyone can see every task and collaborate in each task thread.</p>
        </div>
      </div>

      <div class="task-columns">
        ${BOARD_STATUSES.map((status) => renderColumn(status, board[status], user)).join("")}
      </div>
    </section>
  `;
}

function renderDependencyNodesSection() {
  const graph = buildDependencyGraph();
  const userStatsCards = state.users
    .map((user) => {
      const stats = getUserProjectStats(user.id);
      return `
        <article class="node-user-card">
          <div class="row-top">
            <strong>${escapeHtml(user.name)}</strong>
            <span class="role-chip ${escapeHtml(user.role)}">${escapeHtml(user.role)}</span>
          </div>
          <div class="node-metric-row">
            <span class="pill">Projects: ${stats.totalProjects}</span>
            <span class="pill">Active: ${stats.activeProjects}</span>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Dependency Nodes</h2>
          <p class="panel-subtitle">People are shown as nodes. Edges represent who depends on whom for delivery.</p>
        </div>
      </div>

      <div class="node-summary-grid">
        ${userStatsCards}
      </div>

      ${
        graph.nodes.length
          ? `<div class="node-canvas-shell">${renderDependencyGraphSvg(graph)}</div>`
          : '<div class="empty-state">No dependency nodes available yet.</div>'
      }

      ${
        graph.fallbackMode
          ? '<div class="sync-banner">No explicit dependency links found yet. Showing collaboration links based on assignment and creator relationships.</div>'
          : ""
      }

      <div class="node-legend-row">
        <span class="pill">Blue lines: Internal team dependency</span>
        <span class="pill">Rose dashed: External team/company dependency</span>
        ${graph.fallbackMode ? '<span class="pill">Slate dashed: Collaboration fallback link</span>' : ""}
      </div>
    </section>
  `;
}

function renderDependencyGraphSvg(graph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesMarkup = graph.edges
    .map((edge) => {
      const from = nodeById.get(edge.source);
      const to = nodeById.get(edge.target);
      if (!from || !to) {
        return "";
      }
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const edgeClass =
        edge.kind === "fallback"
          ? "node-edge-fallback"
          : edge.scope === "external"
            ? "node-edge-external"
            : "node-edge-team";
      return `
        <g>
          <line
            class="node-edge ${edgeClass}"
            x1="${from.x}"
            y1="${from.y}"
            x2="${to.x}"
            y2="${to.y}"
          />
          <text class="node-edge-count" x="${midX}" y="${midY}">${edge.count}</text>
        </g>
      `;
    })
    .join("");

  const nodesMarkup = graph.nodes
    .map((node) => {
      const metric = node.kind === "user" ? `${node.totalProjects} projects` : `${node.totalProjects} deps`;
      return `
        <g class="graph-node" transform="translate(${node.x} ${node.y})">
          <circle class="node-circle ${node.kind === "user" ? "node-user" : "node-external"}" r="34"></circle>
          <text class="node-label" y="-3">${escapeHtml(shortNodeLabel(node.label, 16))}</text>
          <text class="node-sub-label" y="14">${escapeHtml(metric)}</text>
        </g>
      `;
    })
    .join("");

  return `
    <svg
      class="node-canvas"
      viewBox="0 0 ${graph.width} ${graph.height}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Dependency node graph"
    >
      <rect class="node-graph-bg" x="0" y="0" width="${graph.width}" height="${graph.height}" rx="18"></rect>
      ${edgesMarkup}
      ${nodesMarkup}
    </svg>
  `;
}

function buildDependencyGraph() {
  const users = [...state.users].sort((a, b) => a.name.localeCompare(b.name));
  const externalUsage = new Map();
  state.tasks.forEach((task) => {
    const factor = normalizeDependencyFactor(task.dependencyFactor);
    const scope = normalizeDependencyScope(task.dependencyScope);
    if (factor === "none" || scope !== "external") {
      return;
    }
    const externalName = normalizeExternalDependencyName(task.externalDependencyName);
    if (!externalName) {
      return;
    }
    const externalKey = externalName.toLowerCase();
    const current = externalUsage.get(externalKey) || { label: externalName, count: 0 };
    current.count += 1;
    externalUsage.set(externalKey, current);
  });

  const userOrbitCount = Math.max(1, users.length);
  const externalOrbitCount = Math.max(1, externalUsage.size);
  const ringSize = Math.max(userOrbitCount, externalOrbitCount);
  const width = clampNumber(780 + ringSize * 28, 820, 1040);
  const height = clampNumber(400 + ringSize * 20, 440, 620);
  const centerX = width / 2;
  const centerY = height / 2;

  const userCount = users.length || 1;
  const baseRadius = Math.min(width, height) * 0.28;
  const userRadius = clampNumber(baseRadius, 130, 190);
  const userNodes = users.map((user, index) => {
    const angle = (-Math.PI / 2) + (index * (2 * Math.PI)) / userCount;
    const stats = getUserProjectStats(user.id);
    return {
      id: user.id,
      label: user.name,
      kind: "user",
      totalProjects: stats.totalProjects,
      x: roundNumber(centerX + userRadius * Math.cos(angle)),
      y: roundNumber(centerY + userRadius * Math.sin(angle)),
    };
  });

  const externalEntries = [...externalUsage.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  const externalCount = externalEntries.length || 1;
  const externalRadius = externalEntries.length ? clampNumber(userRadius + 62, 186, 248) : userRadius;
  const externalNodes = externalEntries.map(([externalKey, details], index) => {
    const angle = (-Math.PI / 2) + ((index + 0.5) * (2 * Math.PI)) / externalCount;
    return {
      id: `ext:${externalKey}`,
      label: details.label,
      kind: "external",
      totalProjects: details.count,
      x: roundNumber(centerX + externalRadius * Math.cos(angle)),
      y: roundNumber(centerY + externalRadius * Math.sin(angle)),
    };
  });

  const nodes = [...userNodes, ...externalNodes];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeMap = new Map();
  const fallbackEdgeMap = new Map();

  state.tasks.forEach((task) => {
    const factor = normalizeDependencyFactor(task.dependencyFactor);
    const scope = normalizeDependencyScope(task.dependencyScope);
    if (factor === "none" || scope === "none") {
      return;
    }

    const source = task.assignedTo || task.createdBy;
    if (!source || !nodeById.has(source)) {
      return;
    }

    let target = null;
    if (scope === "team") {
      target = task.dependentOn && nodeById.has(task.dependentOn) ? task.dependentOn : null;
    } else if (scope === "external") {
      const externalName = normalizeExternalDependencyName(task.externalDependencyName);
      target = externalName ? `ext:${externalName.toLowerCase()}` : null;
    }

    if (!target || !nodeById.has(target) || source === target) {
      return;
    }

    const edgeKey = `${source}|${target}|${scope}`;
    const current = edgeMap.get(edgeKey) || { source, target, scope, count: 0, kind: "dependency" };
    current.count += 1;
    edgeMap.set(edgeKey, current);
  });

  if (edgeMap.size === 0) {
    state.tasks.forEach((task) => {
      const createdBy = task.createdBy && nodeById.has(task.createdBy) ? task.createdBy : null;
      const assignedTo = task.assignedTo && nodeById.has(task.assignedTo) ? task.assignedTo : null;
      const dependentOn = task.dependentOn && nodeById.has(task.dependentOn) ? task.dependentOn : null;
      const watcherIds = Array.isArray(task.watchers)
        ? [...new Set(task.watchers.map((watcherId) => String(watcherId)).filter((watcherId) => nodeById.has(watcherId)))]
        : [];
      const source = assignedTo || createdBy || dependentOn || watcherIds[0] || null;
      if (!source) {
        return;
      }

      const targets = [...new Set([createdBy, assignedTo, dependentOn, ...watcherIds].filter(Boolean))]
        .filter((target) => target !== source);
      targets.forEach((target) => {
        const edgeKey = `${source}|${target}|fallback`;
        const current = fallbackEdgeMap.get(edgeKey) || { source, target, scope: "team", count: 0, kind: "fallback" };
        current.count += 1;
        fallbackEdgeMap.set(edgeKey, current);
      });
    });
  }

  const resolvedEdges = edgeMap.size ? [...edgeMap.values()] : [...fallbackEdgeMap.values()];

  return {
    width,
    height,
    nodes,
    edges: resolvedEdges,
    fallbackMode: edgeMap.size === 0 && fallbackEdgeMap.size > 0,
  };
}

function getUserProjectStats(userId) {
  const involvedTasks = state.tasks.filter((task) => {
    if (task.assignedTo === userId || task.createdBy === userId) {
      return true;
    }
    return normalizeDependencyScope(task.dependencyScope) === "team" && task.dependentOn === userId;
  });

  return {
    totalProjects: involvedTasks.length,
    activeProjects: involvedTasks.filter((task) => task.status !== "done").length,
  };
}

function shortNodeLabel(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 3))}...`;
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderColumn(status, tasks, user) {
  return `
    <div class="column">
      <div class="column-title">
        <span>${STATUS_META[status].label}</span>
        <span class="count-badge">${tasks.length}</span>
      </div>
      ${
        tasks.length
          ? `<div class="task-list">${tasks.map((task) => renderTaskCard(task, user, status)).join("")}</div>`
          : '<div class="empty-state">No tasks here.</div>'
      }
    </div>
  `;
}

function renderTaskCard(task, user, section) {
  const assignee = displayUserName(task.assignedTo);
  const creator = displayUserName(task.createdBy);
  const priorityMeta = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const statusMeta = STATUS_META[task.status] || STATUS_META.bucket;
  const dependencyMeta = DEPENDENCY_META[normalizeDependencyFactor(task.dependencyFactor)] || DEPENDENCY_META.none;
  const dependencyScopeMeta =
    DEPENDENCY_SCOPE_META[normalizeDependencyScope(task.dependencyScope)] || DEPENDENCY_SCOPE_META.none;
  const checklist = getChecklistProgress(task);
  const loggedHours = getLoggedHours(task);
  const involvementSummary = getInvolvementSummary(task);
  const watching = Array.isArray(task.watchers) && task.watchers.includes(user.id);
  const overdue = isTaskOverdue(task);
  const selected = isTaskSelected(task.id);
  const canSelect = canManage(user);
  const referenceLink = normalizeAttachmentUrl(task.referenceLink || "");

  return `
    <article class="task-card ${task.pinned ? "task-pinned" : ""} ${overdue ? "task-overdue" : ""}">
      <div class="task-head">
        <h3 class="task-title">${task.pinned ? "PIN " : ""}${escapeHtml(task.title)}</h3>
        <div class="meta-row">
          <span class="priority-pill ${priorityMeta.className}">${priorityMeta.label}</span>
          <span class="status-pill ${statusMeta.className}">${statusMeta.label}</span>
          <span class="dependency-pill ${dependencyMeta.className}">Dependency: ${dependencyMeta.label}</span>
          <span class="scope-pill ${dependencyScopeMeta.className}">${dependencyScopeMeta.label}</span>
          ${overdue ? '<span class="status-pill status-overdue">Overdue</span>' : ""}
          ${task.label ? `<span class="pill">${escapeHtml(task.label)}</span>` : ""}
        </div>
      </div>

      <p class="task-description">${escapeHtml(task.description)}</p>
      ${referenceLink ? `<a class="task-ref-link" href="${escapeHtml(referenceLink)}" target="_blank" rel="noopener noreferrer">Reference Link</a>` : ""}

      <div class="meta-row text-muted">
        <span>Assignee: ${escapeHtml(assignee)}</span>
        <span>${escapeHtml(describeDependency(task))}</span>
        <span>Due: ${escapeHtml(formatDate(task.dueDate))}</span>
        <span>By: ${escapeHtml(creator)}</span>
        <span>Checklist: ${checklist.completed}/${checklist.total}</span>
        <span>Logged: ${loggedHours}h</span>
        <span>Involvement: ${
          involvementSummary.totalContributors
            ? `${formatInvolvementLabel(involvementSummary.averageStars)} avg (${involvementSummary.totalContributors})`
            : "Not set"
        }</span>
        <span>Watchers: ${Array.isArray(task.watchers) ? task.watchers.length : 0}</span>
      </div>
      ${task.status === "blocked" ? `<div class="halt-note">${escapeHtml(describeHaltReason(task))}</div>` : ""}

      <div class="task-footer">
        <div class="task-actions">
          <button class="btn small ghost" data-action="open-task" data-task-id="${escapeHtml(task.id)}" type="button">Thread</button>
          <button class="btn small ghost" data-action="toggle-watch" data-task-id="${escapeHtml(task.id)}" type="button">${
            watching ? "Unwatch" : "Watch"
          }</button>
          <button class="btn small ghost" data-action="toggle-pin" data-task-id="${escapeHtml(task.id)}" type="button">${
            task.pinned ? "Unpin" : "Pin"
          }</button>
          ${
            canSelect
              ? `<button class="btn small ghost" data-action="toggle-select" data-task-id="${escapeHtml(task.id)}" type="button">${
                  selected ? "Selected" : "Select"
                }</button>`
              : ""
          }
          ${renderTaskActions(task, user, section)}
        </div>
        <span class="text-muted">${task.comments.length} comments · ${Array.isArray(task.attachments) ? task.attachments.length : 0} links</span>
      </div>
    </article>
  `;
}

function renderTaskActions(task, user, section) {
  const isAssignee = task.assignedTo === user.id;
  const manager = canManage(user);
  const canOperate = isAssignee || manager;

  if (section === "bucket") {
    return `<button class="btn small success" data-action="pick-task" data-task-id="${escapeHtml(
      task.id
    )}" type="button">Take Task</button>`;
  }

  if (!canOperate) {
    return "";
  }

  if (task.status === "in_progress") {
    return `
      <button class="btn small warn" data-action="move-status" data-task-id="${escapeHtml(
        task.id
      )}" data-next-status="blocked" type="button">Halt</button>
      <button class="btn small success" data-action="move-status" data-task-id="${escapeHtml(
        task.id
      )}" data-next-status="done" type="button">Complete</button>
      ${
        manager
          ? `<button class="btn small" data-action="quick-nudge" data-task-id="${escapeHtml(
              task.id
            )}" type="button">Nudge</button>`
          : ""
      }
    `;
  }

  if (task.status === "blocked") {
    return `
      <button class="btn small" data-action="move-status" data-task-id="${escapeHtml(
        task.id
      )}" data-next-status="in_progress" type="button">Resume</button>
      <button class="btn small success" data-action="move-status" data-task-id="${escapeHtml(
        task.id
      )}" data-next-status="done" type="button">Complete</button>
      ${
        manager
          ? `<button class="btn small" data-action="quick-nudge" data-task-id="${escapeHtml(
              task.id
            )}" type="button">Nudge</button>`
          : ""
      }
    `;
  }

  if (task.status === "done") {
    return `<button class="btn small" data-action="move-status" data-task-id="${escapeHtml(
      task.id
    )}" data-next-status="in_progress" type="button">Reopen</button>`;
  }

  return "";
}

function renderWatchlistPanel(user) {
  const watched = sortedTasks().filter(
    (task) => Array.isArray(task.watchers) && task.watchers.includes(user.id) && task.status !== "done"
  );

  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Watched Tasks</h2>
          <p class="panel-subtitle">Tasks you follow for updates.</p>
        </div>
      </div>

      ${
        watched.length
          ? `<div class="inbox-list">${watched
              .slice(0, 8)
              .map(
                (task) => `
                <article class="notice">
                  <div class="notice-head">
                    <strong>${escapeHtml(task.title)}</strong>
                    <span class="text-muted">${escapeHtml(getStatusLabel(task.status))}</span>
                  </div>
                  ${
                    task.status === "blocked"
                      ? `<div class="text-muted halt-note-inline">${escapeHtml(describeHaltReason(task))}</div>`
                      : ""
                  }
                  <div class="row-top">
                    <span class="text-muted">Due ${escapeHtml(formatDate(task.dueDate))}</span>
                    <button class="btn small ghost" data-action="open-task" data-task-id="${escapeHtml(
                      task.id
                    )}" type="button">Open</button>
                  </div>
                </article>
              `
              )
              .join("")}</div>`
          : '<div class="empty-state">You are not watching any active tasks.</div>'
      }
    </section>
  `;
}

function renderCompletedByYou(user) {
  const completed = getCompletedTasksForUser(user.id);
  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Completed By You</h2>
          <p class="panel-subtitle">Tasks you completed and closed.</p>
        </div>
      </div>

      ${
        completed.length
          ? `<div class="inbox-list">${completed
              .slice(0, 10)
              .map(
                (task) => `
                <article class="notice">
                  <div class="notice-head">
                    <strong>${escapeHtml(task.title)}</strong>
                    <span class="text-muted">${escapeHtml(formatDate(task.updatedAt))}</span>
                  </div>
                  <div class="row-top">
                    <span class="text-muted">Assignee ${escapeHtml(displayUserName(task.assignedTo))}</span>
                    <button class="btn small ghost" data-action="open-task" data-task-id="${escapeHtml(
                      task.id
                    )}" type="button">Open</button>
                  </div>
                </article>
              `
              )
              .join("")}</div>`
          : '<div class="empty-state">No completed tasks yet.</div>'
      }
    </section>
  `;
}

function renderMentionInbox(user) {
  const mentions = getMentionInbox(user.id);
  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Mention Inbox</h2>
          <p class="panel-subtitle">Comments where you were tagged with @username.</p>
        </div>
      </div>

      ${
        mentions.length
          ? `<div class="inbox-list">${mentions
              .slice(0, 8)
              .map(
                (mention) => `
                <article class="notice ${mention.readAt ? "" : "unread"}">
                  <div class="notice-head">
                    <strong>${escapeHtml(mention.taskTitle)}</strong>
                    <span class="text-muted">${escapeHtml(timeAgo(mention.createdAt))}</span>
                  </div>
                  <p>${escapeHtml(shortNodeLabel(mention.body, 120))}</p>
                  <div class="row-top">
                    <span class="text-muted">From ${escapeHtml(displayUserName(mention.fromUserId))}</span>
                    <div class="inline-actions">
                      <button class="btn small ghost" data-action="open-task" data-task-id="${escapeHtml(
                        mention.taskId
                      )}" type="button">Open</button>
                      ${
                        mention.readAt
                          ? '<span class="pill">Read</span>'
                          : `<button class="btn small" data-action="mark-mention-read" data-task-id="${escapeHtml(
                              mention.taskId
                            )}" data-comment-id="${escapeHtml(mention.commentId)}" type="button">Mark Read</button>`
                      }
                    </div>
                  </div>
                </article>
              `
              )
              .join("")}</div>`
          : '<div class="empty-state">No mentions yet.</div>'
      }
    </section>
  `;
}

function renderNudgeInbox(user) {
  const nudges = [...state.nudges]
    .filter((item) => item.toUserId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Nudge Inbox</h2>
          <p class="panel-subtitle">Manager nudges targeted to you.</p>
        </div>
      </div>

      ${
        nudges.length
          ? `<div class="inbox-list">${nudges
              .map((nudge) => {
                const task = state.tasks.find((item) => item.id === nudge.taskId);
                const fromUser = displayUserName(nudge.fromUserId);
                return `
                  <article class="notice ${nudge.readAt ? "" : "unread"}">
                    <div class="notice-head">
                      <strong>${escapeHtml(task ? task.title : "Task")}</strong>
                      <span class="text-muted">${escapeHtml(timeAgo(nudge.createdAt))}</span>
                    </div>
                    <p>${escapeHtml(nudge.message)}</p>
                    <div class="row-top">
                      <span class="text-muted">From ${escapeHtml(fromUser)}</span>
                      ${
                        nudge.readAt
                          ? '<span class="pill">Read</span>'
                          : `<button class="btn small" data-action="mark-nudge-read" data-nudge-id="${escapeHtml(
                              nudge.id
                            )}" type="button">Mark Read</button>`
                      }
                    </div>
                  </article>
                `;
              })
              .join("")}</div>`
          : '<div class="empty-state">No nudges assigned to you.</div>'
      }
    </section>
  `;
}

function renderActivityFeed() {
  const feed = state.tasks
    .flatMap((task) =>
      (task.history || []).map((entry) => ({
        ...entry,
        taskId: task.id,
        taskTitle: task.title,
      }))
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Activity Feed</h2>
          <p class="panel-subtitle">Latest team actions across tasks.</p>
        </div>
      </div>

      ${
        feed.length
          ? `<div class="activity-list">${feed
              .map(
                (entry) => `
                <article class="activity-item">
                  <div class="row-top">
                    <strong>${escapeHtml(entry.taskTitle)}</strong>
                    <span class="text-muted">${escapeHtml(timeAgo(entry.createdAt))}</span>
                  </div>
                  <p>${escapeHtml(entry.message)}</p>
                  <div class="inline-actions">
                    <button class="btn small ghost" data-action="open-task" data-task-id="${escapeHtml(
                      entry.taskId
                    )}" type="button">Open Thread</button>
                  </div>
                </article>
              `
              )
              .join("")}</div>`
          : '<div class="empty-state">No activity yet.</div>'
      }
    </section>
  `;
}

function renderAdminPanel() {
  const users = [...state.users].sort((a, b) => a.name.localeCompare(b.name));

  return `
    <section class="panel pixel-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Admin Access</h2>
          <p class="panel-subtitle">Manage users and role levels.</p>
        </div>
      </div>

      <div class="user-list">
        ${users
          .map(
            (user) => `
            <article class="user-row">
              <div class="row-top">
                <strong>${escapeHtml(user.name)}</strong>
                <span class="role-chip ${escapeHtml(user.role)}">${escapeHtml(user.role)}</span>
              </div>
              <div class="text-muted">@${escapeHtml(user.username)}</div>
              <form data-form="role-update" class="split">
                <input type="hidden" name="userId" value="${escapeHtml(user.id)}" />
                <select name="role" required>
                  <option value="member" ${user.role === "member" ? "selected" : ""}>Member</option>
                  <option value="manager" ${user.role === "manager" ? "selected" : ""}>Manager</option>
                  <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                </select>
                <button class="btn small" type="submit">Update Role</button>
              </form>
            </article>
          `
          )
          .join("")}
      </div>

      <form id="create-user-form" class="form-grid">
        <div class="field">
          <label for="newName">Name</label>
          <input id="newName" name="name" maxlength="56" required />
        </div>
        <div class="field">
          <label for="newUsername">Username</label>
          <input id="newUsername" name="username" maxlength="28" required />
        </div>
        <div class="field">
          <label for="newPassword">Password</label>
          <input id="newPassword" name="password" maxlength="28" required />
        </div>
        <div class="field">
          <label for="newRole">Role</label>
          <select id="newRole" name="role" required>
            <option value="member">Member</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="field full">
          <button class="btn primary" type="submit">Create User</button>
        </div>
      </form>

      <div class="inline-actions">
        <button class="btn" type="button" data-action="export-workspace">Export Workspace JSON</button>
      </div>

      <form id="import-workspace-form" class="inline-form">
        <div class="field">
          <label for="workspaceFile">Import Workspace JSON</label>
          <input id="workspaceFile" name="file" type="file" accept="application/json" required />
        </div>
        <button class="btn warn" type="submit">Import And Replace</button>
      </form>
    </section>
  `;
}

function renderTaskModal(user) {
  const task = state.tasks.find((item) => item.id === uiState.selectedTaskId);
  if (!task) {
    uiState.selectedTaskId = null;
    return "";
  }

  const comments = [...task.comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const canAssign = canManage(user);
  const dependencyMeta = DEPENDENCY_META[normalizeDependencyFactor(task.dependencyFactor)] || DEPENDENCY_META.none;
  const dependencyScopeMeta =
    DEPENDENCY_SCOPE_META[normalizeDependencyScope(task.dependencyScope)] || DEPENDENCY_SCOPE_META.none;
  const dependencyLabel = describeDependency(task);
  const checklist = getChecklistProgress(task);
  const totalLogged = getLoggedHours(task);
  const referenceLink = normalizeAttachmentUrl(task.referenceLink || "");
  const assigneeOptions = state.users
    .map(
      (candidate) =>
        `<option value="${escapeHtml(candidate.id)}" ${task.assignedTo === candidate.id ? "selected" : ""}>${escapeHtml(
          candidate.name
        )} (${escapeHtml(candidate.role)})</option>`
    )
    .join("");
  const dependencyOwnerOptions = state.users
    .map(
      (candidate) =>
        `<option value="${escapeHtml(candidate.id)}" ${task.dependentOn === candidate.id ? "selected" : ""}>${escapeHtml(
          candidate.name
        )}</option>`
    )
    .join("");
  const checklistMarkup = (task.checklist || [])
    .map(
      (item) => `
      <article class="comment-row">
        <div class="row-top">
          <strong>${item.done ? "DONE" : "OPEN"} · ${escapeHtml(item.text)}</strong>
          <div class="inline-actions">
            <button class="btn small ghost" type="button" data-action="toggle-subtask" data-task-id="${escapeHtml(
              task.id
            )}" data-subtask-id="${escapeHtml(item.id)}">${item.done ? "Reopen" : "Done"}</button>
            <button class="btn small ghost" type="button" data-action="remove-subtask" data-task-id="${escapeHtml(
              task.id
            )}" data-subtask-id="${escapeHtml(item.id)}">Remove</button>
          </div>
        </div>
      </article>
    `
    )
    .join("");
  const worklogMarkup = (task.worklogs || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map(
      (entry) => `
      <article class="comment-row">
        <div class="row-top">
          <strong>${escapeHtml(displayUserName(entry.userId))} · ${entry.hours}h</strong>
          <span class="text-muted">${escapeHtml(timeAgo(entry.createdAt))}</span>
        </div>
        <p>${escapeHtml(entry.note || "No note")}</p>
      </article>
    `
    )
    .join("");
  const involvementEntries = getInvolvementEntries(task).sort((left, right) => {
    const starDelta = right.stars - left.stars;
    if (starDelta !== 0) {
      return starDelta;
    }
    return new Date(right.updatedAt) - new Date(left.updatedAt);
  });
  const myInvolvement = involvementEntries.find((entry) => entry.userId === user.id) || null;
  const involvementMarkup = involvementEntries
    .map(
      (entry) => `
      <article class="comment-row involvement-row">
        <div class="row-top">
          <strong>${escapeHtml(displayUserName(entry.userId))}</strong>
          <span class="pill involvement-pill">${escapeHtml(formatInvolvementLabel(entry.stars))}</span>
        </div>
        <p class="involvement-work">${escapeHtml(entry.workSummary)}</p>
        <span class="text-muted">Updated ${escapeHtml(timeAgo(entry.updatedAt))}</span>
      </article>
    `
    )
    .join("");
  const attachmentMarkup = (task.attachments || [])
    .map(
      (item) => `
      <article class="comment-row">
        <div class="row-top">
          <a class="task-ref-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            item.title || item.url
          )}</a>
          <button class="btn small ghost" type="button" data-action="remove-attachment" data-task-id="${escapeHtml(
            task.id
          )}" data-attachment-id="${escapeHtml(item.id)}">Remove</button>
        </div>
      </article>
    `
    )
    .join("");

  return `
    <div class="modal-backdrop" data-action="dismiss-modal">
      <article class="modal" role="dialog" aria-modal="true" aria-label="Task details">
        <div class="row-top">
          <h3>${escapeHtml(task.title)}</h3>
          <button class="btn small" type="button" data-action="close-task-modal">Close</button>
        </div>

        <p class="task-description">${escapeHtml(task.description)}</p>
        ${referenceLink ? `<a class="task-ref-link" href="${escapeHtml(referenceLink)}" target="_blank" rel="noopener noreferrer">Task Reference</a>` : ""}

        <div class="meta-row">
          <span class="status-pill ${(STATUS_META[task.status] || STATUS_META.bucket).className}">${
    (STATUS_META[task.status] || STATUS_META.bucket).label
  }</span>
          <span class="priority-pill ${(PRIORITY_META[task.priority] || PRIORITY_META.medium).className}">${
    (PRIORITY_META[task.priority] || PRIORITY_META.medium).label
  }</span>
          <span class="dependency-pill ${dependencyMeta.className}">Dependency: ${dependencyMeta.label}</span>
          <span class="scope-pill ${dependencyScopeMeta.className}">${dependencyScopeMeta.label}</span>
          <span class="pill">Assignee: ${escapeHtml(displayUserName(task.assignedTo))}</span>
          <span class="pill">${escapeHtml(dependencyLabel)}</span>
          <span class="pill">Due: ${escapeHtml(formatDate(task.dueDate))}</span>
          <span class="pill">Checklist: ${checklist.completed}/${checklist.total}</span>
          <span class="pill">Logged: ${totalLogged}h</span>
        </div>
        ${
          task.dependencyNotes
            ? `<p class="task-description"><strong>Dependency Note:</strong> ${escapeHtml(task.dependencyNotes)}</p>`
            : ""
        }
        ${task.status === "blocked" ? `<p class="task-description"><strong>${escapeHtml(describeHaltReason(task))}</strong></p>` : ""}

        ${
          canAssign
            ? `
            <form id="assign-form" class="inline-form form-centered">
              <input type="hidden" name="taskId" value="${escapeHtml(task.id)}" />
              <div class="split split-even">
                <select name="assigneeId">
                  <option value="">Return to bucket (unassigned)</option>
                  ${assigneeOptions}
                </select>
                <select name="dependencyFactor">
                  <option value="none" ${normalizeDependencyFactor(task.dependencyFactor) === "none" ? "selected" : ""}>None</option>
                  <option value="low" ${normalizeDependencyFactor(task.dependencyFactor) === "low" ? "selected" : ""}>Low</option>
                  <option value="medium" ${normalizeDependencyFactor(task.dependencyFactor) === "medium" ? "selected" : ""}>Medium</option>
                  <option value="high" ${normalizeDependencyFactor(task.dependencyFactor) === "high" ? "selected" : ""}>High</option>
                </select>
              </div>
              <div class="split split-even">
                <select name="dependencyScope">
                  <option value="none" ${normalizeDependencyScope(task.dependencyScope) === "none" ? "selected" : ""}>No dependency owner</option>
                  <option value="team" ${normalizeDependencyScope(task.dependencyScope) === "team" ? "selected" : ""}>Internal Team</option>
                  <option value="external" ${normalizeDependencyScope(task.dependencyScope) === "external" ? "selected" : ""}>External Team / Company</option>
                </select>
                <select name="dependentOn">
                  <option value="">Select team member</option>
                  ${dependencyOwnerOptions}
                </select>
              </div>
              <div class="split split-even">
                <input
                  name="externalDependencyName"
                  maxlength="72"
                  value="${escapeHtml(task.externalDependencyName || "")}"
                  placeholder="External team/company"
                />
                <input
                  name="referenceLink"
                  maxlength="200"
                  value="${escapeHtml(task.referenceLink || "")}"
                  placeholder="Reference URL (optional)"
                />
              </div>
              <div class="split split-even">
                <input name="dependencyNotes" maxlength="140" value="${escapeHtml(task.dependencyNotes || "")}" placeholder="Dependency note (optional)" />
                <input name="label" maxlength="28" value="${escapeHtml(task.label || "")}" placeholder="Label (optional)" />
              </div>
              <div class="inline-actions">
                <button class="btn" type="submit">Apply Task Controls</button>
              </div>
              <p class="text-muted">Managers/Admins can set dependency type as internal team or external organization.</p>
            </form>
          `
            : `
            <div class="text-muted">${escapeHtml(dependencyLabel)}</div>
            ${
              task.dependencyNotes
                ? `<div class="text-muted">Dependency Note: ${escapeHtml(task.dependencyNotes)}</div>`
                : ""
            }
          `
        }

        <section>
          <h4>Checklist</h4>
          ${checklistMarkup || '<div class="empty-state">No checklist items yet.</div>'}
          <form id="add-subtask-form" class="inline-form">
            <input type="hidden" name="taskId" value="${escapeHtml(task.id)}" />
            <div class="split">
              <input name="text" maxlength="120" placeholder="Add a subtask item" required />
              <button class="btn" type="submit">Add</button>
            </div>
          </form>
        </section>

        <section>
          <h4>Work Log</h4>
          ${worklogMarkup || '<div class="empty-state">No work logs yet.</div>'}
          <form id="add-worklog-form" class="inline-form">
            <input type="hidden" name="taskId" value="${escapeHtml(task.id)}" />
            <div class="split split-even">
              <input name="hours" type="number" step="0.25" min="0.25" max="24" value="0.5" required />
              <input name="note" maxlength="180" placeholder="What was done?" required />
            </div>
            <button class="btn" type="submit">Log Time</button>
          </form>
        </section>

        <section>
          <h4>Involvement Stars</h4>
          ${involvementMarkup || '<div class="empty-state">No involvement updates yet.</div>'}
          <form id="involvement-form" class="inline-form">
            <input type="hidden" name="taskId" value="${escapeHtml(task.id)}" />
            <div class="split split-even">
              <select name="stars" required>
                <option value="1" ${(myInvolvement?.stars || 3) === 1 ? "selected" : ""}>1 star · shadowing</option>
                <option value="2" ${(myInvolvement?.stars || 3) === 2 ? "selected" : ""}>2 stars · light support</option>
                <option value="3" ${(myInvolvement?.stars || 3) === 3 ? "selected" : ""}>3 stars · active contributor</option>
                <option value="4" ${(myInvolvement?.stars || 3) === 4 ? "selected" : ""}>4 stars · major owner</option>
                <option value="5" ${(myInvolvement?.stars || 3) === 5 ? "selected" : ""}>5 stars · driving execution</option>
              </select>
              <input
                name="workSummary"
                maxlength="180"
                value="${escapeHtml(myInvolvement?.workSummary || "")}"
                placeholder="What work are you doing on this task?"
                required
              />
            </div>
            <button class="btn" type="submit">${myInvolvement ? "Update" : "Set"} My Involvement</button>
            <p class="text-muted">Each teammate sets their own involvement stars and work summary.</p>
          </form>
        </section>

        <section>
          <h4>Attachments</h4>
          ${attachmentMarkup || '<div class="empty-state">No links attached yet.</div>'}
          <form id="add-attachment-form" class="inline-form">
            <input type="hidden" name="taskId" value="${escapeHtml(task.id)}" />
            <div class="split split-even">
              <input name="title" maxlength="90" placeholder="Link title" />
              <input name="url" maxlength="220" placeholder="https://..." required />
            </div>
            <button class="btn" type="submit">Attach Link</button>
          </form>
        </section>

        <section>
          <h4>Collaboration Thread</h4>
          ${
            comments.length
              ? `<div class="comments">${comments
                  .map(
                    (comment) => `
                    <article class="comment-row">
                      <div class="row-top">
                        <strong>${escapeHtml(displayUserName(comment.userId))}</strong>
                        <span class="text-muted">${escapeHtml(timeAgo(comment.createdAt))}</span>
                      </div>
                      <p>${escapeHtml(comment.body)}</p>
                    </article>
                  `
                  )
                  .join("")}</div>`
              : '<div class="empty-state">No comments yet. Start collaborating on this task.</div>'
          }

          <form id="comment-form" class="inline-form">
            <input type="hidden" name="taskId" value="${escapeHtml(task.id)}" />
            <div class="field">
              <label for="commentBody">Add Comment (use @username to mention)</label>
              <textarea id="commentBody" name="body" maxlength="260" required></textarea>
            </div>
            <button class="btn primary" type="submit">Post Comment</button>
          </form>
        </section>
      </article>
    </div>
  `;
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const user = getCurrentUser();

  if (action === "login-demo") {
    const username = target.dataset.username;
    const account = state.users.find((item) => item.username === username);
    if (!account) {
      return;
    }
    uiState.loginError = "";
    setCurrentUser(account.id);
    setFlash(`Logged in as ${account.name}.`, "success");
    render();
    return;
  }

  if (action === "logout") {
    setCurrentUser("");
    uiState.selectedTaskId = null;
    uiState.selectedTaskIds = [];
    uiState.loginError = "";
    uiState.flash = null;
    render();
    return;
  }

  if (!user) {
    return;
  }

  if (action === "clear-filters") {
    uiState.filters = createDefaultFilters();
    render();
    return;
  }

  if (action === "reset-data") {
    if (uiState.syncStatus === "online") {
      setFlash("Reset is disabled in cloud mode to avoid wiping shared workspace.", "error");
      render();
      return;
    }

    if (!window.confirm("Reset all local demo data for this app?")) {
      return;
    }
    const currentUsername = user.username;
    state = createSeedState();
    saveState();
    const mapped = state.users.find((candidate) => candidate.username === currentUsername);
    setCurrentUser(mapped ? mapped.id : "");
    uiState.selectedTaskId = null;
    uiState.selectedTaskIds = [];
    uiState.filters = createDefaultFilters();
    setFlash("Demo state reset.", "success");
    render();
    return;
  }

  if (action === "open-task") {
    uiState.selectedTaskId = target.dataset.taskId || null;
    render();
    return;
  }

  if (action === "close-task-modal") {
    uiState.selectedTaskId = null;
    render();
    return;
  }

  if (action === "dismiss-modal") {
    if (event.target === target) {
      uiState.selectedTaskId = null;
      render();
    }
    return;
  }

  if (action === "pick-task") {
    const taskId = target.dataset.taskId;
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "bucket") {
      setFlash("Task is no longer available in the bucket.", "error");
      render();
      return;
    }
    task.assignedTo = user.id;
    task.status = "in_progress";
    task.watchers = Array.isArray(task.watchers) ? [...new Set([...task.watchers, user.id])] : [user.id];
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} picked up the task from the bucket.`);
    saveState();
    setFlash("Task assigned to you.", "success");
    render();
    return;
  }

  if (action === "move-status") {
    const taskId = target.dataset.taskId;
    const nextStatus = target.dataset.nextStatus;
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !STATUS_META[nextStatus]) {
      return;
    }

    const isAssignee = task.assignedTo === user.id;
    if (!canManage(user) && !isAssignee) {
      setFlash("Only assignee, manager, or admin can update this task.", "error");
      render();
      return;
    }

    task.status = nextStatus;
    if (nextStatus !== "bucket" && !task.assignedTo) {
      task.assignedTo = user.id;
    }
    task.updatedAt = new Date().toISOString();
    if (nextStatus === "blocked") {
      addHistory(task, user.id, `${user.name} changed status to ${STATUS_META[nextStatus].label}. ${describeHaltReason(task)}.`);
    } else {
      addHistory(task, user.id, `${user.name} changed status to ${STATUS_META[nextStatus].label}.`);
    }
    saveState();
    if (nextStatus === "blocked") {
      setFlash(`Task moved to ${STATUS_META[nextStatus].label}. ${describeHaltReason(task)}.`, "success");
    } else {
      setFlash(`Task moved to ${STATUS_META[nextStatus].label}.`, "success");
    }
    render();
    return;
  }

  if (action === "toggle-watch") {
    const task = state.tasks.find((item) => item.id === target.dataset.taskId);
    if (!task) {
      return;
    }
    if (!Array.isArray(task.watchers)) {
      task.watchers = [];
    }
    if (task.watchers.includes(user.id)) {
      task.watchers = task.watchers.filter((watcher) => watcher !== user.id);
      setFlash("Task removed from your watchlist.", "success");
    } else {
      task.watchers = [...new Set([...task.watchers, user.id])];
      setFlash("Task added to your watchlist.", "success");
    }
    task.updatedAt = new Date().toISOString();
    saveState();
    render();
    return;
  }

  if (action === "toggle-pin") {
    const task = state.tasks.find((item) => item.id === target.dataset.taskId);
    if (!task) {
      return;
    }
    task.pinned = !task.pinned;
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} ${task.pinned ? "pinned" : "unpinned"} this task.`);
    saveState();
    render();
    return;
  }

  if (action === "toggle-select") {
    if (!canManage(user)) {
      return;
    }
    const taskId = String(target.dataset.taskId || "");
    if (!taskId) {
      return;
    }
    toggleTaskSelection(taskId);
    render();
    return;
  }

  if (action === "clear-selected") {
    if (!canManage(user)) {
      return;
    }
    uiState.selectedTaskIds = [];
    render();
    return;
  }

  if (action === "quick-nudge") {
    if (!canManage(user)) {
      return;
    }
    const task = state.tasks.find((item) => item.id === target.dataset.taskId);
    if (!task || !task.assignedTo) {
      setFlash("Task needs an assignee before nudging.", "error");
      render();
      return;
    }

    const message = "Please share a progress update on this task.";
    state.nudges.push({
      id: uniqueId("nudge"),
      taskId: task.id,
      fromUserId: user.id,
      toUserId: task.assignedTo,
      message,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    addHistory(task, user.id, `${user.name} nudged ${displayUserName(task.assignedTo)} for an update.`);
    task.updatedAt = new Date().toISOString();
    saveState();
    setFlash("Nudge sent.", "success");
    render();
    return;
  }

  if (action === "mark-nudge-read") {
    const nudge = state.nudges.find((item) => item.id === target.dataset.nudgeId);
    if (!nudge || nudge.toUserId !== user.id) {
      return;
    }
    nudge.readAt = new Date().toISOString();
    saveState();
    render();
    return;
  }

  if (action === "mark-mention-read") {
    const taskId = String(target.dataset.taskId || "");
    const commentId = String(target.dataset.commentId || "");
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    const comment = (task.comments || []).find((item) => item.id === commentId);
    if (!comment) {
      return;
    }
    if (!comment.mentionReadAt || typeof comment.mentionReadAt !== "object") {
      comment.mentionReadAt = {};
    }
    comment.mentionReadAt[user.id] = new Date().toISOString();
    saveState();
    render();
    return;
  }

  if (action === "toggle-subtask") {
    const task = state.tasks.find((item) => item.id === target.dataset.taskId);
    if (!task) {
      return;
    }
    const subtask = (task.checklist || []).find((item) => item.id === target.dataset.subtaskId);
    if (!subtask) {
      return;
    }
    subtask.done = !subtask.done;
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} ${subtask.done ? "completed" : "reopened"} checklist item "${subtask.text}".`);
    saveState();
    render();
    return;
  }

  if (action === "remove-subtask") {
    const task = state.tasks.find((item) => item.id === target.dataset.taskId);
    if (!task) {
      return;
    }
    const subtaskId = String(target.dataset.subtaskId || "");
    const subtask = (task.checklist || []).find((item) => item.id === subtaskId);
    if (!subtask) {
      return;
    }
    task.checklist = (task.checklist || []).filter((item) => item.id !== subtaskId);
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} removed checklist item "${subtask.text}".`);
    saveState();
    render();
    return;
  }

  if (action === "remove-attachment") {
    const task = state.tasks.find((item) => item.id === target.dataset.taskId);
    if (!task) {
      return;
    }
    const attachmentId = String(target.dataset.attachmentId || "");
    task.attachments = (task.attachments || []).filter((item) => item.id !== attachmentId);
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} removed a task link.`);
    saveState();
    render();
    return;
  }

  if (action === "export-workspace") {
    if (!isAdmin(user)) {
      return;
    }
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pixel-task-nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    setFlash("Workspace export downloaded.", "success");
    return;
  }
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();

  if (form.id === "login-form") {
    const formData = new FormData(form);
    const username = String(formData.get("username") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();

    const account = state.users.find((item) => item.username.toLowerCase() === username && item.password === password);
    if (!account) {
      uiState.loginError = "Invalid username or password.";
      render();
      return;
    }

    uiState.loginError = "";
    setCurrentUser(account.id);
    setFlash(`Welcome ${account.name}.`, "success");
    render();
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    return;
  }

  if (form.id === "filter-form") {
    const formData = new FormData(form);
    uiState.filters = {
      search: String(formData.get("search") || "").trim(),
      status: String(formData.get("status") || "all"),
      priority: String(formData.get("priority") || "all"),
      assignee: String(formData.get("assignee") || "all"),
      dependencyScope: String(formData.get("dependencyScope") || "all"),
      sort: String(formData.get("sort") || "updated_desc"),
      onlyPinned: formData.has("onlyPinned"),
      onlyOverdue: formData.has("onlyOverdue"),
    };
    render();
    return;
  }

  if (form.id === "create-task-form") {
    if (!canManage(user)) {
      setFlash("Only manager/admin can create bucket tasks.", "error");
      render();
      return;
    }

    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const priority = String(formData.get("priority") || "medium");
    const dueDate = String(formData.get("dueDate") || "").trim();
    const dependencyInput = buildDependencyData({
      factorInput: String(formData.get("dependencyFactor") || "none"),
      scopeInput: String(formData.get("dependencyScope") || "none"),
      dependentOnInput: String(formData.get("dependentOn") || "").trim() || null,
      externalDependencyNameInput: String(formData.get("externalDependencyName") || ""),
      notesInput: String(formData.get("dependencyNotes") || ""),
    });
    const label = String(formData.get("label") || "").trim().slice(0, 28);
    const referenceLink = normalizeAttachmentUrl(String(formData.get("referenceLink") || ""));

    if (!title || !description) {
      setFlash("Title and description are required.", "error");
      render();
      return;
    }

    if (!dependencyInput.ok) {
      setFlash(dependencyInput.error, "error");
      render();
      return;
    }

    const now = new Date().toISOString();
    const task = {
      id: uniqueId("task"),
      title,
      description,
      priority: PRIORITY_META[priority] ? priority : "medium",
      status: "bucket",
      createdBy: user.id,
      assignedTo: null,
      ...dependencyInput.value,
      label,
      referenceLink,
      checklist: [],
      worklogs: [],
      watchers: [user.id],
      involvement: [],
      pinned: false,
      attachments: [],
      dueDate: dueDate || null,
      internalEstimate: estimateFromDetails(priority, description),
      comments: [],
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    const dependencyContext = describeDependency(task);
    addHistory(task, user.id, `${user.name} created the task in the pending bucket. ${dependencyContext}`);
    state.tasks.push(task);
    saveState();
    form.reset();
    setFlash("Task added to bucket.", "success");
    render();
    return;
  }

  if (form.id === "nudge-form") {
    if (!canManage(user)) {
      return;
    }

    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "");
    const message = String(formData.get("message") || "").trim();
    const task = state.tasks.find((item) => item.id === taskId);

    if (!task || !task.assignedTo) {
      setFlash("Select an assigned task before nudging.", "error");
      render();
      return;
    }

    if (!message) {
      setFlash("Nudge message cannot be empty.", "error");
      render();
      return;
    }

    state.nudges.push({
      id: uniqueId("nudge"),
      taskId: task.id,
      fromUserId: user.id,
      toUserId: task.assignedTo,
      message,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    addHistory(task, user.id, `${user.name} nudged ${displayUserName(task.assignedTo)}.`);
    task.updatedAt = new Date().toISOString();
    saveState();
    form.reset();
    setFlash("Nudge sent to assignee.", "success");
    render();
    return;
  }

  if (form.id === "comment-form") {
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "");
    const body = String(formData.get("body") || "").trim();
    const task = state.tasks.find((item) => item.id === taskId);

    if (!task || !body) {
      return;
    }

    const mentions = extractMentions(body);
    task.comments.push({
      id: uniqueId("comment"),
      userId: user.id,
      body,
      mentions,
      mentionReadAt: {},
      createdAt: new Date().toISOString(),
    });
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} added a comment.`);
    if (mentions.length) {
      addHistory(task, user.id, `${user.name} mentioned ${mentions.map((id) => displayUserName(id)).join(", ")}.`);
    }
    saveState();
    form.reset();
    setFlash("Comment posted.", "success");
    render();
    return;
  }

  if (form.id === "assign-form") {
    if (!canManage(user)) {
      return;
    }

    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "");
    const assigneeId = String(formData.get("assigneeId") || "").trim();
    const dependencyInput = buildDependencyData({
      factorInput: String(formData.get("dependencyFactor") || "none"),
      scopeInput: String(formData.get("dependencyScope") || "none"),
      dependentOnInput: String(formData.get("dependentOn") || "").trim() || null,
      externalDependencyNameInput: String(formData.get("externalDependencyName") || ""),
      notesInput: String(formData.get("dependencyNotes") || ""),
    });
    const label = String(formData.get("label") || "").trim().slice(0, 28);
    const referenceLink = normalizeAttachmentUrl(String(formData.get("referenceLink") || ""));
    const task = state.tasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    if (!dependencyInput.ok) {
      setFlash(dependencyInput.error, "error");
      render();
      return;
    }

    const previousAssignee = task.assignedTo || null;
    const previousDependencyFactor = normalizeDependencyFactor(task.dependencyFactor);
    const previousDependencyScope = normalizeDependencyScope(task.dependencyScope);
    const previousDependentOn = task.dependentOn || null;
    const previousExternalDependencyName = String(task.externalDependencyName || "");
    const previousDependencyNotes = String(task.dependencyNotes || "");
    const previousLabel = String(task.label || "");
    const previousReferenceLink = normalizeAttachmentUrl(task.referenceLink || "");

    task.assignedTo = assigneeId || null;
    task.status = task.assignedTo ? (task.status === "done" ? "done" : "in_progress") : "bucket";
    task.dependencyFactor = dependencyInput.value.dependencyFactor;
    task.dependencyScope = dependencyInput.value.dependencyScope;
    task.dependentOn = dependencyInput.value.dependentOn;
    task.externalDependencyName = dependencyInput.value.externalDependencyName;
    task.dependencyNotes = dependencyInput.value.dependencyNotes;
    task.label = label;
    task.referenceLink = referenceLink;
    task.watchers = Array.isArray(task.watchers) ? task.watchers : [];
    if (task.assignedTo) {
      task.watchers = [...new Set([...task.watchers, task.assignedTo])];
    }
    task.updatedAt = new Date().toISOString();

    const assigneeChanged = previousAssignee !== task.assignedTo;
    const dependencyChanged =
      previousDependencyFactor !== task.dependencyFactor ||
      previousDependencyScope !== task.dependencyScope ||
      previousDependentOn !== task.dependentOn ||
      previousExternalDependencyName !== task.externalDependencyName ||
      previousDependencyNotes !== task.dependencyNotes ||
      previousLabel !== task.label ||
      previousReferenceLink !== task.referenceLink;

    if (assigneeChanged && task.assignedTo) {
      addHistory(task, user.id, `${user.name} assigned this task to ${displayUserName(task.assignedTo)}.`);
    } else if (assigneeChanged) {
      addHistory(task, user.id, `${user.name} returned this task to the pending bucket.`);
    }

    if (dependencyChanged) {
      addHistory(task, user.id, `${user.name} updated dependency controls. ${describeDependency(task)}.`);
    }

    if (assigneeChanged || dependencyChanged) {
      setFlash("Task controls updated.", "success");
    } else {
      setFlash("No changes detected in task controls.", "success");
    }

    saveState();
    render();
    return;
  }

  if (form.id === "bulk-action-form") {
    if (!canManage(user)) {
      return;
    }
    const selected = state.tasks.filter((task) => uiState.selectedTaskIds.includes(task.id));
    if (!selected.length) {
      setFlash("Select tasks before applying bulk actions.", "error");
      render();
      return;
    }

    const formData = new FormData(form);
    const bulkStatus = String(formData.get("bulkStatus") || "");
    const bulkAssigneeRaw = String(formData.get("bulkAssignee") || "");
    const bulkAssignee = bulkAssigneeRaw === "__unassign__" ? null : bulkAssigneeRaw || undefined;

    if (!bulkStatus && typeof bulkAssignee === "undefined") {
      setFlash("Choose at least one bulk action field.", "error");
      render();
      return;
    }

    selected.forEach((task) => {
      if (bulkStatus && STATUS_META[bulkStatus]) {
        task.status = bulkStatus;
      }
      if (typeof bulkAssignee !== "undefined") {
        task.assignedTo = bulkAssignee;
      }
      task.updatedAt = new Date().toISOString();
      addHistory(task, user.id, `${user.name} applied bulk update controls.`);
    });
    saveState();
    setFlash(`Bulk update applied to ${selected.length} tasks.`, "success");
    uiState.selectedTaskIds = [];
    form.reset();
    render();
    return;
  }

  if (form.id === "add-subtask-form") {
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "");
    const text = String(formData.get("text") || "").trim();
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !text) {
      return;
    }
    task.checklist = Array.isArray(task.checklist) ? task.checklist : [];
    task.checklist.push({ id: uniqueId("subtask"), text: text.slice(0, 120), done: false });
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} added checklist item "${text.slice(0, 80)}".`);
    saveState();
    form.reset();
    render();
    return;
  }

  if (form.id === "add-worklog-form") {
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "");
    const hours = normalizeWorklogHours(formData.get("hours"));
    const note = String(formData.get("note") || "").trim().slice(0, 180);
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !note) {
      return;
    }
    task.worklogs = Array.isArray(task.worklogs) ? task.worklogs : [];
    task.worklogs.push({
      id: uniqueId("worklog"),
      userId: user.id,
      hours,
      note,
      createdAt: new Date().toISOString(),
    });
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} logged ${hours}h of work.`);
    saveState();
    form.reset();
    setFlash("Work log added.", "success");
    render();
    return;
  }

  if (form.id === "involvement-form") {
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "");
    const stars = normalizeInvolvementStars(formData.get("stars"));
    const workSummary = String(formData.get("workSummary") || "")
      .trim()
      .slice(0, 180);
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    if (!workSummary) {
      setFlash("Add a short work summary with your involvement stars.", "error");
      render();
      return;
    }

    task.involvement = Array.isArray(task.involvement) ? task.involvement : [];
    const existing = task.involvement.find((entry) => entry && entry.userId === user.id);
    const now = new Date().toISOString();

    if (existing) {
      existing.stars = stars;
      existing.workSummary = workSummary;
      existing.updatedAt = now;
    } else {
      task.involvement.push({
        id: uniqueId("involvement"),
        userId: user.id,
        stars,
        workSummary,
        updatedAt: now,
      });
    }

    task.watchers = Array.isArray(task.watchers) ? task.watchers : [];
    task.watchers = [...new Set([...task.watchers, user.id])];
    task.updatedAt = now;
    addHistory(task, user.id, `${user.name} set involvement to ${formatInvolvementLabel(stars)}.`);
    saveState();
    setFlash("Involvement updated.", "success");
    render();
    return;
  }

  if (form.id === "add-attachment-form") {
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "");
    const title = String(formData.get("title") || "").trim().slice(0, 90);
    const url = normalizeAttachmentUrl(String(formData.get("url") || ""));
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !url) {
      setFlash("Provide a valid attachment URL.", "error");
      render();
      return;
    }
    task.attachments = Array.isArray(task.attachments) ? task.attachments : [];
    task.attachments.push({
      id: uniqueId("attachment"),
      title: title || "Reference Link",
      url,
      addedBy: user.id,
      createdAt: new Date().toISOString(),
    });
    task.updatedAt = new Date().toISOString();
    addHistory(task, user.id, `${user.name} attached a reference link.`);
    saveState();
    form.reset();
    setFlash("Attachment added.", "success");
    render();
    return;
  }

  if (form.dataset.form === "role-update") {
    if (!isAdmin(user)) {
      return;
    }

    const formData = new FormData(form);
    const userId = String(formData.get("userId") || "");
    const role = String(formData.get("role") || "member");
    const target = state.users.find((item) => item.id === userId);

    if (!target || !["member", "manager", "admin"].includes(role)) {
      return;
    }

    if (target.role === "admin" && role !== "admin") {
      const adminCount = state.users.filter((member) => member.role === "admin").length;
      if (adminCount <= 1) {
        setFlash("At least one admin account must remain.", "error");
        render();
        return;
      }
    }

    target.role = role;
    saveState();
    setFlash(`Role updated for ${target.name}.`, "success");
    render();
    return;
  }

  if (form.id === "create-user-form") {
    if (!isAdmin(user)) {
      return;
    }

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const username = String(formData.get("username") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();
    const role = String(formData.get("role") || "member");

    if (!name || !username || !password) {
      setFlash("All user fields are required.", "error");
      render();
      return;
    }

    if (state.users.some((item) => item.username.toLowerCase() === username)) {
      setFlash("Username already exists.", "error");
      render();
      return;
    }

    state.users.push({
      id: uniqueId("user"),
      name,
      username,
      password,
      role: ["member", "manager", "admin"].includes(role) ? role : "member",
    });

    saveState();
    form.reset();
    setFlash("User created.", "success");
    render();
    return;
  }

  if (form.id === "import-workspace-form") {
    if (!isAdmin(user)) {
      return;
    }

    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File)) {
      setFlash("Select a JSON backup file first.", "error");
      render();
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const nextState = sanitizeState(parsed);
      if (!nextState) {
        throw new Error("Invalid workspace schema");
      }
      state = nextState;
      ensureSessionStillValid();
      uiState.selectedTaskIds = [];
      saveState();
      form.reset();
      setFlash("Workspace imported successfully.", "success");
      render();
    } catch (error) {
      console.error("Workspace import failed", error);
      setFlash("Import failed. Check JSON format and try again.", "error");
      render();
    }
  }
}

function addHistory(task, actorId, message) {
  if (!Array.isArray(task.history)) {
    task.history = [];
  }

  task.history.push({
    id: uniqueId("history"),
    actorId,
    message,
    createdAt: new Date().toISOString(),
  });
}

function sortedTasks() {
  return [...state.tasks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getVisibleTasks() {
  const currentUser = getCurrentUser();
  const list = sortedTasks().filter((task) => taskMatchesFilters(task, currentUser));
  return list.sort((left, right) => {
    const pinnedDelta = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
    if (pinnedDelta !== 0) {
      return pinnedDelta;
    }
    return compareTasks(left, right, uiState.filters.sort);
  });
}

function taskMatchesFilters(task, currentUser) {
  const filter = uiState.filters;
  if (!filter) {
    return true;
  }

  if (filter.status !== "all" && task.status !== filter.status) {
    return false;
  }

  if (filter.priority !== "all" && task.priority !== filter.priority) {
    return false;
  }

  if (filter.assignee === "me") {
    if (!currentUser || task.assignedTo !== currentUser.id) {
      return false;
    }
  } else if (filter.assignee !== "all" && task.assignedTo !== filter.assignee) {
    return false;
  }

  const taskScope = normalizeDependencyScope(task.dependencyScope);
  if (filter.dependencyScope !== "all" && taskScope !== filter.dependencyScope) {
    return false;
  }

  if (filter.onlyPinned && !task.pinned) {
    return false;
  }

  if (filter.onlyOverdue && !isTaskOverdue(task)) {
    return false;
  }

  if (filter.search) {
    const search = filter.search.toLowerCase();
    const involvementSearch = getInvolvementEntries(task)
      .map((entry) => `${displayUserName(entry.userId)} ${entry.workSummary} ${formatInvolvementLabel(entry.stars)}`)
      .join(" ");
    const fields = [
      task.title,
      task.description,
      task.label || "",
      describeDependency(task),
      task.dependencyNotes || "",
      displayUserName(task.assignedTo),
      displayUserName(task.createdBy),
      involvementSearch,
    ]
      .join(" ")
      .toLowerCase();
    if (!fields.includes(search)) {
      return false;
    }
  }

  return true;
}

function compareTasks(left, right, mode) {
  if (mode === "due_asc") {
    const leftDue = parseDueDateWeight(left.dueDate);
    const rightDue = parseDueDateWeight(right.dueDate);
    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }
  }

  if (mode === "priority_desc") {
    const leftPriority = priorityWeight(left.priority);
    const rightPriority = priorityWeight(right.priority);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
  }

  if (mode === "title_asc") {
    return left.title.localeCompare(right.title);
  }

  return new Date(right.updatedAt) - new Date(left.updatedAt);
}

function parseDueDateWeight(dateString) {
  if (!dateString) {
    return Number.POSITIVE_INFINITY;
  }
  const value = new Date(dateString).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function priorityWeight(priority) {
  if (priority === "high") {
    return 3;
  }
  if (priority === "medium") {
    return 2;
  }
  return 1;
}

function isTaskOverdue(task) {
  if (!task.dueDate || task.status === "done") {
    return false;
  }
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function getChecklistProgress(task) {
  const items = Array.isArray(task.checklist) ? task.checklist : [];
  const completed = items.filter((item) => item.done).length;
  return {
    total: items.length,
    completed,
  };
}

function getLoggedHours(task) {
  if (!Array.isArray(task.worklogs)) {
    return 0;
  }
  return Math.round(task.worklogs.reduce((sum, entry) => sum + Number(entry.hours || 0), 0) * 100) / 100;
}

function getInvolvementEntries(task) {
  if (!Array.isArray(task.involvement)) {
    return [];
  }

  const byUser = new Map();
  task.involvement.forEach((entry) => {
    if (!entry || typeof entry.userId !== "string") {
      return;
    }
    const normalized = {
      id: String(entry.id || `involvement-${entry.userId}`),
      userId: String(entry.userId),
      stars: normalizeInvolvementStars(entry.stars),
      workSummary: String(entry.workSummary || "")
        .trim()
        .slice(0, 180),
      updatedAt: String(entry.updatedAt || new Date().toISOString()),
    };
    if (!normalized.workSummary) {
      return;
    }
    const existing = byUser.get(normalized.userId);
    const nextTime = Number.isFinite(new Date(normalized.updatedAt).getTime()) ? new Date(normalized.updatedAt).getTime() : 0;
    const existingTime =
      existing && Number.isFinite(new Date(existing.updatedAt).getTime()) ? new Date(existing.updatedAt).getTime() : 0;
    if (!existing || nextTime >= existingTime) {
      byUser.set(normalized.userId, normalized);
    }
  });

  return [...byUser.values()];
}

function getInvolvementSummary(task) {
  const entries = getInvolvementEntries(task);
  if (!entries.length) {
    return {
      totalContributors: 0,
      totalStars: 0,
      averageStars: 0,
    };
  }

  const totalStars = entries.reduce((sum, entry) => sum + entry.stars, 0);
  return {
    totalContributors: entries.length,
    totalStars,
    averageStars: Math.round((totalStars / entries.length) * 10) / 10,
  };
}

function formatInvolvementLabel(stars) {
  const value = Number(stars);
  if (!Number.isFinite(value)) {
    return "0 stars";
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} star${rounded === 1 ? "" : "s"}`;
}

function pruneSelectedTaskIds() {
  const valid = new Set(state.tasks.map((task) => task.id));
  uiState.selectedTaskIds = uiState.selectedTaskIds.filter((taskId) => valid.has(taskId));
}

function isTaskSelected(taskId) {
  return uiState.selectedTaskIds.includes(taskId);
}

function toggleTaskSelection(taskId) {
  if (isTaskSelected(taskId)) {
    uiState.selectedTaskIds = uiState.selectedTaskIds.filter((value) => value !== taskId);
  } else {
    uiState.selectedTaskIds = [...uiState.selectedTaskIds, taskId];
  }
}

function getMentionInbox(userId) {
  return state.tasks
    .flatMap((task) =>
      (task.comments || [])
        .filter((comment) => Array.isArray(comment.mentions) && comment.mentions.includes(userId))
        .map((comment) => ({
          id: `${task.id}:${comment.id}:${userId}`,
          taskId: task.id,
          taskTitle: task.title,
          commentId: comment.id,
          fromUserId: comment.userId,
          body: comment.body,
          createdAt: comment.createdAt,
          readAt: comment.mentionReadAt?.[userId] || null,
        }))
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getCompletedTasksForUser(userId) {
  return sortedTasks().filter((task) => didUserCompleteTask(task, userId));
}

function didUserCompleteTask(task, userId) {
  if (!task || task.status !== "done") {
    return false;
  }
  if (task.assignedTo === userId) {
    return true;
  }
  if (!Array.isArray(task.history)) {
    return false;
  }
  return task.history.some((entry) => {
    if (!entry || entry.actorId !== userId || typeof entry.message !== "string") {
      return false;
    }
    return entry.message.toLowerCase().includes("changed status to done");
  });
}

function displayUserName(userId) {
  if (!userId) {
    return "Unassigned";
  }
  const user = state.users.find((member) => member.id === userId);
  return user ? user.name : "Unknown";
}

function extractMentions(text) {
  const body = String(text || "");
  const seen = new Set();
  const result = [];
  const matcher = /@([a-z0-9._-]{2,30})/gi;
  for (const match of body.matchAll(matcher)) {
    const username = String(match[1] || "").toLowerCase();
    const user = state.users.find((candidate) => candidate.username.toLowerCase() === username);
    if (!user || seen.has(user.id)) {
      continue;
    }
    seen.add(user.id);
    result.push(user.id);
  }
  return result;
}

function normalizeDependencyFactor(value) {
  return DEPENDENCY_META[value] ? value : "none";
}

function normalizeDependencyScope(value) {
  return DEPENDENCY_SCOPE_META[value] ? value : "none";
}

function normalizeDependencyOwner(userId) {
  if (!userId) {
    return null;
  }
  return state.users.some((member) => member.id === userId) ? userId : null;
}

function normalizeWorklogHours(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0.25;
  }
  return Math.min(24, Math.round(number * 4) / 4);
}

function normalizeInvolvementStars(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 3;
  }
  return Math.min(5, Math.max(1, Math.round(number)));
}

function normalizeAttachmentUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeExternalDependencyName(value) {
  const text = String(value || "").trim();
  return text.slice(0, 72);
}

function buildDependencyData({ factorInput, scopeInput, dependentOnInput, externalDependencyNameInput, notesInput }) {
  const dependencyFactor = normalizeDependencyFactor(factorInput);
  let dependencyScope = normalizeDependencyScope(scopeInput);
  let dependentOn = normalizeDependencyOwner(dependentOnInput);
  let externalDependencyName = normalizeExternalDependencyName(externalDependencyNameInput);
  const dependencyNotes = String(notesInput || "").trim();

  if (dependencyFactor === "none") {
    return {
      ok: true,
      value: {
        dependencyFactor: "none",
        dependencyScope: "none",
        dependentOn: null,
        externalDependencyName: "",
        dependencyNotes,
      },
    };
  }

  if (dependencyScope === "none") {
    dependencyScope = dependentOn ? "team" : externalDependencyName ? "external" : "team";
  }

  if (dependencyScope === "team") {
    if (!dependentOn) {
      return { ok: false, error: "Choose a team member for internal dependency." };
    }
    externalDependencyName = "";
  } else if (dependencyScope === "external") {
    dependentOn = null;
    if (!externalDependencyName) {
      return { ok: false, error: "Enter external team/company for external dependency." };
    }
  }

  return {
    ok: true,
    value: {
      dependencyFactor,
      dependencyScope,
      dependentOn,
      externalDependencyName,
      dependencyNotes,
    },
  };
}

function describeDependency(task) {
  const dependencyFactor = normalizeDependencyFactor(task.dependencyFactor);
  const dependencyScope = normalizeDependencyScope(task.dependencyScope);
  if (dependencyFactor === "none" || dependencyScope === "none") {
    return "No active dependency";
  }
  if (dependencyScope === "team") {
    return `Internal: ${displayUserName(task.dependentOn)}`;
  }
  if (dependencyScope === "external") {
    return `External: ${task.externalDependencyName || "External team/company"}`;
  }
  return "No active dependency";
}

function getStatusLabel(status) {
  return (STATUS_META[status] || { label: "Unknown" }).label;
}

function describeHaltDependencyTarget(task) {
  const dependencyScope = normalizeDependencyScope(task.dependencyScope);
  if (dependencyScope === "team") {
    return `Internal Team (${displayUserName(task.dependentOn)})`;
  }
  if (dependencyScope === "external") {
    return `External Team/Company (${task.externalDependencyName || "Not specified"})`;
  }
  return "Unspecified Team/Company";
}

function describeHaltReason(task) {
  return `Halted because of dependency on ${describeHaltDependencyTarget(task)}`;
}

function canManage(user) {
  return user.role === "manager" || user.role === "admin";
}

function isAdmin(user) {
  return user.role === "admin";
}

function uniqueId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function setFlash(message, type) {
  uiState.flash = {
    message,
    type,
    token: Date.now(),
  };

  const token = uiState.flash.token;
  if (flashTimerId) {
    clearTimeout(flashTimerId);
  }

  flashTimerId = window.setTimeout(() => {
    if (uiState.flash && uiState.flash.token === token) {
      uiState.flash = null;
      render();
    }
  }, FLASH_TIMEOUT_MS);
}

function estimateFromDetails(priority, details) {
  const safePriority = PRIORITY_META[priority] ? priority : "medium";
  const baseByPriority = {
    low: 3,
    medium: 6,
    high: 10,
  };

  const complexityBonus = Math.min(6, Math.floor(String(details || "").length / 70));
  const expected = baseByPriority[safePriority] + complexityBonus;

  return {
    optimisticHours: Math.max(1, expected - 2),
    expectedHours: expected,
    pessimisticHours: expected + Math.max(3, Math.ceil(expected * 0.45)),
  };
}

function dateOffset(days) {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function pastHours(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function formatDate(dateString) {
  if (!dateString) {
    return "No date";
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "No date";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  const elapsedSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  if (Math.abs(elapsedSeconds) < 60) {
    return "just now";
  }

  const intervals = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
    [Infinity, "year"],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (let index = 1; index < intervals.length; index += 1) {
    const [threshold, unit] = intervals[index];
    if (Math.abs(elapsedSeconds) < threshold) {
      const [baseSeconds] = intervals[index - 1];
      const value = Math.round(elapsedSeconds / baseSeconds);
      return formatter.format(value, unit);
    }
  }

  return "just now";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
