import { ViewMode } from '../models/types';

/**
 * Thin wrapper around the native window commands defined in src-tauri/src/main.rs.
 *
 * Every call is a no-op in a plain browser (`npm run dev` without Tauri) so the
 * UI can be developed and inspected without the native shell.
 */

export const isTauri = () =>
  typeof window !== 'undefined' &&
  ('__TAURI_IPC__' in window || '__TAURI__' in window);

/** Widget geometry. Width is fixed; height is driven by measured content. */
export const LOGO_SIZE = 48;
export const WIDGET_WIDTH = 300;
export const WIDGET_MIN_HEIGHT = 150;
export const WIDGET_MAX_HEIGHT = 420;

async function call(cmd: string, args?: Record<string, unknown>): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/tauri');
    await invoke(cmd, args);
  } catch (err) {
    console.error(`window command "${cmd}" failed`, err);
  }
}

export const windowService = {
  isTauri,

  /** Switch to the tiny logo (collapsed) mode — 48×48 frameless square. */
  async applyLogoMode(alwaysOnTop: boolean): Promise<void> {
    await call('enter_logo_mode', { alwaysOnTop });
  },

  /** Switch the OS window between the small frameless widget and the full app. */
  async applyViewMode(mode: ViewMode, alwaysOnTop: boolean): Promise<void> {
    if (mode === 'widget') {
      await call('enter_widget_mode', { alwaysOnTop });
    } else {
      await call('enter_app_mode');
    }
  },

  /**
   * Resize the widget window to exactly fit its content, so it never shows
   * empty space and never grows beyond a glanceable size.
   */
  async fitWidgetHeight(contentHeight: number): Promise<void> {
    const height = Math.round(
      Math.min(WIDGET_MAX_HEIGHT, Math.max(WIDGET_MIN_HEIGHT, contentHeight))
    );
    await call('resize_widget', { height });
  },

  async setAlwaysOnTop(value: boolean): Promise<void> {
    await call('set_always_on_top', { value });
  },

  async setAutostart(value: boolean): Promise<void> {
    await call('set_autostart', { enable: value });
  },

  /** Drag the frameless widget by its header. */
  async startDragging(): Promise<void> {
    if (!isTauri()) return;
    try {
      const { appWindow } = await import('@tauri-apps/api/window');
      await appWindow.startDragging();
    } catch (err) {
      console.error('startDragging failed', err);
    }
  },

  async hide(): Promise<void> {
    if (!isTauri()) return;
    try {
      const { appWindow } = await import('@tauri-apps/api/window');
      await appWindow.hide();
    } catch (err) {
      console.error('hide failed', err);
    }
  },

  /** Listen for when the window loses native OS focus. */
  async onBlur(handler: () => void): Promise<() => void> {
    if (!isTauri()) return () => {};
    try {
      const { appWindow } = await import('@tauri-apps/api/window');
      return await appWindow.onFocusChanged(({ payload: focused }) => {
        if (!focused) handler();
      });
    } catch (err) {
      console.error('onBlur failed', err);
      return () => {};
    }
  },

  /** Listen for tray / global-shortcut events emitted by the Rust side. */
  async listen(event: string, handler: () => void): Promise<() => void> {
    if (!isTauri()) return () => {};
    try {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen(event, handler);
    } catch (err) {
      console.error(`listen("${event}") failed`, err);
      return () => {};
    }
  },
};
