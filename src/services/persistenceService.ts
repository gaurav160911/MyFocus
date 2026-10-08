import {
  AppSettings,
  AppState,
  DailyTask,
  LongTermGoal,
  Milestone,
  Priority,
  SCHEMA_VERSION,
  Status,
  Subtask,
} from '../models/types';

const STORAGE_KEY = 'my-focus:state';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  alwaysOnTop: true,
  widgetOpacity: 1,
  startWithWindows: false,
  notificationsEnabled: true,
  notificationSound: true,
  deadlineWarningHours: 6,
};

export function emptyState(): AppState {
  return {
    dailyTasks: [],
    longTermGoals: [],
    settings: { ...DEFAULT_SETTINGS },
    notifiedKeys: [],
    schemaVersion: SCHEMA_VERSION,
  };
}

/* ------------------------------------------------------------------ *
 * Validation
 *
 * Stored JSON is untrusted: it may be from an older schema, truncated
 * by a crash, or hand-edited. Every field is checked, and anything
 * unusable is dropped rather than allowed to crash the app on boot.
 * ------------------------------------------------------------------ */

const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'critical'];

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const priority = (v: unknown): Priority =>
  PRIORITIES.includes(v as Priority) ? (v as Priority) : 'normal';

const status = (v: unknown): Status => (v === 'completed' ? 'completed' : 'pending');

const id = (v: unknown): string => str(v) ?? crypto.randomUUID();

function parseSubtask(raw: unknown): Subtask | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title);
  if (!title) return null;
  return {
    id: id(r.id),
    title,
    deadline: num(r.deadline),
    priority: priority(r.priority),
    status: status(r.status),
    completedAt: num(r.completedAt),
  };
}

function parseTask(raw: unknown): DailyTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title);
  if (!title) return null;

  const subtasks = Array.isArray(r.subtasks)
    ? r.subtasks.map(parseSubtask).filter((s): s is Subtask => s !== null)
    : [];

  return {
    id: id(r.id),
    title,
    description: str(r.description),
    parentLongTermGoalId: str(r.parentLongTermGoalId),
    createdAt: num(r.createdAt) ?? Date.now(),
    deadline: num(r.deadline),
    priority: priority(r.priority),
    status: status(r.status),
    completedAt: num(r.completedAt),
    subtasks,
  };
}

function parseMilestone(raw: unknown): Milestone | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title);
  if (!title) return null;
  return {
    id: id(r.id),
    title,
    status: status(r.status),
    completedAt: num(r.completedAt),
  };
}

function parseGoal(raw: unknown): LongTermGoal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title);
  if (!title) return null;

  const milestones = Array.isArray(r.milestones)
    ? r.milestones.map(parseMilestone).filter((m): m is Milestone => m !== null)
    : [];

  return {
    id: id(r.id),
    title,
    description: str(r.description),
    createdAt: num(r.createdAt) ?? Date.now(),
    targetDate: num(r.targetDate),
    status: r.status === 'completed' || r.status === 'archived' ? r.status : 'active',
    milestones,
  };
}

function parseSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  const theme = r.theme;
  const opacity = num(r.widgetOpacity);
  const warn = num(r.deadlineWarningHours);

  return {
    theme: theme === 'light' || theme === 'dark' ? theme : 'system',
    alwaysOnTop: typeof r.alwaysOnTop === 'boolean' ? r.alwaysOnTop : true,
    widgetOpacity: opacity !== undefined ? Math.min(1, Math.max(0.5, opacity)) : 1,
    startWithWindows: r.startWithWindows === true,
    notificationsEnabled:
      typeof r.notificationsEnabled === 'boolean' ? r.notificationsEnabled : true,
    notificationSound: typeof r.notificationSound === 'boolean' ? r.notificationSound : true,
    deadlineWarningHours: warn !== undefined ? Math.min(48, Math.max(1, Math.round(warn))) : 6,
  };
}

