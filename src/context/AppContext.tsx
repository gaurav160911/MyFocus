import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  AppSettings,
  AppState,
  DailyTask,
  LongTermGoal,
  Milestone,
  Priority,
  Subtask,
  ViewMode,
} from '../models/types';
import { persistenceService, emptyState } from '../services/persistenceService';
import { focusService } from '../services/focusService';
import { notificationService } from '../services/notificationService';
import { windowService } from '../services/windowService';

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

export type NewTaskInput = {
  title: string;
  description?: string;
  deadline?: number;
  priority: Priority;
  parentLongTermGoalId?: string;
  subtaskTitles?: string[];
};

export type NewGoalInput = {
  title: string;
  description?: string;
  targetDate?: number;
  milestoneTitles?: string[];
};

type Action =
  | { type: 'ADD_TASK'; task: DailyTask }
  | { type: 'PATCH_TASK'; id: string; patch: Partial<DailyTask> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'TOGGLE_TASK'; id: string; now: number }
  | { type: 'ADD_SUBTASK'; taskId: string; subtask: Subtask }
  | { type: 'PATCH_SUBTASK'; taskId: string; id: string; patch: Partial<Subtask> }
  | { type: 'DELETE_SUBTASK'; taskId: string; id: string }
  | { type: 'TOGGLE_SUBTASK'; taskId: string; id: string; now: number }
  | { type: 'ADD_GOAL'; goal: LongTermGoal }
  | { type: 'PATCH_GOAL'; id: string; patch: Partial<LongTermGoal> }
  | { type: 'DELETE_GOAL'; id: string }
  | { type: 'ADD_MILESTONE'; goalId: string; milestone: Milestone }
  | { type: 'TOGGLE_MILESTONE'; goalId: string; id: string; now: number }
  | { type: 'DELETE_MILESTONE'; goalId: string; id: string }
  | { type: 'SET_FOCUS'; id?: string }
  | { type: 'PATCH_SETTINGS'; patch: Partial<AppSettings> }
  | { type: 'MARK_NOTIFIED'; keys: string[] }
  | { type: 'PRUNE_NOTIFIED' }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'REPLACE_STATE'; state: AppState };

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

const mapTask = (
  state: AppState,
  id: string,
  fn: (task: DailyTask) => DailyTask
): AppState => ({
  ...state,
  dailyTasks: state.dailyTasks.map((t) => (t.id === id ? fn(t) : t)),
});

const mapGoal = (
  state: AppState,
  id: string,
  fn: (goal: LongTermGoal) => LongTermGoal
): AppState => ({
  ...state,
  longTermGoals: state.longTermGoals.map((g) => (g.id === id ? fn(g) : g)),
});

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, dailyTasks: [...state.dailyTasks, action.task] };

    case 'PATCH_TASK':
      return mapTask(state, action.id, (t) => ({ ...t, ...action.patch }));

    case 'DELETE_TASK':
      return {
        ...state,
        dailyTasks: state.dailyTasks.filter((t) => t.id !== action.id),
        focusTaskId: state.focusTaskId === action.id ? undefined : state.focusTaskId,
      };

    case 'TOGGLE_TASK': {
      const next = mapTask(state, action.id, (t) =>
        t.status === 'completed'
          ? { ...t, status: 'pending', completedAt: undefined }
          : { ...t, status: 'completed', completedAt: action.now }
      );
      // Completing the focus task releases focus so the next one is chosen.
      const completed = next.dailyTasks.find((t) => t.id === action.id)?.status === 'completed';
      return {
        ...next,
        focusTaskId: completed && state.focusTaskId === action.id ? undefined : next.focusTaskId,
      };
    }

    case 'ADD_SUBTASK':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        subtasks: [...t.subtasks, action.subtask],
      }));

    case 'PATCH_SUBTASK':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      }));

    case 'DELETE_SUBTASK':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.filter((s) => s.id !== action.id),
      }));

    case 'TOGGLE_SUBTASK':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.map((s) =>
          s.id === action.id
            ? s.status === 'completed'
              ? { ...s, status: 'pending', completedAt: undefined }
              : { ...s, status: 'completed', completedAt: action.now }
            : s
        ),
      }));

    case 'ADD_GOAL':
      return { ...state, longTermGoals: [...state.longTermGoals, action.goal] };

    case 'PATCH_GOAL':
      return mapGoal(state, action.id, (g) => ({ ...g, ...action.patch }));

    case 'DELETE_GOAL':
      return {
        ...state,
        longTermGoals: state.longTermGoals.filter((g) => g.id !== action.id),
        // Tasks outlive their goal; they just lose the link.
        dailyTasks: state.dailyTasks.map((t) =>
          t.parentLongTermGoalId === action.id ? { ...t, parentLongTermGoalId: undefined } : t
        ),
      };

    case 'ADD_MILESTONE':
      return mapGoal(state, action.goalId, (g) => ({
        ...g,
        milestones: [...g.milestones, action.milestone],
      }));

    case 'TOGGLE_MILESTONE':
      return mapGoal(state, action.goalId, (g) => ({
        ...g,
        milestones: g.milestones.map((m) =>
          m.id === action.id
            ? m.status === 'completed'
              ? { ...m, status: 'pending', completedAt: undefined }
              : { ...m, status: 'completed', completedAt: action.now }
            : m
        ),
      }));

    case 'DELETE_MILESTONE':
      return mapGoal(state, action.goalId, (g) => ({
        ...g,
        milestones: g.milestones.filter((m) => m.id !== action.id),
      }));

    case 'SET_FOCUS':
      return { ...state, focusTaskId: action.id };

    case 'PATCH_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'MARK_NOTIFIED':
      return { ...state, notifiedKeys: [...state.notifiedKeys, ...action.keys] };

    case 'PRUNE_NOTIFIED': {
      const pruned = notificationService.prune(state.notifiedKeys, state.dailyTasks);
      return pruned.length === state.notifiedKeys.length ? state : { ...state, notifiedKeys: pruned };
    }

    case 'CLEAR_COMPLETED':
      return { ...state, dailyTasks: state.dailyTasks.filter((t) => t.status !== 'completed') };

    case 'REPLACE_STATE':
      return action.state;

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

