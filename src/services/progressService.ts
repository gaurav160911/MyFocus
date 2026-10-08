import { DailyTask, LongTermGoal, Milestone } from '../models/types';

/**
 * Progress is always derived from completion state. Nothing in the app lets the
 * user type a percentage.
 *
 * Weighting rules:
 *   Task  - if it has subtasks, progress is completed subtasks / total subtasks.
 *           A task with no subtasks is binary: 0% or 100%.
 *           A task marked complete is 100% regardless of its subtasks.
 *   Goal  - every item attached to the goal counts equally: each linked daily
 *           task contributes its own task progress, each milestone contributes
 *           0 or 100. This keeps the number honest and easy to explain:
 *           "the average completion of the things under this goal".
 */
export const progressService = {
  taskProgress(task: DailyTask): number {
    if (task.status === 'completed') return 100;
    if (task.subtasks.length === 0) return 0;

    const done = task.subtasks.filter((s) => s.status === 'completed').length;
    return Math.round((done / task.subtasks.length) * 100);
  },

  subtaskCount(task: DailyTask): { completed: number; total: number } {
    return {
      completed: task.subtasks.filter((s) => s.status === 'completed').length,
      total: task.subtasks.length,
    };
  },

  milestoneProgress(milestones: Milestone[]): number {
    if (milestones.length === 0) return 0;
    const done = milestones.filter((m) => m.status === 'completed').length;
    return Math.round((done / milestones.length) * 100);
  },

  goalProgress(goal: LongTermGoal, allTasks: DailyTask[]): number {
    const linkedTasks = allTasks.filter((t) => t.parentLongTermGoalId === goal.id);

    const contributions: number[] = [
      ...goal.milestones.map((m) => (m.status === 'completed' ? 100 : 0)),
      ...linkedTasks.map((t) => this.taskProgress(t)),
    ];

    if (contributions.length === 0) return 0;

    const sum = contributions.reduce((a, b) => a + b, 0);
    return Math.round(sum / contributions.length);
  },

  /** Human explanation of a goal's number, so the percentage is never opaque. */
  goalBreakdown(
    goal: LongTermGoal,
    allTasks: DailyTask[]
  ): { milestonesDone: number; milestonesTotal: number; tasksDone: number; tasksTotal: number } {
    const linkedTasks = allTasks.filter((t) => t.parentLongTermGoalId === goal.id);
    return {
      milestonesDone: goal.milestones.filter((m) => m.status === 'completed').length,
      milestonesTotal: goal.milestones.length,
      tasksDone: linkedTasks.filter((t) => t.status === 'completed').length,
      tasksTotal: linkedTasks.length,
    };
  },
};
