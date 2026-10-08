import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { NavSection } from '../models/types';
import { windowService } from '../services/windowService';
import { DailyPage } from './DailyPage';
import { LongTermPage } from './LongTermPage';
import { SettingsPage } from './SettingsPage';
import { AddItemModal } from './AddItemModal';

/**
 * The full application: a narrow icon rail plus one page at a time.
 *
 * Only three destinations exist — Daily, Long-term, Settings. Progress,
 * notifications and focus are not pages; they live inside the things they
 * describe.
 */

const NAV: { id: NavSection; label: string; glyph: string }[] = [
  { id: 'daily', label: 'Daily', glyph: '◧' },
  { id: 'longterm', label: 'Long-term', glyph: '◆' },
];

export const Shell = () => {
  const { setViewMode } = useApp();
  const [section, setSection] = useState<NavSection>('daily');
  const [railOpen, setRailOpen] = useState(true);
  const [adding, setAdding] = useState<null | 'task' | 'goal'>(null);

  // Ctrl+N opens the add sheet; Escape returns to the widget.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setAdding(section === 'longterm' ? 'goal' : 'task');
        return;
      }
      if (e.key === 'Escape' && !adding) {
        setViewMode('widget');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [section, adding, setViewMode]);

  // Tray menu items.
  useEffect(() => {
    let dispose: Array<() => void> = [];
    void (async () => {
      dispose = [
        await windowService.listen('tray://add-task', () => setAdding('task')),
        await windowService.listen('tray://settings', () => setSection('settings')),
      ];
    })();
    return () => dispose.forEach((fn) => fn());
  }, []);

  return (
    <div className="shell" data-rail={railOpen ? 'open' : 'closed'}>
      <nav className="rail" aria-label="Sections">
        <div className="rail__top">
          <button
            type="button"
            className="iconbtn"
            onClick={() => setRailOpen((v) => !v)}
            aria-label={railOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={railOpen}
          >
            ☰
          </button>
          {railOpen && <span className="rail__brand">My Focus</span>}
        </div>

        <ul className="rail__list">
          {NAV.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="rail__item"
                data-active={section === item.id || undefined}
                onClick={() => setSection(item.id)}
                title={item.label}
                aria-current={section === item.id ? 'page' : undefined}
              >
                <span className="rail__glyph" aria-hidden="true">
                  {item.glyph}
                </span>
                {railOpen && <span className="rail__label">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div className="rail__bottom">
          <button
            type="button"
            className="rail__item"
            onClick={() => setAdding(section === 'longterm' ? 'goal' : 'task')}
            title="Add (Ctrl+N)"
          >
            <span className="rail__glyph" aria-hidden="true">
              +
            </span>
            {railOpen && <span className="rail__label">Add</span>}
          </button>

          <button
            type="button"
            className="rail__item"
            data-active={section === 'settings' || undefined}
            onClick={() => setSection('settings')}
            title="Settings"
          >
            <span className="rail__glyph" aria-hidden="true">
              ⚙
            </span>
            {railOpen && <span className="rail__label">Settings</span>}
          </button>

          <button
            type="button"
            className="rail__item"
            onClick={() => setViewMode('widget')}
            title="Back to widget (Esc)"
          >
            <span className="rail__glyph" aria-hidden="true">
              ↙
            </span>
            {railOpen && <span className="rail__label">Widget</span>}
          </button>
        </div>
      </nav>

      <main className="main">
        {section === 'daily' && <DailyPage onAdd={() => setAdding('task')} />}
        {section === 'longterm' && <LongTermPage onAdd={() => setAdding('goal')} />}
        {section === 'settings' && <SettingsPage />}
      </main>

      {adding && <AddItemModal initialKind={adding} onClose={() => setAdding(null)} />}
    </div>
  );
};
