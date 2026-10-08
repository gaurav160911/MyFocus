import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { urgencyService } from '../services/urgencyService';
import { progressService } from '../services/progressService';
import { windowService } from '../services/windowService';

/**
 * The floating widget.
 *
 * Has two states:
 * 1. COLLAPSED — a tiny circular logo. Click to expand.
 * 2. EXPANDED — the full compact widget showing focus task + other tasks.
 *    Click-outside collapses it back to the logo.
 *
 * The widget measures its own rendered height and asks the native window to
 * match it, so it is never larger than the content it is showing.
 */
export const Widget = () => {
  const { state, now, focusTask, otherTasks, toggleTask, toggleSubtask, setViewMode, viewMode } = useApp();
  const [showOtherTasks, setShowOtherTasks] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const isCollapsed = viewMode === 'collapsed';
  const isWidgetExpanded = viewMode === 'widget';

  const urgency = focusTask ? urgencyService.effectiveUrgency(focusTask, now) : 'normal';
  const { completed, total } = focusTask
    ? progressService.subtaskCount(focusTask)
    : { completed: 0, total: 0 };
  const progress = focusTask ? progressService.taskProgress(focusTask) : 0;

  // Keep the OS window exactly as tall as the content (only when expanded).
  useLayoutEffect(() => {
    if (isCollapsed) return;
    const el = bodyRef.current;
    if (!el) return;

    const sync = () => void windowService.fitWidgetHeight(el.scrollHeight);
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isCollapsed, showOtherTasks, focusTask?.id, otherTasks.length]);

  // Collapse the "other tasks" section again when there is nothing to show.
  useEffect(() => {
    if (showOtherTasks && otherTasks.length === 0) setShowOtherTasks(false);
  }, [showOtherTasks, otherTasks.length]);

  // Click-outside-to-collapse: when expanded widget, clicking outside collapses to logo.
  useEffect(() => {
    if (!isWidgetExpanded) return;

    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await windowService.onBlur(() => {
        setViewMode('collapsed');
      });
    })();

    // Handle clicks within the webview transparent area
    const handleClickOutside = (e: PointerEvent) => {
      const el = widgetRef.current;
      if (!el) return;
      // Check if click is outside the widget
      if (!el.contains(e.target as Node)) {
        setViewMode('collapsed');
      }
    };

    // Use a short delay so the expand-click doesn't immediately collapse
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside, true);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClickOutside, true);
      if (unlisten) unlisten();
    };
  }, [isWidgetExpanded, setViewMode]);

  const upcomingCount = state.dailyTasks.filter((t) => t.status === 'pending').length;

  // ── COLLAPSED: tiny logo button ──
  if (isCollapsed) {
    return (
      <div className="widget-logo-root" data-tauri-drag-region>
        <button
          type="button"
          className="widget-logo"
          onClick={() => setViewMode('widget')}
          title="My Focus — click to open"
          aria-label="Open My Focus widget"
          data-tauri-drag-region
        >
          <img
            className="widget-logo__img"
            src="/logo.png"
            alt="My Focus Logo"
            draggable={false}
            data-tauri-drag-region
          />
        </button>
      </div>
    );
  }

  // ── EXPANDED: full widget ──
  return (
    <div className="widget" data-urgency={focusTask ? urgency : undefined} ref={widgetRef}>
      <header
        className="widget__bar"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          void windowService.startDragging();
        }}
      >
        <span className="widget__brand">My Focus</span>
        <div className="widget__bar-actions">
          {otherTasks.length > 0 && (
            <button
              type="button"
              className="iconbtn"
              onClick={() => setShowOtherTasks((v) => !v)}
              title={showOtherTasks ? 'Show less' : `Show ${otherTasks.length} more`}
              aria-label={showOtherTasks ? 'Collapse' : 'Expand'}
            >
              {showOtherTasks ? '–' : '+'}
            </button>
          )}
          <button
            type="button"
            className="iconbtn"
            onClick={() => setViewMode('collapsed')}
            title="Collapse to logo"
            aria-label="Collapse widget"
          >
            _
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setViewMode('app')}
            title="Open full app"
            aria-label="Open full app"
          >
            ↗
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => void windowService.hide()}
            title="Hide (Ctrl+Space)"
            aria-label="Hide widget"
          >
            ×
          </button>
        </div>
      </header>

      <div className="widget__body" ref={bodyRef}>
        {focusTask ? (
          <>
            <section className="wfocus">
              <div className="wfocus__label">
                <span className="urgency-dot" aria-hidden="true" />
                Focus now
              </div>

              <h1 className="wfocus__title" title={focusTask.title}>
                {focusTask.title}
              </h1>

              {focusTask.deadline ? (
                <p className="wfocus__due">
                  {urgencyService.formatDeadlineSentence(focusTask.deadline, now)}
                </p>
              ) : (
                <p className="wfocus__due wfocus__due--muted">No deadline</p>
              )}

              {total > 0 && (
                <div className="wfocus__progress">
                  <div className="meter" role="progressbar" aria-valuenow={progress}>
                    <span className="meter__fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="wfocus__count">
                    {completed}/{total}
                  </span>
                </div>
              )}

              <button type="button" className="btn btn--primary btn--block" onClick={() => toggleTask(focusTask.id)}>
                Complete
              </button>
            </section>

            {showOtherTasks && otherTasks.length > 0 && (
              <section className="wnext">
                <h2 className="wnext__label">Next up</h2>
                <ul className="wnext__list">
                  {otherTasks.slice(0, 5).map((task) => (
                    <li key={task.id} className="wrow">
                      <button
                        type="button"
                        className="check"
                        onClick={() => toggleTask(task.id)}
                        aria-label={`Complete ${task.title}`}
                      />
                      <span className="wrow__title">{task.title}</span>
                      {task.deadline && (
                        <span
                          className="wrow__due"
                          data-urgency={urgencyService.effectiveUrgency(task, now)}
                        >
                          {urgencyService.formatTimeRemaining(task.deadline, now)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!showOtherTasks && focusTask.subtasks.some((s) => s.status === 'pending') && (
              <section className="wnext">
                <ul className="wnext__list">
                  {focusTask.subtasks
                    .filter((s) => s.status === 'pending')
                    .slice(0, 2)
                    .map((sub) => (
                      <li key={sub.id} className="wrow">
                        <button
                          type="button"
                          className="check"
                          onClick={() => toggleSubtask(focusTask.id, sub.id)}
                          aria-label={`Complete ${sub.title}`}
                        />
                        <span className="wrow__title wrow__title--sub">{sub.title}</span>
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <section className="wempty">
            <p className="wempty__title">All caught up</p>
            <p className="wempty__sub">
              {upcomingCount === 0 ? 'Nothing scheduled' : `${upcomingCount} pending`}
            </p>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setViewMode('app')}>
              Open full app
            </button>
          </section>
        )}
      </div>
    </div>
  );
};
