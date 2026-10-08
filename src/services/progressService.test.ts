import { describe, expect, it } from 'vitest';
import { progressService } from './progressService';
import { DailyTask, LongTermGoal, Milestone, Subtask } from '../models/types';

const sub = (done: boolean, i = 0): Subtask => ({
  id: `s${i}`,
  title: `sub ${i}`,
  priority: 'normal',
  status: done ? 'completed' : 'pending',
});

const task = (over: Partial<DailyTask> = {}): DailyTask => ({
  id: 't1',
  title: 'Task',
  createdAt: 0,
  priority: 'normal',
  status: 'pending',
  subtasks: [],
  ...over,
});

const goal = (over: Partial<LongTermGoal> = {}): LongTermGoal => ({
  id: 'g1',
  title: 'Goal',
  createdAt: 0,
  status: 'active',
  milestones: [],
  ...over,
});

const milestone = (done: boolean, i = 0): Milestone => ({
  id: `m${i}`,
  title: `milestone ${i}`,
  status: done ? 'completed' : 'pending',
});

describe('task progress', () => {
  it('is binary when there are no subtasks', () => {
    expect(progressService.taskProgress(task())).toBe(0);
    expect(progressService.taskProgress(task({ status: 'completed' }))).toBe(100);
  });

  it('is completed subtasks over total subtasks', () => {
    const t = task({
      subtasks: [sub(true, 1), sub(true, 2), sub(true, 3), sub(false, 4), sub(false, 5)],
    });
    // 3 of 5 completed -> 60%, the figure named in the spec.
    expect(progressService.taskProgress(t)).toBe(60);
    expect(progressService.subtaskCount(t)).toEqual({ completed: 3, total: 5 });
  });

  it('reports 100% for a completed task even with open subtasks', () => {
    const t = task({ status: 'completed', subtasks: [sub(false, 1), sub(false, 2)] });
    expect(progressService.taskProgress(t)).toBe(100);
  });

  it('rounds to whole percentages', () => {
    const t = task({ subtasks: [sub(true, 1), sub(false, 2), sub(false, 3)] });
    expect(progressService.taskProgress(t)).toBe(33);
  });
});

describe('goal progress', () => {
  it('is zero with nothing attached', () => {
    expect(progressService.goalProgress(goal(), [])).toBe(0);
  });

  it('counts milestones as all-or-nothing', () => {
    const g = goal({ milestones: [milestone(true, 1), milestone(false, 2)] });
    expect(progressService.goalProgress(g, [])).toBe(50);
  });

  it('weights each milestone and linked task equally', () => {
    const g = goal({ milestones: [milestone(true, 1)] });
    const linked = task({
      id: 'linked',
      parentLongTermGoalId: 'g1',
      subtasks: [sub(true, 1), sub(false, 2)],
    });
    // milestone 100, task 50 -> 75
    expect(progressService.goalProgress(g, [linked])).toBe(75);
  });

  it('ignores tasks belonging to another goal', () => {
    const g = goal({ milestones: [milestone(false, 1)] });
    const other = task({ id: 'x', parentLongTermGoalId: 'other', status: 'completed' });
    expect(progressService.goalProgress(g, [other])).toBe(0);
  });

  it('explains the number it produced', () => {
    const g = goal({ milestones: [milestone(true, 1), milestone(false, 2)] });
    const linked = task({ id: 'l', parentLongTermGoalId: 'g1', status: 'completed' });
    expect(progressService.goalBreakdown(g, [linked])).toEqual({
      milestonesDone: 1,
      milestonesTotal: 2,
      tasksDone: 1,
      tasksTotal: 1,
    });
  });
});
