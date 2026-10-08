import { describe, expect, it } from 'vitest';
import { focusService, FOCUS_SWITCH_MARGIN } from './focusService';
import { DailyTask, Priority } from '../models/types';

const NOW = new Date('2026-06-15T12:00:00Z').getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let seq = 0;
const task = (patch: Partial<DailyTask> = {}): DailyTask => ({
  id: `t${++seq}`,
  title: `Task ${seq}`,
  createdAt: NOW - seq * 1000,
  priority: 'normal' as Priority,
  status: 'pending',
  subtasks: [],
  ...patch,
});

describe('focus selection', () => {
  it('returns null when nothing is pending', () => {
    expect(focusService.getFocusTask([], undefined, NOW)).toBeNull();
    const done = task({ status: 'completed' });
    expect(focusService.getFocusTask([done], undefined, NOW)).toBeNull();
  });

  it('never selects a completed task', () => {
    const done = task({ status: 'completed', deadline: NOW + MIN });
    const open = task({ deadline: NOW + 10 * DAY });
    expect(focusService.getFocusTask([done, open], undefined, NOW)?.id).toBe(open.id);
  });

  it('picks the nearest deadline', () => {
    const a = task({ deadline: NOW + 45 * MIN });
    const b = task({ deadline: NOW + 6 * HOUR });
    const c = task({ deadline: NOW + DAY });
    const d = task({ deadline: NOW + 3 * DAY });
    expect(focusService.getFocusTask([d, c, b, a], undefined, NOW)?.id).toBe(a.id);
  });

  it('puts overdue work above everything scheduled', () => {
    const overdue = task({ deadline: NOW - 2 * HOUR });
    const soon = task({ deadline: NOW + 10 * MIN });
    expect(focusService.getFocusTask([soon, overdue], undefined, NOW)?.id).toBe(overdue.id);
  });

  it('moves to the next task after the focus task is completed', () => {
    const first = task({ deadline: NOW + 45 * MIN });
    const second = task({ deadline: NOW + 6 * HOUR });

    expect(focusService.getFocusTask([first, second], undefined, NOW)?.id).toBe(first.id);

    const afterwards = [{ ...first, status: 'completed' as const }, second];
    expect(focusService.getFocusTask(afterwards, undefined, NOW)?.id).toBe(second.id);
  });

  it('is deterministic — same input, same answer', () => {
    const tasks = [task({ deadline: NOW + HOUR }), task({ deadline: NOW + 2 * HOUR })];
    const a = focusService.getFocusTask(tasks, undefined, NOW);
    const b = focusService.getFocusTask(tasks, undefined, NOW);
    expect(a?.id).toBe(b?.id);
  });

  it('breaks exact ties by deadline then creation order, not at random', () => {
    const older = task({ createdAt: NOW - 10_000 });
    const newer = task({ createdAt: NOW - 1_000 });
    expect(focusService.getFocusTask([newer, older], undefined, NOW)?.id).toBe(older.id);
  });
});

describe('priority versus urgency', () => {
  it('does not let a distant high-priority task outrank an imminent one', () => {
    const imminentLow = task({ deadline: NOW + 30 * MIN, priority: 'low' });
    const distantCritical = task({ deadline: NOW + 10 * DAY, priority: 'critical' });
    expect(focusService.getFocusTask([distantCritical, imminentLow], undefined, NOW)?.id).toBe(
      imminentLow.id
    );
  });

  it('uses priority to order tasks that are equally urgent', () => {
    const normal = task({ deadline: NOW + 2 * DAY, priority: 'normal' });
    const high = task({ deadline: NOW + 2 * DAY, priority: 'high' });
    expect(focusService.getFocusTask([normal, high], undefined, NOW)?.id).toBe(high.id);
  });

  it('ranks a dated task above an undated one', () => {
    const dated = task({ deadline: NOW + 5 * DAY });
    const undated = task({});
    expect(focusService.getFocusTask([undated, dated], undefined, NOW)?.id).toBe(dated.id);
  });
});

