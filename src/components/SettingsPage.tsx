import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppSettings } from '../models/types';
import { windowService } from '../services/windowService';

/**
 * Settings is a flat list of rows, not a dashboard. Each row is one setting with
 * a label, an optional one-line explanation, and a control on the right.
 *
 * Only settings that actually do something are listed. Nothing here is a stub.
 */

const Row = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="srow">
    <div className="srow__text">
      <span className="srow__label">{label}</span>
      {hint && <span className="srow__hint">{hint}</span>}
    </div>
    <div className="srow__control">{children}</div>
  </div>
);

const Toggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) => (
  <button
    type="button"
    className="switch"
    data-on={checked || undefined}
    onClick={() => onChange(!checked)}
    role="switch"
    aria-checked={checked}
    aria-label={label}
  >
    <span className="switch__knob" />
  </button>
);

export const SettingsPage = () => {
  const { state, patchSettings, exportData, importData } = useApp();
  const s = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    patchSettings({ [key]: value } as Partial<AppSettings>);

  const handleExport = () => {
    try {
      const blob = new Blob([exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-focus-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ kind: 'ok', text: 'Backup saved to your downloads folder.' });
    } catch {
      setMessage({ kind: 'err', text: 'Could not create the backup file.' });
    }
  };

  const handleImport = async (file: File) => {
    try {
      importData(await file.text());
      setMessage({ kind: 'ok', text: 'Data imported.' });
    } catch (err) {
      setMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : 'That file could not be read.',
      });
    }
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="page__sub">
            {windowService.isTauri() ? 'Desktop' : 'Browser preview — desktop options inactive'}
          </p>
        </div>
      </header>

      <section className="sgroup">
        <h2 className="sgroup__title">Appearance</h2>
        <Row label="Theme" hint="System follows your Windows setting">
          <select
            className="input input--sm"
            value={s.theme}
            onChange={(e) => set('theme', e.target.value as AppSettings['theme'])}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>
      </section>

      <section className="sgroup">
        <h2 className="sgroup__title">Widget</h2>
        <Row label="Always on top" hint="Keep the widget above other windows">
          <Toggle
            checked={s.alwaysOnTop}
            onChange={(v) => set('alwaysOnTop', v)}
            label="Always on top"
          />
        </Row>
        <Row label="Opacity" hint={`${Math.round(s.widgetOpacity * 100)}%`}>
          <input
            type="range"
            className="range"
            min={0.5}
            max={1}
            step={0.05}
            value={s.widgetOpacity}
            onChange={(e) => set('widgetOpacity', Number(e.target.value))}
            aria-label="Widget opacity"
          />
        </Row>
        <Row label="Start with Windows" hint="Launch to the tray on sign-in">
          <Toggle
            checked={s.startWithWindows}
            onChange={(v) => set('startWithWindows', v)}
            label="Start with Windows"
          />
        </Row>
      </section>

      <section className="sgroup">
        <h2 className="sgroup__title">Shortcuts</h2>
        <Row label="Show or hide the widget">
          <kbd className="kbd">Ctrl + Space</kbd>
        </Row>
        <Row label="New task">
          <kbd className="kbd">Ctrl + N</kbd>
        </Row>
      </section>

      <section className="sgroup">
        <h2 className="sgroup__title">Notifications</h2>
        <Row
          label="Deadline notifications"
          hint="At most one per task per stage — critical, final hour, overdue"
        >
          <Toggle
            checked={s.notificationsEnabled}
            onChange={(v) => set('notificationsEnabled', v)}
            label="Deadline notifications"
          />
        </Row>
        <Row label="First warning" hint="Hours before the deadline">
          <input
            type="number"
            className="input input--sm input--num"
            min={1}
            max={48}
            value={s.deadlineWarningHours}
            onChange={(e) =>
              set(
                'deadlineWarningHours',
                Math.min(48, Math.max(1, Math.round(Number(e.target.value) || 6)))
              )
            }
            disabled={!s.notificationsEnabled}
            aria-label="First warning, hours before deadline"
          />
        </Row>
        <Row label="Sound">
          <Toggle
            checked={s.notificationSound}
            onChange={(v) => set('notificationSound', v)}
            label="Notification sound"
          />
        </Row>
      </section>

      <section className="sgroup">
        <h2 className="sgroup__title">Data</h2>
        <Row label="Backup" hint="Export everything as a JSON file">
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleExport}>
            Export
          </button>
        </Row>
        <Row label="Restore" hint="Replaces current tasks and goals">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
        </Row>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
        />
        {message && (
          <p className="snote" data-kind={message.kind}>
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
};
