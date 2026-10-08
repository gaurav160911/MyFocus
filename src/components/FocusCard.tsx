import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DailyTask } from '../models/types';
import { urgencyService } from '../services/urgencyService';
import { progressService } from '../services/progressService';
import { focusService } from '../services/focusService';
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
 * The dominant element of the Daily page: the one task the ranking chose.
 * It also states *why* it was chosen, so the ranking is never a black box.
 */
export const FocusCard = ({ task }: { task: DailyTask }) => {
  const { now, toggleTask, toggleSubtask, addSubtask, rescheduleTask, deleteTask } = useApp();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');

  const urgency = urgencyService.effectiveUrgency(task, now);
  const { completed, total } = progressService.subtaskCount(task);
  const progress = progressService.taskProgress(task);

  return (
    <article className="focus" data-urgency={urgency}>
      <header className="focus__head">
        <span className="focus__eyebrow">
          <span className="urgency-dot" aria-hidden="true" />
          Focus now
        </span>
        <span className="focus__reason">{focusService.explain(task, now)}</span>
      </header>

      <h2 className="focus__title">{task.title}</h2>

      <div className="focus__meta">
        {task.deadline ? (
          <DueChip
            text={urgencyService.formatDeadlineSentence(task.deadline, now)}
            urgency={urgency}
          />
        ) : (
          <span className="due" data-urgency="normal">
            No deadline
          </span>
        )}
        <PriorityTag priority={task.priority} />
      </div>

      {task.description && <p className="focus__notes">{task.description}</p>}

      {total > 0 && (
        <div className="focus__progress">
          <Meter value={progress} large />
          <span className="focus__progress-text">
            {completed} of {total} subtasks · {progress}%
          </span>
        </div>
      )}

      {total > 0 && (
        <ul className="sublist sublist--focus">
          {task.subtasks.map((sub) => (
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
                  urgency={urgencyService.calculateUrgency(sub, now)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

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
          placeholder="Break this down"
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
        />
        <button type="submit" className="btn btn--ghost btn--sm" disabled={!newSubtask.trim()}>
          Add
        </button>
      </form>

      {urgency === 'overdue' && (
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
        <footer className="focus__foot">
          <button type="button" className="btn btn--primary" onClick={() => toggleTask(task.id)}>
            Complete
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn--ghost focus__foot-end"
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
        </footer>
      )}

      {editing && <TaskEditor task={task} onClose={() => setEditing(false)} />}
    </article>
  );
};
