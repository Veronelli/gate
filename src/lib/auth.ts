import {
  COLLECTIONS,
  SESSION_KEY,
  ensureSchema,
  getJSON,
  readCollection,
  removeKey,
  setJSON,
  updateCollection,
} from "./storage";
import type { Session, User } from "./types";

export type AuthResult = { ok: true; user: User } | { ok: false; error: string };

export interface LocalAccount {
  id: string;
  username: string;
}

const normalize = (username: string) => username.trim().toLowerCase();

function fail(error: string): AuthResult {
  return { ok: false, error };
}

function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function listLocalAccounts(): LocalAccount[] {
  return readCollection<User>(COLLECTIONS.users).map(({ id, username }) => ({
    id,
    username,
  }));
}

export async function register(
  username: string,
  password: string,
  repeatPassword: string,
): Promise<AuthResult> {
  ensureSchema();
  const name = username.trim();
  if (!name || !password) return fail("Completá usuario y contraseña.");
  if (password !== repeatPassword) return fail("Las contraseñas no coinciden.");
  const users = readCollection<User>(COLLECTIONS.users);
  if (users.some((u) => normalize(u.username) === normalize(name))) {
    return fail("El usuario ya existe.");
  }
  const salt = randomHex(16);
  const user: User = {
    id: crypto.randomUUID(),
    username: name,
    passwordHash: await hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };
  updateCollection<User>(COLLECTIONS.users, (items) => [...items, user]);
  return { ok: true, user };
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResult> {
  const user = readCollection<User>(COLLECTIONS.users).find(
    (u) => normalize(u.username) === normalize(username),
  );
  const invalid = fail("Usuario o contraseña incorrectos.");
  if (!user) return invalid;
  if ((await hashPassword(password, user.salt)) !== user.passwordHash) {
    return invalid;
  }
  const session: Session = {
    userId: user.id,
    placeId: null,
    startedAt: new Date().toISOString(),
  };
  setJSON(SESSION_KEY, session);
  return { ok: true, user };
}

/** Cambiar de cuenta exige la contraseña del usuario seleccionado. */
export const switchAccount = login;

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
  removeKey(SESSION_KEY);
}
