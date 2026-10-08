import { DailyTask, Subtask, UrgencyLevel } from '../models/types';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Urgency is derived ONLY from the deadline. It is never set by the user.
 * Thresholds (time remaining):
 *   overdue      deadline passed
 *   imminent     < 1h
 *   critical     < 6h
 *   high         < 24h
 *   approaching  < 3d
 *   normal       >= 3d, or no deadline
 */
export const urgencyService = {
  calculateUrgency(item: { deadline?: number }, now: number = Date.now()): UrgencyLevel {
    if (!item.deadline) return 'normal';

    const remaining = item.deadline - now;

    if (remaining < 0) return 'overdue';
    if (remaining < HOUR) return 'imminent';
    if (remaining < 6 * HOUR) return 'critical';
    if (remaining < DAY) return 'high';
    if (remaining < 3 * DAY) return 'approaching';
    return 'normal';
  },

  /**
   * The most urgent level across the task itself and any subtask deadlines.
   * A task whose subtask is due in 20 minutes is itself imminent.
   */
  effectiveUrgency(task: DailyTask, now: number = Date.now()): UrgencyLevel {
    const levels: UrgencyLevel[] = [this.calculateUrgency(task, now)];
    for (const sub of task.subtasks) {
      if (sub.status === 'pending' && sub.deadline) {
        levels.push(this.calculateUrgency(sub, now));
      }
    }
    return levels.reduce((worst, level) =>
      URGENCY_RANK[level] > URGENCY_RANK[worst] ? level : worst
    );
  },

  /** Short human label: "47m", "4h", "2d", "Mar 14", "Overdue 2h". */
  formatTimeRemaining(deadline: number, now: number = Date.now()): string {
    const diff = deadline - now;

    if (diff < 0) {
      const past = Math.abs(diff);
      if (past >= DAY) return `Overdue ${Math.floor(past / DAY)}d`;
      if (past >= HOUR) return `Overdue ${Math.floor(past / HOUR)}h`;
      return `Overdue ${Math.max(1, Math.floor(past / MINUTE))}m`;
    }

    if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MINUTE))}m`;
    if (diff < 2 * HOUR) {
      const h = Math.floor(diff / HOUR);
      const m = Math.floor((diff % HOUR) / MINUTE);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
    if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;

    return new Date(deadline).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  },

  /** Longer label used in the Focus card: "Due in 47 minutes". */
  formatDeadlineSentence(deadline: number, now: number = Date.now()): string {
    const diff = deadline - now;

    if (diff < 0) {
      const past = Math.abs(diff);
      if (past >= DAY) {
        const d = Math.floor(past / DAY);
        return `Overdue by ${d} ${d === 1 ? 'day' : 'days'}`;
      }
      if (past >= HOUR) {
        const h = Math.floor(past / HOUR);
        return `Overdue by ${h} ${h === 1 ? 'hour' : 'hours'}`;
      }
      const m = Math.max(1, Math.floor(past / MINUTE));
      return `Overdue by ${m} ${m === 1 ? 'minute' : 'minutes'}`;
    }

    if (diff < HOUR) {
      const m = Math.max(1, Math.floor(diff / MINUTE));
      return `Due in ${m} ${m === 1 ? 'minute' : 'minutes'}`;
    }
    if (diff < DAY) {
      const h = Math.floor(diff / HOUR);
      const m = Math.floor((diff % HOUR) / MINUTE);
      if (h < 2 && m > 0) return `Due in ${h}h ${m}m`;
      return `Due in ${h} ${h === 1 ? 'hour' : 'hours'}`;
    }
    const d = Math.floor(diff / DAY);
    return `Due in ${d} ${d === 1 ? 'day' : 'days'}`;
  },

  isToday(timestamp: number, now: number = Date.now()): boolean {
    const a = new Date(timestamp);
    const b = new Date(now);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  },

  isTomorrow(timestamp: number, now: number = Date.now()): boolean {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const a = new Date(timestamp);
    return (
      a.getFullYear() === tomorrow.getFullYear() &&
      a.getMonth() === tomorrow.getMonth() &&
      a.getDate() === tomorrow.getDate()
    );
  },
};

export const URGENCY_RANK: Record<UrgencyLevel, number> = {
  normal: 0,
  approaching: 1,
  high: 2,
  critical: 3,
  imminent: 4,
  overdue: 5,
};

export type { Subtask };