/**
 * Schema 1 kept short-term goals as a separate level and stored subtasks as
 * free-standing tasks joined by id. Short-term goals are gone from the product,
 * so their tasks are lifted to daily tasks and their child tasks become subtasks.
 */
function migrateFromV1(r: Record<string, unknown>): Partial<AppState> {
  const legacyTasks = Array.isArray(r.tasks) ? (r.tasks as Record<string, unknown>[]) : [];
  if (legacyTasks.length === 0) return {};

  const byId = new Map(legacyTasks.map((t) => [String(t.id), t]));
  const childIds = new Set<string>();
  for (const t of legacyTasks) {
    const parent = str(t.parentTaskId);
    if (parent && byId.has(parent)) childIds.add(String(t.id));
  }

  const dailyTasks: DailyTask[] = [];
  for (const legacy of legacyTasks) {
    if (childIds.has(String(legacy.id))) continue;

    const task = parseTask(legacy);
    if (!task) continue;

    const children = legacyTasks.filter((c) => str(c.parentTaskId) === String(legacy.id));
    task.subtasks = children
      .map(parseSubtask)
      .filter((s): s is Subtask => s !== null);

    dailyTasks.push(task);
  }

  return { dailyTasks };
}

function parseState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return emptyState();
  const r = raw as Record<string, unknown>;

  const version = num(r.schemaVersion) ?? 1;
  const migrated = version < 2 ? migrateFromV1(r) : {};

  const dailyTasks =
    migrated.dailyTasks ??
    (Array.isArray(r.dailyTasks)
      ? r.dailyTasks.map(parseTask).filter((t): t is DailyTask => t !== null)
      : []);

  const longTermGoals = Array.isArray(r.longTermGoals)
    ? r.longTermGoals.map(parseGoal).filter((g): g is LongTermGoal => g !== null)
    : [];

  // Drop links pointing at goals that no longer exist.
  const goalIds = new Set(longTermGoals.map((g) => g.id));
  for (const task of dailyTasks) {
    if (task.parentLongTermGoalId && !goalIds.has(task.parentLongTermGoalId)) {
      task.parentLongTermGoalId = undefined;
    }
  }

  const taskIds = new Set(dailyTasks.map((t) => t.id));
  const focusTaskId = str(r.focusTaskId);

  return {
    dailyTasks,
    longTermGoals,
    settings: parseSettings(r.settings),
    focusTaskId: focusTaskId && taskIds.has(focusTaskId) ? focusTaskId : undefined,
    notifiedKeys: Array.isArray(r.notifiedKeys)
      ? r.notifiedKeys.filter((k): k is string => typeof k === 'string')
      : [],
    schemaVersion: SCHEMA_VERSION,
  };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export const persistenceService = {
  load(): AppState {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (!serialized) return emptyState();
      return parseState(JSON.parse(serialized));
    } catch (err) {
      // Corrupted store: keep the bad copy aside for recovery and start clean
      // rather than leaving the app unable to boot.
      console.error('Could not read saved data, starting fresh.', err);
      try {
        const bad = localStorage.getItem(STORAGE_KEY);
        if (bad) localStorage.setItem(`${STORAGE_KEY}:corrupt`, bad);
      } catch {
        /* ignore */
      }
      return emptyState();
    }
  },

  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Could not save data.', err);
    }
  },

  /** Settings > Data > Export. */
  export(state: AppState): string {
    return JSON.stringify(
      {
        dailyTasks: state.dailyTasks,
        longTermGoals: state.longTermGoals,
        settings: state.settings,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  },

  /** Settings > Data > Import. Throws on unusable input so the UI can report it. */
  import(json: string): AppState {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('File does not contain My Focus data.');
    }
    const state = parseState(parsed);
    if (state.dailyTasks.length === 0 && state.longTermGoals.length === 0) {
      throw new Error('No tasks or goals found in that file.');
    }
    return state;
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Could not clear data.', err);
    }
  },
};
