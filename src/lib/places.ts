import {
  COLLECTIONS,
  ensureSchema,
  readCollection,
  updateCollection,
} from "./storage";
import type {
  ConsumptionConfig,
  Membership,
  Place,
  PlaceRole,
  User,
} from "./types";

export type PlacesResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface PlaceWithRole {
  place: Place;
  role: PlaceRole;
}

export interface MemberWithUser {
  user: Pick<User, "id" | "username">;
  role: PlaceRole;
  isCreator: boolean;
}

export const DEFAULT_CONSUMPTION_CONFIG: ConsumptionConfig = {
  defaultRefreshDays: 30,
  reminderThresholdDays: 3,
};

const fail = <T>(error: string): PlacesResult<T> => ({ ok: false, error });
const ok = <T>(value: T): PlacesResult<T> => ({ ok: true, value });

const readPlaces = () => readCollection<Place>(COLLECTIONS.places);
const readMemberships = () =>
  readCollection<Membership>(COLLECTIONS.memberships);

export function getPlace(placeId: string): Place | null {
  return readPlaces().find((p) => p.id === placeId) ?? null;
}

export function getMembership(
  placeId: string,
  userId: string,
): Membership | null {
  return (
    readMemberships().find(
      (m) => m.placeId === placeId && m.userId === userId,
    ) ?? null
  );
}

export function getPlaceRole(placeId: string, userId: string): PlaceRole | null {
  return getMembership(placeId, userId)?.role ?? null;
}

export function isPlaceAdmin(placeId: string, userId: string): boolean {
  return getPlaceRole(placeId, userId) === "admin";
}

/** Puede crear/editar contenido del place (listas, productos). */
export function canWritePlace(placeId: string, userId: string): boolean {
  const role = getPlaceRole(placeId, userId);
  return role === "admin" || role === "write";
}

export function createPlace(
  userId: string,
  name: string,
): PlacesResult<Place> {
  ensureSchema();
  const trimmed = name.trim();
  if (!trimmed) return fail("El nombre del lugar es obligatorio.");
  const place: Place = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    consumptionConfig: { ...DEFAULT_CONSUMPTION_CONFIG },
  };
  updateCollection<Place>(COLLECTIONS.places, (items) => [...items, place]);
  const membership: Membership = { placeId: place.id, userId, role: "admin" };
  updateCollection<Membership>(COLLECTIONS.memberships, (items) => [
    ...items,
    membership,
  ]);
  return ok(place);
}

/** Places donde el usuario es miembro, con su rol en cada uno. */
export function listUserPlaces(userId: string): PlaceWithRole[] {
  const places = readPlaces();
  return readMemberships()
    .filter((m) => m.userId === userId)
    .flatMap((m) => {
      const place = places.find((p) => p.id === m.placeId);
      return place ? [{ place, role: m.role }] : [];
    });
}

export function listMembers(placeId: string): MemberWithUser[] {
  const place = getPlace(placeId);
  if (!place) return [];
  const users = readCollection<User>(COLLECTIONS.users);
  return readMemberships()
    .filter((m) => m.placeId === placeId)
    .flatMap((m) => {
      const user = users.find((u) => u.id === m.userId);
      return user
        ? [
            {
              user: { id: user.id, username: user.username },
              role: m.role,
              isCreator: user.id === place.createdBy,
            },
          ]
        : [];
    });
}

export function inviteMember(
  placeId: string,
  byUserId: string,
  targetUserId: string,
  role: Exclude<PlaceRole, "admin">,
): PlacesResult<Membership> {
  if (!getPlace(placeId)) return fail("El lugar no existe.");
  if (!isPlaceAdmin(placeId, byUserId)) {
    return fail("Solo el administrador puede invitar miembros.");
  }
  const userExists = readCollection<User>(COLLECTIONS.users).some(
    (u) => u.id === targetUserId,
  );
  if (!userExists) return fail("El usuario no existe en este navegador.");
  if (getMembership(placeId, targetUserId)) {
    return fail("El usuario ya es miembro del lugar.");
  }
  const membership: Membership = { placeId, userId: targetUserId, role };
  updateCollection<Membership>(COLLECTIONS.memberships, (items) => [
    ...items,
    membership,
  ]);
  return ok(membership);
}

export function setMemberRole(
  placeId: string,
  byUserId: string,
  targetUserId: string,
  role: PlaceRole,
): PlacesResult<Membership> {
  if (!isPlaceAdmin(placeId, byUserId)) {
    return fail("Solo el administrador puede cambiar permisos.");
  }
  if (byUserId === targetUserId) {
    return fail("No podés cambiar tu propio rol de administrador.");
  }
  const target = getMembership(placeId, targetUserId);
  if (!target) return fail("El usuario no es miembro del lugar.");
  const updated: Membership = { ...target, role };
  updateCollection<Membership>(COLLECTIONS.memberships, (items) =>
    items.map((m) =>
      m.placeId === placeId && m.userId === targetUserId ? updated : m,
    ),
  );
  return ok(updated);
}

export function removeMember(
  placeId: string,
  byUserId: string,
  targetUserId: string,
): PlacesResult<null> {
  const place = getPlace(placeId);
  if (!place) return fail("El lugar no existe.");
  if (!isPlaceAdmin(placeId, byUserId)) {
    return fail("Solo el administrador puede quitar miembros.");
  }
  if (place.createdBy === targetUserId) {
    return fail("No se puede quitar al creador del lugar.");
  }
  updateCollection<Membership>(COLLECTIONS.memberships, (items) =>
    items.filter(
      (m) => !(m.placeId === placeId && m.userId === targetUserId),
    ),
  );
  return ok(null);
}

/** Configuración de variables de consumo del place (independiente por place). */
export function updateConsumptionConfig(
  placeId: string,
  byUserId: string,
  config: Partial<ConsumptionConfig>,
): PlacesResult<Place> {
  const place = getPlace(placeId);
  if (!place) return fail("El lugar no existe.");
  if (!isPlaceAdmin(placeId, byUserId)) {
    return fail("Solo el administrador puede editar la configuración.");
  }
  const updated: Place = {
    ...place,
    consumptionConfig: { ...place.consumptionConfig, ...config },
  };
  updateCollection<Place>(COLLECTIONS.places, (items) =>
    items.map((p) => (p.id === placeId ? updated : p)),
  );
  return ok(updated);
}
