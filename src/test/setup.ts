/**
 * Test setup.
 *
 * The services are plain TypeScript and run under the `node` environment, which
 * has no DOM. `persistenceService` talks to `localStorage`, so we install a
 * minimal in-memory Storage implementation here rather than pulling in jsdom
 * for one API.
 *
 * Note that Node does expose a `localStorage` global, but only as an
 * experimental stub unless started with --experimental-webstorage, and it lacks
 * methods such as clear(). We therefore always override it.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});
