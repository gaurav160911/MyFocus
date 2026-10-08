import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Priority } from '../models/types';
import { Modal, fromInputValue } from './primitives';

type Kind = 'task' | 'goal';

/**
 * The single Add surface. There is one add button in the app; this modal picks
 * between the two things that can be created.
 *
 * Adding a task is fast by design: type a title, press Enter, done. Deadline,
 * priority, goal link and subtasks are all behind "More options" so the common
 * case is never a form.
 */
export const AddItemModal = ({
  initialKind = 'task',
  onClose,
}: {
  initialKind?: Kind;
  onClose: () => void;
}) => {
  const { state, addTask, addGoal } = useApp();

  const [kind, setKind] = useState<Kind>(initialKind);
  const [more, setMore] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [goalId, setGoalId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [childInput, setChildInput] = useState('');
  const [children, setChildren] = useState<string[]>([]);

  const activeGoals = state.longTermGoals.filter((g) => g.status === 'active');
  const childLabel = kind === 'task' ? 'subtask' : 'milestone';

  const addChild = () => {
    const clean = childInput.trim();
    if (!clean) return;
    setChildren((list) => [...list, clean]);
    setChildInput('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;

    if (kind === 'task') {
      addTask({
        title: clean,
        description: description.trim() || undefined,
        deadline: fromInputValue(deadline),
        priority,
        parentLongTermGoalId: goalId || undefined,
        subtaskTitles: children,
      });
    } else {
      addGoal({
        title: clean,
        description: description.trim() || undefined,
        targetDate: fromInputValue(targetDate),
        milestoneTitles: children,
      });
    }
    onClose();
  };

  return (
    <Modal title="Add" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'task'}
            className="segmented__opt"
            data-active={kind === 'task' || undefined}
            onClick={() => setKind('task')}
          >
            Daily task
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'goal'}
            className="segmented__opt"
            data-active={kind === 'goal' || undefined}
            onClick={() => setKind('goal')}
          >
            Long-term goal
          </button>
        </div>

        <input
          className="input input--lead"
          placeholder={kind === 'task' ? 'What needs doing?' : 'What are you working towards?'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />

        {!more && (
          <button type="button" className="linkbtn" onClick={() => setMore(true)}>
            More options
          </button>
        )}

        {more && (
          <>
            <label className="field">
              <span className="field__label">
                {kind === 'task' ? 'Notes' : 'Description'}
              </span>
              <textarea
                className="input input--area"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {kind === 'task' ? (
              <>
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
                    <select
                      className="input"
                      value={goalId}
                      onChange={(e) => setGoalId(e.target.value)}
                    >
                      <option value="">None</option>
                      {activeGoals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            ) : (
              <label className="field">
                <span className="field__label">Target date</span>
                <input
                  type="date"
                  className="input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </label>
            )}

            <div className="field">
              <span className="field__label">
                {kind === 'task' ? 'Subtasks' : 'Milestones'}
              </span>
              {children.length > 0 && (
                <ul className="chiplist">
                  {children.map((child, i) => (
                    <li key={`${child}-${i}`} className="chip">
                      {child}
                      <button
                        type="button"
                        className="iconbtn iconbtn--sm"
                        onClick={() => setChildren((l) => l.filter((_, j) => j !== i))}
                        aria-label={`Remove ${child}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="subadd">
                <input
                  className="input input--sm"
                  placeholder={`Add ${childLabel}`}
                  value={childInput}
                  onChange={(e) => setChildInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChild();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={addChild}
                  disabled={!childInput.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </>
        )}

        <footer className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
            Create
          </button>
        </footer>
      </form>
    </Modal>
  );
};
