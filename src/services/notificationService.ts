import { AppSettings, DailyTask, UrgencyLevel } from '../models/types';
import { urgencyService } from './urgencyService';

/**
 * Deadline notifications.
 *
 * Rules, deliberately conservative so the app never becomes noisy:
 *   - At most one notification per task per urgency level, ever.
 *   - Only three levels notify: critical, imminent, overdue.
 *   - The "critical" notification is gated on the user's warning-lead setting.
 *   - Completing a task stops all further notifications for it.
 *   - Nothing repeats, nothing loops, no sound unless enabled.
 */

const NOTIFIABLE: UrgencyLevel[] = ['critical', 'imminent', 'overdue'];

export type NotificationIntent = {
  key: string;
  title: string;
  body: string;
};

const isTauri = () =>
  typeof window !== 'undefined' && ('__TAURI_IPC__' in window || '__TAURI__' in window);

async function deliver(intent: NotificationIntent, sound: boolean): Promise<void> {
  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = await import(
        '@tauri-apps/api/notification'
      );
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === 'granted';
      if (!granted) return;
      sendNotification({ title: intent.title, body: intent.body, sound: sound ? 'default' : undefined });
      return;
    } catch (err) {
      console.error('notification failed', err);
      return;
    }
  }

  // Browser fallback, used while developing without the native shell.
  if (typeof Notification === 'undefined') return;
  try {
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;
    new Notification(intent.title, { body: intent.body });
  } catch {
    /* ignore */
  }
}

export const notificationService = {
  /**
   * Pure function: given the current tasks and what has already been sent,
   * decide what should fire now. Testable without touching the OS.
   */
  pending(
    tasks: DailyTask[],
    alreadySent: string[],
    settings: AppSettings,
    now: number = Date.now()
  ): NotificationIntent[] {
    if (!settings.notificationsEnabled) return [];

    const sent = new Set(alreadySent);
    const intents: NotificationIntent[] = [];

    for (const task of tasks) {
      if (task.status === 'completed' || !task.deadline) continue;

      const level = urgencyService.calculateUrgency(task, now);
      if (!NOTIFIABLE.includes(level)) continue;

      // Respect the configured lead time for the first (critical) warning.
      if (level === 'critical') {
        const hoursLeft = (task.deadline - now) / 3_600_000;
        if (hoursLeft > settings.deadlineWarningHours) continue;
      }

      const key = `${task.id}:${level}`;
      if (sent.has(key)) continue;

      intents.push({
        key,
        title:
          level === 'overdue'
            ? 'Task overdue'
            : level === 'imminent'
              ? 'Due within the hour'
              : 'Deadline approaching',
        body: `${task.title} — ${urgencyService.formatDeadlineSentence(task.deadline, now)}`,
      });
    }

    return intents;
  },

  async send(intents: NotificationIntent[], sound: boolean): Promise<void> {
    for (const intent of intents) {
      await deliver(intent, sound);
    }
  },

  /** Forget keys for tasks that no longer exist, so the list cannot grow forever. */
  prune(keys: string[], tasks: DailyTask[]): string[] {
    const live = new Set(tasks.filter((t) => t.status === 'pending').map((t) => t.id));
    return keys.filter((k) => live.has(k.split(':')[0]));
  },
};
