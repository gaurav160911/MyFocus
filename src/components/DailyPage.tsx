import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FocusCard } from './FocusCard';
import { TaskRow } from './TaskRow';
import { ConfirmRow } from './primitives';

/**
 * Daily has exactly two sections: Focus (one task) and Other tasks.
 * Completed work is kept below, collapsed, as history — never deleted silently.
 */
export const DailyPage = ({ onAdd }: { onAdd: () => void }) => {
  const { focusTask, otherTasks, completedTasks, toggleTask, deleteTask, clearCompleted } =
    useApp();
  const [showCompleted, setShowCompleted] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Daily</h1>
          <p className="page__sub">
            {focusTask
              ? `${otherTasks.length + 1} pending`
              : completedTasks.length > 0
                ? 'Everything done'
                : 'Nothing scheduled'}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          New task
        </button>
      </header>

      {focusTask ? (
        <>
          <FocusCard task={focusTask} />

          <section className="section">
            <header className="section__head">
              <h2 className="section__title">Other tasks</h2>
              <span className="section__count">{otherTasks.length}</span>
            </header>
            {otherTasks.length > 0 ? (
              <ul className="tlist">
                {otherTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            ) : (
              <p className="section__empty">Nothing else pending.</p>
            )}
          </section>
        </>
      ) : (
        <div className="blank">
          <p className="blank__title">All caught up</p>
          <p className="blank__sub">
            {completedTasks.length > 0
              ? `${completedTasks.length} completed`
              : 'Add a task to get started'}
          </p>
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            New task
          </button>
        </div>
      )}

      {completedTasks.length > 0 && (
        <section className="section">
          <header className="section__head">
            <button
              type="button"
              className="section__toggle"
              onClick={() => setShowCompleted((v) => !v)}
              aria-expanded={showCompleted}
            >
              <span className="section__title">Completed</span>
              <span className="section__count">{completedTasks.length}</span>
            </button>
            {showCompleted && !confirmClear && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmClear(true)}
              >
                Clear
              </button>
            )}
          </header>

          {confirmClear && (
            <ConfirmRow
              message={`Remove ${completedTasks.length} completed tasks?`}
              confirmLabel="Clear"
              onConfirm={() => {
                clearCompleted();
                setConfirmClear(false);
              }}
              onCancel={() => setConfirmClear(false)}
            />
          )}

          {showCompleted && (
            <ul className="donelist">
              {completedTasks.map((task) => (
                <li key={task.id} className="donerow">
                  <button
                    type="button"
                    className="check"
                    data-checked
                    onClick={() => toggleTask(task.id)}
                    aria-label={`Reopen ${task.title}`}
                  />
                  <span className="donerow__title">{task.title}</span>
                  {task.completedAt && (
                    <span className="donerow__when">
                      {new Date(task.completedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  <button
                    type="button"
                    className="iconbtn iconbtn--sm"
                    onClick={() => deleteTask(task.id)}
                    aria-label={`Delete ${task.title}`}
                    title="Delete"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
