import { describe, expect, it } from 'vitest';
import { urgencyService } from './urgencyService';
import { DailyTask } from '../models/types';

const NOW = new Date('2026-06-15T12:00:00Z').getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const task = (patch: Partial<DailyTask> = {}): DailyTask => ({
  id: 't',
  title: 'Task',
  createdAt: NOW,
  priority: 'normal',
  status: 'pending',
  subtasks: [],
  ...patch,
});

describe('calculateUrgency', () => {
  it('is normal with no deadline', () => {
    expect(urgencyService.calculateUrgency(task(), NOW)).toBe('normal');
  });

  it('is normal beyond three days', () => {
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + 5 * DAY }), NOW)).toBe('normal');
  });

  it('is approaching inside three days', () => {
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + 2 * DAY }), NOW)).toBe(
      'approaching'
    );
  });

  it('is high inside a day', () => {
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + 10 * HOUR }), NOW)).toBe('high');
  });

  it('is critical inside six hours', () => {
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + 4 * HOUR }), NOW)).toBe(
      'critical'
    );
  });

  it('is imminent inside the final hour', () => {
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + 30 * MIN }), NOW)).toBe(
      'imminent'
    );
  });

  it('is overdue once the deadline passes', () => {
    expect(urgencyService.calculateUrgency(task({ deadline: NOW - MIN }), NOW)).toBe('overdue');
  });

  // Boundaries are exclusive on the lower side: exactly 1h away is still critical,
  // not imminent, so a task never flickers between two levels on the same tick.
  it('treats boundaries deterministically', () => {
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + HOUR }), NOW)).toBe('critical');
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + 6 * HOUR }), NOW)).toBe('high');
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + DAY }), NOW)).toBe('approaching');
    expect(urgencyService.calculateUrgency(task({ deadline: NOW + 3 * DAY }), NOW)).toBe('normal');
  });

  it('is overdue exactly at the deadline only after it passes', () => {
    expect(urgencyService.calculateUrgency(task({ deadline: NOW }), NOW)).toBe('imminent');
    expect(urgencyService.calculateUrgency(task({ deadline: NOW - 1 }), NOW)).toBe('overdue');
  });
});

describe('effectiveUrgency', () => {
  it('rises to match a sooner pending subtask deadline', () => {
    const t = task({
      deadline: NOW + 5 * DAY,
      subtasks: [
        { id: 's1', title: 'Soon', priority: 'normal', status: 'pending', deadline: NOW + 20 * MIN },
      ],
    });
    expect(urgencyService.effectiveUrgency(t, NOW)).toBe('imminent');
  });

  it('ignores completed subtasks', () => {
    const t = task({
      deadline: NOW + 5 * DAY,
      subtasks: [
        {
          id: 's1',
          title: 'Done',
          priority: 'normal',
          status: 'completed',
          deadline: NOW + 20 * MIN,
        },
      ],
    });
    expect(urgencyService.effectiveUrgency(t, NOW)).toBe('normal');
  });
});

describe('formatting', () => {
  it('formats minutes, hours and days', () => {
    expect(urgencyService.formatTimeRemaining(NOW + 47 * MIN, NOW)).toBe('47m');
    expect(urgencyService.formatTimeRemaining(NOW + 90 * MIN, NOW)).toBe('1h 30m');
    expect(urgencyService.formatTimeRemaining(NOW + 5 * HOUR, NOW)).toBe('5h');
    expect(urgencyService.formatTimeRemaining(NOW + 2 * DAY, NOW)).toBe('2d');
  });

  it('labels overdue work', () => {
    expect(urgencyService.formatTimeRemaining(NOW - 2 * HOUR, NOW)).toBe('Overdue 2h');
  });

  it('writes a readable sentence for the focus card', () => {
    expect(urgencyService.formatDeadlineSentence(NOW + 47 * MIN, NOW)).toBe('Due in 47 minutes');
    expect(urgencyService.formatDeadlineSentence(NOW + 1 * MIN, NOW)).toBe('Due in 1 minute');
    expect(urgencyService.formatDeadlineSentence(NOW - 2 * HOUR, NOW)).toBe('Overdue by 2 hours');
  });
});
