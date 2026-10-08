import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LongTermGoal } from '../models/types';
import { progressService } from '../services/progressService';
import { Check, ConfirmRow, Meter, Modal, fromInputValue, toDateInputValue } from './primitives';

const GoalEditor = ({ goal, onClose }: { goal: LongTermGoal; onClose: () => void }) => {
  const { patchGoal } = useApp();
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? '');
  const [targetDate, setTargetDate] = useState(toDateInputValue(goal.targetDate));

  return (
    <Modal title="Edit goal" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = title.trim();
          if (!clean) return;
          patchGoal(goal.id, {
            title: clean,
            description: description.trim() || undefined,
            targetDate: fromInputValue(targetDate),
          });
          onClose();
        }}
      >
        <label className="field">
          <span className="field__label">Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="input input--area"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Target date</span>
          <input
            type="date"
            className="input"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </label>
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

const GoalCard = ({ goal }: { goal: LongTermGoal }) => {
  const { state, addMilestone, toggleMilestone, deleteMilestone, deleteGoal } = useApp();
  const [newMilestone, setNewMilestone] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const progress = progressService.goalProgress(goal, state.dailyTasks);
  const breakdown = progressService.goalBreakdown(goal, state.dailyTasks);
  const linkedTasks = state.dailyTasks.filter((t) => t.parentLongTermGoalId === goal.id);

  return (
    <article className="goal">
      <header className="goal__head">
        <h2 className="goal__title">{goal.title}</h2>
        <span className="goal__pct">{progress}%</span>
      </header>

      <Meter value={progress} large />

      <p className="goal__breakdown">
        {breakdown.milestonesTotal > 0 &&
          `${breakdown.milestonesDone}/${breakdown.milestonesTotal} milestones`}
        {breakdown.milestonesTotal > 0 && breakdown.tasksTotal > 0 && ' · '}
        {breakdown.tasksTotal > 0 && `${breakdown.tasksDone}/${breakdown.tasksTotal} tasks`}
        {breakdown.milestonesTotal === 0 &&
          breakdown.tasksTotal === 0 &&
          'Add milestones or link tasks to track progress'}
      </p>

      {goal.description && <p className="goal__desc">{goal.description}</p>}

      {goal.milestones.length > 0 && (
        <ul className="sublist">
          {goal.milestones.map((m) => (
            <li key={m.id} className="subrow" data-done={m.status === 'completed' || undefined}>
              <Check
                checked={m.status === 'completed'}
                onToggle={() => toggleMilestone(goal.id, m.id)}
                label={`Toggle ${m.title}`}
              />
              <span className="subrow__title">{m.title}</span>
              <button
                type="button"
                className="iconbtn iconbtn--sm"
                onClick={() => deleteMilestone(goal.id, m.id)}
                aria-label={`Delete ${m.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {linkedTasks.length > 0 && (
        <ul className="goal__tasks">
          {linkedTasks.map((t) => (
            <li key={t.id} className="goal__task" data-done={t.status === 'completed' || undefined}>
              <span className="goal__task-title">{t.title}</span>
              <span className="goal__task-pct">{progressService.taskProgress(t)}%</span>
            </li>
          ))}
        </ul>
      )}

      <form
        className="subadd"
        onSubmit={(e) => {
          e.preventDefault();
          addMilestone(goal.id, newMilestone);
          setNewMilestone('');
        }}
      >
        <input
          className="input input--sm"
          placeholder="Add milestone"
          value={newMilestone}
          onChange={(e) => setNewMilestone(e.target.value)}
        />
        <button type="submit" className="btn btn--ghost btn--sm" disabled={!newMilestone.trim()}>
          Add
        </button>
      </form>

      <footer className="goal__foot">
        {goal.targetDate && (
          <span className="goal__target">
            Target{' '}
            {new Date(goal.targetDate).toLocaleDateString(undefined, {
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
        {confirming ? (
          <ConfirmRow
            message="Delete this goal? Linked tasks are kept."
            confirmLabel="Delete"
            onConfirm={() => deleteGoal(goal.id)}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="goal__actions">
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
      </footer>

      {editing && <GoalEditor goal={goal} onClose={() => setEditing(false)} />}
    </article>
  );
};

export const LongTermPage = ({ onAdd }: { onAdd: () => void }) => {
  const { state } = useApp();
  const goals = state.longTermGoals.filter((g) => g.status === 'active');

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Long-term</h1>
          <p className="page__sub">Direction, not today's work</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          New goal
        </button>
      </header>

      {goals.length > 0 ? (
        <div className="goals">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      ) : (
        <div className="blank">
          <p className="blank__title">No long-term goals</p>
          <p className="blank__sub">
            Goals give your daily work a direction. Progress is calculated from the tasks and
            milestones you attach.
          </p>
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            New goal
          </button>
        </div>
      )}
    </div>
  );
};
