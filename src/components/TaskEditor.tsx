import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DailyTask, Priority } from '../models/types';
import { Modal, fromInputValue, toInputValue } from './primitives';

/**
 * Edit an existing task. Separate from the add flow because adding has to be
 * fast (title + Enter) while editing is deliberate.
 */
export const TaskEditor = ({ task, onClose }: { task: DailyTask; onClose: () => void }) => {
  const { state, patchTask } = useApp();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [deadline, setDeadline] = useState(toInputValue(task.deadline));
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [goalId, setGoalId] = useState(task.parentLongTermGoalId ?? '');

  const activeGoals = state.longTermGoals.filter((g) => g.status === 'active');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    patchTask(task.id, {
      title: clean,
      description: description.trim() || undefined,
      deadline: fromInputValue(deadline),
      priority,
      parentLongTermGoalId: goalId || undefined,
    });
    onClose();
  };

  return (
    <Modal title="Edit task" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Notes</span>
          <textarea
            className="input input--area"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Deadline</span>
            <input
              type="datetime-local"
              className="input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Priority</span>
            <select
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>

        {activeGoals.length > 0 && (
          <label className="field">
            <span className="field__label">Long-term goal</span>
            <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">None</option>
              {activeGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <footer className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
            Save
          </button>
        </footer>
      </form>
    </Modal>
  );
};