interface AppContextValue {
  state: AppState;
  /** Ticks every 30s so deadline labels and urgency stay live without per-row timers. */
  now: number;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  focusTask: DailyTask | null;
  otherTasks: DailyTask[];
  completedTasks: DailyTask[];

  addTask: (input: NewTaskInput) => void;
  patchTask: (id: string, patch: Partial<DailyTask>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  rescheduleTask: (id: string, deadline: number) => void;

  addSubtask: (taskId: string, title: string, extra?: Partial<Subtask>) => void;
  patchSubtask: (taskId: string, id: string, patch: Partial<Subtask>) => void;
  deleteSubtask: (taskId: string, id: string) => void;
  toggleSubtask: (taskId: string, id: string) => void;

  addGoal: (input: NewGoalInput) => void;
  patchGoal: (id: string, patch: Partial<LongTermGoal>) => void;
  deleteGoal: (id: string) => void;
  addMilestone: (goalId: string, title: string) => void;
  toggleMilestone: (goalId: string, id: string) => void;
  deleteMilestone: (goalId: string, id: string) => void;

  patchSettings: (patch: Partial<AppSettings>) => void;
  clearCompleted: () => void;
  exportData: () => string;
  importData: (json: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const TICK_MS = 30_000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, persistenceService.load);
  const [viewMode, setViewModeState] = useState<ViewMode>('collapsed');
  const [now, setNow] = useState(() => Date.now());

  /* Clock. One timer for the whole app. */
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  /* Persist on every change. */
  useEffect(() => {
    persistenceService.save(state);
  }, [state]);

  /* Resolve focus, honouring the stability margin, and remember the choice. */
  const focusTask = useMemo(
    () => focusService.getFocusTask(state.dailyTasks, state.focusTaskId, now),
    [state.dailyTasks, state.focusTaskId, now]
  );

  useEffect(() => {
    if (focusTask && focusTask.id !== state.focusTaskId) {
      dispatch({ type: 'SET_FOCUS', id: focusTask.id });
    } else if (!focusTask && state.focusTaskId) {
      dispatch({ type: 'SET_FOCUS', id: undefined });
    }
  }, [focusTask, state.focusTaskId]);

  const otherTasks = useMemo(
    () => focusService.getOtherTasks(state.dailyTasks, focusTask?.id, now),
    [state.dailyTasks, focusTask?.id, now]
  );

  const completedTasks = useMemo(
    () =>
      state.dailyTasks
        .filter((t) => t.status === 'completed')
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [state.dailyTasks]
  );

  /* Theme. Applied to <html> so both window modes share it. */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved =
        state.settings.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : state.settings.theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [state.settings.theme]);

  /* Deadline notifications. Fires at most once per task per level. */
  const notifying = useRef(false);
  useEffect(() => {
    if (notifying.current) return;
    const intents = notificationService.pending(
      state.dailyTasks,
      state.notifiedKeys,
      state.settings,
      now
    );
    if (intents.length === 0) return;

    notifying.current = true;
    dispatch({ type: 'MARK_NOTIFIED', keys: intents.map((i) => i.key) });
    notificationService
      .send(intents, state.settings.notificationSound)
      .finally(() => {
        notifying.current = false;
      });
  }, [state.dailyTasks, state.notifiedKeys, state.settings, now]);

  useEffect(() => {
    dispatch({ type: 'PRUNE_NOTIFIED' });
  }, [state.dailyTasks]);

  /* Native window: mode, always-on-top, autostart. */
  useEffect(() => {
    if (viewMode === 'collapsed') {
      void windowService.applyLogoMode(state.settings.alwaysOnTop);
    } else {
      void windowService.applyViewMode(viewMode, state.settings.alwaysOnTop);
    }
  }, [viewMode, state.settings.alwaysOnTop]);

  useEffect(() => {
    if (viewMode === 'widget' || viewMode === 'collapsed') {
      void windowService.setAlwaysOnTop(state.settings.alwaysOnTop);
    }
  }, [state.settings.alwaysOnTop, viewMode]);

