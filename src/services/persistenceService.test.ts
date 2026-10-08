import { describe, expect, it, beforeEach } from 'vitest';
import { persistenceService, emptyState } from './persistenceService';
import { SCHEMA_VERSION } from '../models/types';

const STORAGE_KEY = 'my-focus:state';

describe('persistenceService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty state when nothing is stored', () => {
    const state = persistenceService.load();
    expect(state.dailyTasks).toEqual([]);
    expect(state.longTermGoals).toEqual([]);
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('round-trips tasks and goals', () => {
    const state = emptyState();
    state.dailyTasks.push({
      id: 't1',
      title: 'DBMS Assignment',
      createdAt: 1000,
      deadline: 5000,
      priority: 'high',
      status: 'pending',
      subtasks: [{ id: 's1', title: 'Read questions', priority: 'normal', status: 'completed' }],
    });

    persistenceService.save(state);
    const loaded = persistenceService.load();

    expect(loaded.dailyTasks).toHaveLength(1);
    expect(loaded.dailyTasks[0].title).toBe('DBMS Assignment');
    expect(loaded.dailyTasks[0].subtasks[0].status).toBe('completed');
  });

  it('survives corrupted JSON instead of throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const state = persistenceService.load();
    expect(state.dailyTasks).toEqual([]);
    // The unreadable copy is kept aside for recovery.
    expect(localStorage.getItem(`${STORAGE_KEY}:corrupt`)).toBe('{not json');
  });

  it('drops entries that are missing a title rather than keeping junk', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        dailyTasks: [{ id: 'a' }, { id: 'b', title: 'Real task' }],
      })
    );
    const state = persistenceService.load();
    expect(state.dailyTasks).toHaveLength(1);
    expect(state.dailyTasks[0].title).toBe('Real task');
  });

  it('repairs unknown field values to safe defaults', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        dailyTasks: [
          { id: 'a', title: 'Task', priority: 'bogus', status: 'whatever', deadline: 'soon' },
        ],
      })
    );
    const state = persistenceService.load();
    expect(state.dailyTasks[0].priority).toBe('normal');
    expect(state.dailyTasks[0].status).toBe('pending');
    expect(state.dailyTasks[0].deadline).toBeUndefined();
  });

  it('migrates v1 data, folding child tasks into subtasks', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        tasks: [
          { id: 'p', title: 'Finish DBMS Assignment', priority: 'high', status: 'pending' },
          { id: 'c1', title: 'Solve Q1-Q5', parentTaskId: 'p', status: 'completed' },
          { id: 'c2', title: 'Submit', parentTaskId: 'p', status: 'pending' },
        ],
      })
    );

    const state = persistenceService.load();
    expect(state.dailyTasks).toHaveLength(1);
    expect(state.dailyTasks[0].title).toBe('Finish DBMS Assignment');
    expect(state.dailyTasks[0].subtasks.map((s) => s.title)).toEqual(['Solve Q1-Q5', 'Submit']);
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('clears links to goals that no longer exist', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        dailyTasks: [{ id: 'a', title: 'Task', parentLongTermGoalId: 'missing' }],
        longTermGoals: [],
      })
    );
    const state = persistenceService.load();
    expect(state.dailyTasks[0].parentLongTermGoalId).toBeUndefined();
  });

  it('rejects an import file that holds no tasks or goals', () => {
    expect(() => persistenceService.import('{"dailyTasks":[]}')).toThrow();
  });

  it('imports a file produced by export', () => {
    const state = emptyState();
    state.longTermGoals.push({
      id: 'g1',
      title: 'Learn Cybersecurity',
      createdAt: 1,
      status: 'active',
      milestones: [],
    });

    const imported = persistenceService.import(persistenceService.export(state));
    expect(imported.longTermGoals[0].title).toBe('Learn Cybersecurity');
  });
});
