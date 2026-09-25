import {
  COLLECTIONS,
  SESSION_KEY,
  getJSON,
  readCollection,
  removeKey,
  setJSON,
  updateCollection,
} from "./storage";
import { hydrateFromServer } from "./sync";
import type { Session, User } from "./types";

export type AuthResult =
  | { ok: true; user: Pick<User, "id" | "username"> }
  | { ok: false; error: string };

export interface LocalAccount {
  id: string;
  username: string;
}

function fail(error: string): AuthResult {
  return { ok: false, error };
}

export function listLocalAccounts(): LocalAccount[] {
  return readCollection<User>(COLLECTIONS.users).map(({ id, username }) => ({
    id,
    username,
  }));
}

interface AuthResponse {
  token?: string;
  user?: { id: string; username: string };
  error?: string;
}

function startSession(token: string, user: { id: string; username: string }) {
  const session: Session = {
    userId: user.id,
    token,
    placeId: null,
    startedAt: new Date().toISOString(),
  };
  setJSON(SESSION_KEY, session);
  // Registro display-only (sin secretos) para mostrar miembros/invitados.
  updateCollection<User>(COLLECTIONS.users, (items) =>
    items.some((u) => u.id === user.id)
      ? items
      : [
          ...items,
          { id: user.id, username: user.username, createdAt: session.startedAt },
        ],
  );
}

async function callAuth(
  path: string,
  body: Record<string, string>,
): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return fail("No se pudo conectar con el servidor. Intentá de nuevo.");
  }
  const data = (await res.json()) as AuthResponse;
  if (!res.ok || !data.token || !data.user) {
    return fail(data.error ?? "Ocurrió un error. Intentá de nuevo.");
  }
  startSession(data.token, data.user);
  await hydrateFromServer();
  return { ok: true, user: data.user };
}

export function register(
  username: string,
  password: string,
  repeatPassword: string,
): Promise<AuthResult> {
  const name = username.trim();
  if (!name || !password) {
    return Promise.resolve(fail("Completá usuario y contraseña."));
  }
  return callAuth("register", {
    username: name,
    password,
    repeatPassword,
  });
}

export function login(
  username: string,
  password: string,
): Promise<AuthResult> {
  return callAuth("login", { username, password });
}

export function getSession(): Session | null {
  return getJSON<Session | null>(SESSION_KEY, null);
}

export function getCurrentUser(): User | null {
  const session = getSession();
  if (!session) return null;
  return (
    readCollection<User>(COLLECTIONS.users).find(
      (u) => u.id === session.userId,
    ) ?? null
  );
}

export function setActivePlace(placeId: string | null): void {
  const session = getSession();
  if (session) setJSON(SESSION_KEY, { ...session, placeId });
}

export function logout(): void {
  const session = getSession();
  if (session?.token) {
    void fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
    }).catch(() => {});
  }
  removeKey(SESSION_KEY);
}