  useEffect(() => {
    void windowService.setAutostart(state.settings.startWithWindows);
  }, [state.settings.startWithWindows]);

  /* Tray events: open widget, open full app, toggle settings. */
  useEffect(() => {
    let dispose: Array<() => void> = [];
    void (async () => {
      dispose = [
        await windowService.listen('tray://open-widget', () => setViewModeState('widget')),
        await windowService.listen('tray://open-full-app', () => setViewModeState('app')),
        await windowService.listen('tray://toggle-startup', () => {
          const next = !state.settings.startWithWindows;
          dispatch({ type: 'PATCH_SETTINGS', patch: { startWithWindows: next } });
        }),
        await windowService.listen('tray://toggle-aot', () => {
          const next = !state.settings.alwaysOnTop;
          dispatch({ type: 'PATCH_SETTINGS', patch: { alwaysOnTop: next } });
        }),
      ];
    })();
    return () => dispose.forEach((fn) => fn());
  }, [state.settings.startWithWindows, state.settings.alwaysOnTop]);

  /* ---------------- commands ---------------- */

  const addTask = useCallback((input: NewTaskInput) => {
    const title = input.title.trim();
    if (!title) return;

    const task: DailyTask = {
      id: crypto.randomUUID(),
      title,
      description: input.description?.trim() || undefined,
      parentLongTermGoalId: input.parentLongTermGoalId || undefined,
      createdAt: Date.now(),
      deadline: input.deadline,
      priority: input.priority,
      status: 'pending',
      subtasks: (input.subtaskTitles ?? [])
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({
          id: crypto.randomUUID(),
          title: t,
          priority: 'normal' as Priority,
          status: 'pending' as const,
        })),
    };
    dispatch({ type: 'ADD_TASK', task });
  }, []);

  const addGoal = useCallback((input: NewGoalInput) => {
    const title = input.title.trim();
    if (!title) return;

    const goal: LongTermGoal = {
      id: crypto.randomUUID(),
      title,
      description: input.description?.trim() || undefined,
      createdAt: Date.now(),
      targetDate: input.targetDate,
      status: 'active',
      milestones: (input.milestoneTitles ?? [])
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({ id: crypto.randomUUID(), title: t, status: 'pending' as const })),
    };
    dispatch({ type: 'ADD_GOAL', goal });
  }, []);

  const value: AppContextValue = {
    state,
    now,
    viewMode,
    setViewMode: setViewModeState,
    focusTask,
    otherTasks,
    completedTasks,

    addTask,
    patchTask: useCallback((id, patch) => dispatch({ type: 'PATCH_TASK', id, patch }), []),
    deleteTask: useCallback((id) => dispatch({ type: 'DELETE_TASK', id }), []),
    toggleTask: useCallback((id) => dispatch({ type: 'TOGGLE_TASK', id, now: Date.now() }), []),
    rescheduleTask: useCallback(
      (id, deadline) => dispatch({ type: 'PATCH_TASK', id, patch: { deadline } }),
      []
    ),

    addSubtask: useCallback((taskId, title, extra) => {
      const clean = title.trim();
      if (!clean) return;
      dispatch({
        type: 'ADD_SUBTASK',
        taskId,
        subtask: {
          id: crypto.randomUUID(),
          title: clean,
          priority: 'normal',
          status: 'pending',
          ...extra,
        },
      });
    }, []),
    patchSubtask: useCallback(
      (taskId, id, patch) => dispatch({ type: 'PATCH_SUBTASK', taskId, id, patch }),
      []
    ),
    deleteSubtask: useCallback(
      (taskId, id) => dispatch({ type: 'DELETE_SUBTASK', taskId, id }),
      []
    ),
    toggleSubtask: useCallback(
      (taskId, id) => dispatch({ type: 'TOGGLE_SUBTASK', taskId, id, now: Date.now() }),
      []
    ),

    addGoal,
    patchGoal: useCallback((id, patch) => dispatch({ type: 'PATCH_GOAL', id, patch }), []),
    deleteGoal: useCallback((id) => dispatch({ type: 'DELETE_GOAL', id }), []),
    addMilestone: useCallback((goalId, title) => {
      const clean = title.trim();
      if (!clean) return;
      dispatch({
        type: 'ADD_MILESTONE',
        goalId,
        milestone: { id: crypto.randomUUID(), title: clean, status: 'pending' },
      });
    }, []),
    toggleMilestone: useCallback(
      (goalId, id) => dispatch({ type: 'TOGGLE_MILESTONE', goalId, id, now: Date.now() }),
      []
    ),
    deleteMilestone: useCallback(
      (goalId, id) => dispatch({ type: 'DELETE_MILESTONE', goalId, id }),
      []
    ),

    patchSettings: useCallback((patch) => dispatch({ type: 'PATCH_SETTINGS', patch }), []),
    clearCompleted: useCallback(() => dispatch({ type: 'CLEAR_COMPLETED' }), []),
    exportData: useCallback(() => persistenceService.export(state), [state]),
    importData: useCallback((json: string) => {
      const next = persistenceService.import(json);
      dispatch({ type: 'REPLACE_STATE', state: next });
    }, []),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export { emptyState };
