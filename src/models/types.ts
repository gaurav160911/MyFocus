export type Priority = 'low' | 'normal' | 'high' | 'critical';
export type Status = 'pending' | 'completed';
export type GoalStatus = 'active' | 'completed' | 'archived';
export type UrgencyLevel =
  | 'normal'
  | 'approaching'
  | 'high'
  | 'critical'
  | 'imminent'
  | 'overdue';

/** Which window chrome is being rendered. The widget and the full app are the same page. */
export type ViewMode = 'collapsed' | 'widget' | 'app';

export type NavSection = 'daily' | 'longterm' | 'settings';

/** Level 3. Cannot contain children — the hierarchy stops here. */
export interface Subtask {
  id: string;
  title: string;
  deadline?: number;
  priority: Priority;
  status: Status;
  completedAt?: number;
}

/** Level 2. Where execution happens. */
export interface DailyTask {
  id: string;
  title: string;
  description?: string;
  /** Optional link up to a long-term goal, for progress roll-up. */
  parentLongTermGoalId?: string;
  createdAt: number;
  deadline?: number;
  priority: Priority;
  status: Status;
  completedAt?: number;
  subtasks: Subtask[];
}

/**
 * A checkpoint on a long-term goal that is not day-to-day work.
 * Milestones are checked off by hand; tasks are rolled up automatically.
 */
export interface Milestone {
  id: string;
  title: string;
  status: Status;
  completedAt?: number;
}

/** Level 1. Direction, not execution. */
export interface LongTermGoal {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  targetDate?: number;
  status: GoalStatus;
  milestones: Milestone[];
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  alwaysOnTop: boolean;
  widgetOpacity: number;
  startWithWindows: boolean;
  notificationsEnabled: boolean;
  notificationSound: boolean;
  /** Hours before a deadline at which the first warning fires. */
  deadlineWarningHours: number;
}

export interface AppState {
  dailyTasks: DailyTask[];
  longTermGoals: LongTermGoal[];
  settings: AppSettings;
  /** Task that currently holds focus. Persisted so focus survives a restart. */
  focusTaskId?: string;
  /** Deadline notifications already delivered, keyed `taskId:level`. */
  notifiedKeys: string[];
  schemaVersion: number;
}

export const SCHEMA_VERSION = 2;

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};
