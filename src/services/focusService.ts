import { DailyTask, Priority } from '../models/types';
import { urgencyService } from './urgencyService';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Score contribution from user-set priority. Priority is NOT urgency:
 * it only breaks ties and nudges ranking, it can never outrank a deadline
 * that is hours away.
 */
const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 24,
  high: 14,
  normal: 0,
  low: -10,
};

/**
 * A task must beat the current focus task by this margin before focus moves.
 * This is the stability rule: two tasks 55 and 60 minutes out will not cause
 * focus to flip back and forth, because their scores differ by far less than
 * the margin.
 */
export const FOCUS_SWITCH_MARGIN = 12;

export const focusService = {
  /**
   * Deadline pressure, 0..100. Grows smoothly and accelerates as the deadline
   * nears, so "in 30 minutes" dominates "in 5 hours" dominates "in 3 days".
   * Tasks with no deadline get a low baseline so they never pre-empt dated work.
   */
  deadlinePressure(deadline: number | undefined, now: number): number {
    if (!deadline) return 8;

    const remaining = deadline - now;

    // Overdue: above every scheduled task, and worse the longer it is late.
    if (remaining < 0) {
      const lateHours = Math.abs(remaining) / HOUR;
      return 100 + Math.min(20, lateHours);
    }

    if (remaining < HOUR) {
      // 100 at the deadline down to 85 an hour out.
      return 85 + 15 * (1 - remaining / HOUR);
    }
    if (remaining < 6 * HOUR) {
      // 85 at 1h down to 65 at 6h.
      return 65 + 20 * (1 - (remaining - HOUR) / (5 * HOUR));
    }
    if (remaining < DAY) {
      // 65 at 6h down to 45 at 24h.
      return 45 + 20 * (1 - (remaining - 6 * HOUR) / (18 * HOUR));
    }
    if (remaining < 3 * DAY) {
      // 45 at 1d down to 25 at 3d.
      return 25 + 20 * (1 - (remaining - DAY) / (2 * DAY));
    }
    if (remaining < 14 * DAY) {
      // 25 at 3d trailing off to 5 at two weeks.
      return 5 + 20 * (1 - (remaining - 3 * DAY) / (11 * DAY));
    }
    return 4;
  },

  /**
   * Total focus score. Higher means "work on this first". Deterministic:
   * the same task and the same clock always produce the same number.
   */
  calculateFocusScore(task: DailyTask, now: number = Date.now()): number {
    let score = this.deadlinePressure(task.deadline, now);

    score += PRIORITY_WEIGHT[task.priority];

    // A subtask deadline that is sooner than the parent's raises the parent.
    for (const sub of task.subtasks) {
      if (sub.status === 'pending' && sub.deadline) {
        const subPressure = this.deadlinePressure(sub.deadline, now);
        if (subPressure > score) score = subPressure;
      }
    }

    // Work already underway is cheaper to finish than work not yet started.
    const total = task.subtasks.length;
    if (total > 0) {
      const done = task.subtasks.filter((s) => s.status === 'completed').length;
      if (done > 0 && done < total) score += 6 * (done / total);
    }

    return score;
  },

  /** Pending tasks, best first. */
  rankTasks(tasks: DailyTask[], now: number = Date.now()): DailyTask[] {
    return tasks
      .filter((t) => t.status === 'pending')
      .map((task) => ({ task, score: this.calculateFocusScore(task, now) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Stable, deterministic tie-breakers.
        if (a.task.deadline && b.task.deadline && a.task.deadline !== b.task.deadline) {
          return a.task.deadline - b.task.deadline;
        }
        if (a.task.createdAt !== b.task.createdAt) return a.task.createdAt - b.task.createdAt;
        return a.task.id.localeCompare(b.task.id);
      })
      .map((entry) => entry.task);
  },

  /**
   * The single focus task.
   *
   * `currentFocusId` is the task that held focus a moment ago. If it is still
   * pending, it keeps focus unless some other task scores more than
   * FOCUS_SWITCH_MARGIN higher. That is what makes focus stable rather than
   * jittery, while still handing over when something genuinely more critical
   * appears.
   */
  getFocusTask(
    tasks: DailyTask[],
    currentFocusId?: string,
    now: number = Date.now()
  ): DailyTask | null {
    const ranked = this.rankTasks(tasks, now);
    if (ranked.length === 0) return null;

    const leader = ranked[0];
    if (!currentFocusId || currentFocusId === leader.id) return leader;

    const incumbent = ranked.find((t) => t.id === currentFocusId);
    if (!incumbent) return leader;

    const leaderScore = this.calculateFocusScore(leader, now);
    const incumbentScore = this.calculateFocusScore(incumbent, now);

    return leaderScore - incumbentScore > FOCUS_SWITCH_MARGIN ? leader : incumbent;
  },

  /** Everything except the focus task, in the same ranked order. */
  getOtherTasks(
    tasks: DailyTask[],
    focusId: string | undefined,
    now: number = Date.now()
  ): DailyTask[] {
    return this.rankTasks(tasks, now).filter((t) => t.id !== focusId);
  },

  /**
   * Plain-language reason this task is the focus. Shown in the full app so the
   * ranking is never a black box.
   */
  explain(task: DailyTask, now: number = Date.now()): string {
    const urgency = urgencyService.effectiveUrgency(task, now);

    if (urgency === 'overdue') return 'Past its deadline';
    if (urgency === 'imminent') return 'Due within the hour';
    if (urgency === 'critical') return 'Due in under 6 hours';
    if (urgency === 'high') return 'Due within a day';
    if (task.priority === 'critical') return 'Marked critical priority';
    if (task.priority === 'high') return 'Marked high priority';
    if (urgency === 'approaching') return 'Deadline is approaching';
    if (!task.deadline) return 'Nothing more urgent is scheduled';
    return 'Next by deadline';
  },
};