describe('stability', () => {
  it('keeps focus when another task is only slightly more urgent', () => {
    const incumbent = task({ deadline: NOW + 60 * MIN });
    const rival = task({ deadline: NOW + 55 * MIN });

    // The rival does lead the ranking...
    expect(focusService.rankTasks([incumbent, rival], NOW)[0].id).toBe(rival.id);
    // ...but focus does not move, because the gap is under the margin.
    expect(focusService.getFocusTask([incumbent, rival], incumbent.id, NOW)?.id).toBe(incumbent.id);
  });

  it('hands over when another task is decisively more critical', () => {
    const incumbent = task({ deadline: NOW + 3 * DAY });
    const urgent = task({ deadline: NOW + 10 * MIN });
    expect(focusService.getFocusTask([incumbent, urgent], incumbent.id, NOW)?.id).toBe(urgent.id);
  });

  it('only switches once the gap exceeds the margin', () => {
    const incumbent = task({ deadline: NOW + 3 * DAY });
    const rival = task({ deadline: NOW + 2 * DAY });

    const gap =
      focusService.calculateFocusScore(rival, NOW) -
      focusService.calculateFocusScore(incumbent, NOW);

    const winner = focusService.getFocusTask([incumbent, rival], incumbent.id, NOW);
    expect(winner?.id).toBe(gap > FOCUS_SWITCH_MARGIN ? rival.id : incumbent.id);
  });

  it('drops a remembered focus task that no longer exists', () => {
    const open = task({ deadline: NOW + HOUR });
    expect(focusService.getFocusTask([open], 'deleted-id', NOW)?.id).toBe(open.id);
  });

  it('releases focus when the remembered task has been completed', () => {
    const done = task({ status: 'completed' });
    const open = task({ deadline: NOW + DAY });
    expect(focusService.getFocusTask([done, open], done.id, NOW)?.id).toBe(open.id);
  });
});

describe('subtask influence', () => {
  it('raises a task whose subtask is due sooner than the task itself', () => {
    const plain = task({ deadline: NOW + 2 * DAY });
    const withUrgentChild = task({
      deadline: NOW + 2 * DAY,
      subtasks: [
        { id: 'c1', title: 'Soon', priority: 'normal', status: 'pending', deadline: NOW + 20 * MIN },
      ],
    });
    expect(focusService.getFocusTask([plain, withUrgentChild], undefined, NOW)?.id).toBe(
      withUrgentChild.id
    );
  });

  it('prefers partly finished work over untouched work', () => {
    const started = task({
      deadline: NOW + 2 * DAY,
      subtasks: [
        { id: 'a', title: 'a', priority: 'normal', status: 'completed' },
        { id: 'b', title: 'b', priority: 'normal', status: 'pending' },
      ],
    });
    const untouched = task({
      deadline: NOW + 2 * DAY,
      subtasks: [
        { id: 'c', title: 'c', priority: 'normal', status: 'pending' },
        { id: 'd', title: 'd', priority: 'normal', status: 'pending' },
      ],
    });
    expect(focusService.getFocusTask([untouched, started], undefined, NOW)?.id).toBe(started.id);
  });
});

describe('other tasks', () => {
  it('excludes the focus task and keeps ranked order', () => {
    const a = task({ deadline: NOW + 30 * MIN });
    const b = task({ deadline: NOW + 5 * HOUR });
    const c = task({ deadline: NOW + 2 * DAY });

    const others = focusService.getOtherTasks([c, a, b], a.id, NOW);
    expect(others.map((t) => t.id)).toEqual([b.id, c.id]);
  });
});

describe('explanation', () => {
  it('states why the task was chosen', () => {
    expect(focusService.explain(task({ deadline: NOW - HOUR }), NOW)).toBe('Past its deadline');
    expect(focusService.explain(task({ deadline: NOW + 30 * MIN }), NOW)).toBe(
      'Due within the hour'
    );
    expect(focusService.explain(task({ priority: 'critical' }), NOW)).toBe(
      'Marked critical priority'
    );
    expect(focusService.explain(task({}), NOW)).toBe('Nothing more urgent is scheduled');
  });
});
