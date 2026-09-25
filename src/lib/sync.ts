import {
  COLLECTIONS,
  SCHEMA_VERSION,
  SESSION_KEY,
  getJSON,
  onCollectionsWritten,
  readCollection,
  removeKey,
  writeCollection,
} from "./storage";
import type { Session, User } from "./types";

const PUSH_DEBOUNCE_MS = 400;
let hydrating = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

/** Usuarios tal como se persisten: sin hash ni salt (display-only). */
function sanitizeUsers(users: User[]): Partial<User>[] {
  return users.map(({ id, username, createdAt }) => ({
    id,
    username,
    createdAt,
  }));
}

function buildDoc() {
  return {
    schemaVersion: SCHEMA_VERSION,
    users: sanitizeUsers(readCollection<User>(COLLECTIONS.users)),
    places: readCollection(COLLECTIONS.places),
    memberships: readCollection(COLLECTIONS.memberships),
    lists: readCollection(COLLECTIONS.lists),
    items: readCollection(COLLECTIONS.items),
    products: readCollection(COLLECTIONS.products),
    invites: readCollection(COLLECTIONS.invites),
  };
}

function handleUnauthorized(): void {
  removeKey(SESSION_KEY);
  if (typeof window !== "undefined") window.location.reload();
}

async function pushNow(): Promise<void> {
  const session = getJSON<Session | null>(SESSION_KEY, null);
  if (!session?.token) return;
  try {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ doc: buildDoc() }),
    });
    if (res.status === 401) handleUnauthorized();
  } catch {
    // Sin conexión: los datos quedan locales y se reintentan en la próxima escritura.
  }
}

/** Encola un push del documento completo al servidor (debounced). */
export function schedulePush(): void {
  if (hydrating) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), PUSH_DEBOUNCE_MS);
}

onCollectionsWritten(schedulePush);

/** Trae el documento del servidor y reemplaza las colecciones locales. */
export async function hydrateFromServer(): Promise<void> {
  const session = getJSON<Session | null>(SESSION_KEY, null);
  if (!session?.token) return;
  let doc: Record<string, unknown> | null = null;
  try {
    const res = await fetch("/api/state", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) return;
    doc = ((await res.json()) as { doc: Record<string, unknown> | null }).doc;
  } catch {
    return;
  }
  if (!doc) return;
  hydrating = true;
  try {
    for (const name of Object.values(COLLECTIONS)) {
      const value = doc[name];
      if (Array.isArray(value)) writeCollection(name, value);
    }
  } finally {
    hydrating = false;
  }
}
