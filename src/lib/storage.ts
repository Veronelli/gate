export const SCHEMA_VERSION = 1;

const PREFIX = "f2c:";
const ROOT_KEY = `${PREFIX}root`;

export const COLLECTIONS = {
  users: "users",
  places: "places",
  memberships: "memberships",
  lists: "lists",
  items: "items",
  products: "products",
  invites: "invites",
  tags: "tags",
} as const;

export const SESSION_KEY = `${PREFIX}session`;

interface RootDocument {
  schemaVersion: number;
}

function getStore(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function storageKey(name: string): string {
  return `${PREFIX}${name}`;
}

export function getJSON<T>(key: string, fallback: T): T {
  const store = getStore();
  if (!store) return fallback;
  const raw = store.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  getStore()?.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  getStore()?.removeItem(key);
}

export function ensureSchema(): void {
  const store = getStore();
  if (!store || store.getItem(ROOT_KEY) !== null) return;
  const root: RootDocument = { schemaVersion: SCHEMA_VERSION };
  store.setItem(ROOT_KEY, JSON.stringify(root));
}

export function getSchemaVersion(): number | null {
  return getJSON<RootDocument | null>(ROOT_KEY, null)?.schemaVersion ?? null;
}

export function readCollection<T>(name: string): T[] {
  return getJSON<T[]>(storageKey(name), []);
}

/** Hook invocado tras cada escritura de colección (sync lo usa para pushear). */
let onWrite: (() => void) | null = null;
export function onCollectionsWritten(fn: () => void): void {
  onWrite = fn;
}

export function writeCollection<T>(name: string, items: T[]): void {
  setJSON(storageKey(name), items);
  onWrite?.();
}

export function updateCollection<T>(
  name: string,
  updater: (items: T[]) => T[],
): T[] {
  const next = updater(readCollection<T>(name));
  writeCollection(name, next);
  return next;
}
