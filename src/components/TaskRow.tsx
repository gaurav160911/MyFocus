import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DailyTask } from '../models/types';
import { urgencyService } from '../services/urgencyService';
import { progressService } from '../services/progressService';
import {
  Check,
  ConfirmRow,
  DueChip,
  Meter,
  PriorityTag,
  RESCHEDULE_PRESETS,
  resolvePreset,
} from './primitives';
import { TaskEditor } from './TaskEditor';

/**
 * A task in the "Other tasks" list. Collapsed by default; expanding reveals
 * subtasks and the management actions. Keeping actions behind expansion is what
 * lets the list stay scannable.
 */
export const TaskRow = ({ task }: { task: DailyTask }) => {
  const {
    now,
    toggleTask,
    toggleSubtask,
    deleteTask,
    deleteSubtask,
    addSubtask,
    rescheduleTask,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');

  const urgency = urgencyService.effectiveUrgency(task, now);
  const { completed, total } = progressService.subtaskCount(task);
  const progress = progressService.taskProgress(task);
  const overdue = urgency === 'overdue';

  return (
    <li className="trow" data-urgency={urgency} data-open={open || undefined}>
      <div className="trow__main">
        <Check
          checked={false}
          onToggle={() => toggleTask(task.id)}
          label={`Complete ${task.title}`}
        />

        <button
          type="button"
          className="trow__hit"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="trow__title">{task.title}</span>
          <span className="trow__meta">
            {total > 0 && (
              <span className="trow__count">
                {completed}/{total}
              </span>
            )}
            <PriorityTag priority={task.priority} />
            {task.deadline && (
              <DueChip
                text={urgencyService.formatTimeRemaining(task.deadline, now)}
                urgency={urgency}
              />
            )}
          </span>
        </button>
      </div>

      {total > 0 && !open && (
        <div className="trow__meter">
          <Meter value={progress} />
        </div>
      )}

      {open && (
        <div className="trow__panel">
          {task.description && <p className="trow__notes">{task.description}</p>}

          {total > 0 && (
            <div className="trow__progress">
              <Meter value={progress} />
              <span className="trow__count">{progress}%</span>
            </div>
          )}

          <ul className="sublist">
            {task.subtasks.map((sub) => {
              const subUrgency = urgencyService.calculateUrgency(sub, now);
              return (
                <li key={sub.id} className="subrow" data-done={sub.status === 'completed' || undefined}>
                  <Check
                    checked={sub.status === 'completed'}
                    onToggle={() => toggleSubtask(task.id, sub.id)}
                    label={`Toggle ${sub.title}`}
                  />
                  <span className="subrow__title">{sub.title}</span>
                  {sub.deadline && sub.status === 'pending' && (
                    <DueChip
                      text={urgencyService.formatTimeRemaining(sub.deadline, now)}
                      urgency={subUrgency}
                    />
                  )}
                  <button
                    type="button"
                    className="iconbtn iconbtn--sm"
                    onClick={() => deleteSubtask(task.id, sub.id)}
                    aria-label={`Delete ${sub.title}`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>

          <form
            className="subadd"
            onSubmit={(e) => {
              e.preventDefault();
              addSubtask(task.id, newSubtask);
              setNewSubtask('');
            }}
          >
            <input
              className="input input--sm"
              placeholder="Add subtask"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setNewSubtask('');
              }}
            />
            <button type="submit" className="btn btn--ghost btn--sm" disabled={!newSubtask.trim()}>
              Add
            </button>
          </form>

          {overdue && (
            <div className="reschedule">
              <span className="reschedule__label">Reschedule</span>
              {RESCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => rescheduleTask(task.id, resolvePreset(preset.ms, now))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {confirming ? (
            <ConfirmRow
              message="Delete this task and its subtasks?"
              confirmLabel="Delete"
              onConfirm={() => deleteTask(task.id)}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <div className="trow__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirming(true)}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {editing && <TaskEditor task={task} onClose={() => setEditing(false)} />}
    </li>
  );
};
