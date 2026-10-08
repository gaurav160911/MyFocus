import { ReactNode, useEffect, useRef } from 'react';
import { Priority, UrgencyLevel } from '../models/types';
import { PRIORITY_LABELS } from '../models/types';

/** Progress meter. Width is the only thing that changes; no animation on mount. */
export const Meter = ({ value, large }: { value: number; large?: boolean }) => (
  <div
    className={large ? 'meter meter--lg' : 'meter'}
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <span className="meter__fill" style={{ width: `${value}%` }} />
  </div>
);

/** Square checkbox used for tasks, subtasks and milestones. */
export const Check = ({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) => (
  <button
    type="button"
    className="check"
    data-checked={checked || undefined}
    onClick={onToggle}
    aria-pressed={checked}
    aria-label={label}
  />
);

/** Deadline chip. Colour comes from the urgency attribute, not inline styles. */
export const DueChip = ({
  text,
  urgency,
}: {
  text: string;
  urgency: UrgencyLevel;
}) => (
  <span className="due" data-urgency={urgency}>
    {text}
  </span>
);

/** Priority is shown as a quiet text label — it is not urgency and shouldn't shout. */
export const PriorityTag = ({ priority }: { priority: Priority }) =>
  priority === 'normal' ? null : (
    <span className="ptag" data-priority={priority}>
      {PRIORITY_LABELS[priority]}
    </span>
  );

/** Centred modal. Closes on Escape and on backdrop click. */
export const Modal = ({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
  }, []);

  return (
    <div className="scrim" onMouseDown={onClose}>
      <div
        className={wide ? 'sheet sheet--wide' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        ref={ref}
      >
        <header className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
};

/** Inline confirm used before destructive actions. */
export const ConfirmRow = ({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div className="confirm">
    <span className="confirm__msg">{message}</span>
    <button type="button" className="btn btn--danger btn--sm" onClick={onConfirm}>
      {confirmLabel}
    </button>
    <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
      Cancel
    </button>
  </div>
);

/** Converts a timestamp to the value a datetime-local input expects. */
export function toInputValue(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function toDateInputValue(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromInputValue(value: string): number | undefined {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : undefined;
}

/** Quick reschedule offsets offered on overdue tasks. */
export const RESCHEDULE_PRESETS: { label: string; ms: number }[] = [
  { label: '+1h', ms: 60 * 60 * 1000 },
  { label: '+3h', ms: 3 * 60 * 60 * 1000 },
  { label: 'Tonight', ms: -1 },
  { label: 'Tomorrow', ms: -2 },
];

export function resolvePreset(ms: number, now: number): number {
  if (ms > 0) return now + ms;
  const d = new Date(now);
  if (ms === -1) {
    d.setHours(21, 0, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}
