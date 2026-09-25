import { canWritePlace, getPlaceRole, isPlaceAdmin } from "./places";
import { COLLECTIONS, readCollection, updateCollection } from "./storage";
import type {
  InvitePermission,
  ListItem,
  ListItemSnapshot,
  ListInvite,
  ListState,
  ShoppingList,
  User,
} from "./types";

export type ListsResult<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = <T>(error: string): ListsResult<T> => ({ ok: false, error });
const ok = <T>(value: T): ListsResult<T> => ({ ok: true, value });

export const LIST_STATES: ListState[] = [
  "listando",
  "a_comprar",
  "comprando",
  "listo",
];

const readLists = () => readCollection<ShoppingList>(COLLECTIONS.lists);
const readItems = () => readCollection<ListItem>(COLLECTIONS.items);
const readInvites = () => readCollection<ListInvite>(COLLECTIONS.invites);

/** Hook que el motor de consumo registra para reaccionar cuando una lista pasa a `listo`. */
let onListCompleted: ((list: ShoppingList) => void) | null = null;
export function registerListCompletedHandler(
  handler: (list: ShoppingList) => void,
): void {
  onListCompleted = handler;
}

export function getList(listId: string): ShoppingList | null {
  return readLists().find((l) => l.id === listId) ?? null;
}

/** Admin de la lista: su creador o el admin del place. */
export function isListAdmin(listId: string, userId: string): boolean {
  const list = getList(listId);
  if (!list) return false;
  return list.createdBy === userId || isPlaceAdmin(list.placeId, userId);
}

export function getListInvite(
  listId: string,
  userId: string,
): ListInvite | null {
  return (
    readInvites().find(
      (i) => i.listId === listId && i.userId === userId,
    ) ?? null
  );
}

export function canReadList(listId: string, userId: string): boolean {
  const list = getList(listId);
  if (!list) return false;
  return (
    getPlaceRole(list.placeId, userId) !== null ||
    getListInvite(listId, userId) !== null
  );
}

/** Edición: creador, admin o write del place, o invitado con permiso `edit`. */
export function canEditList(listId: string, userId: string): boolean {
  const list = getList(listId);
  if (!list) return false;
  return (
    list.createdBy === userId ||
    canWritePlace(list.placeId, userId) ||
    getListInvite(listId, userId)?.permission === "edit"
  );
}

export function createList(
  placeId: string,
  byUserId: string,
  name: string,
  description?: string,
): ListsResult<ShoppingList> {
  const trimmed = name.trim();
  if (!trimmed) return fail("El nombre de la lista es obligatorio.");
  if (!canWritePlace(placeId, byUserId)) {
    return fail("Necesitás permiso de escritura en el lugar para crear listas.");
  }
  const list: ShoppingList = {
    id: crypto.randomUUID(),
    placeId,
    name: trimmed,
    description: description?.trim() || undefined,
    createdBy: byUserId,
    state: "listando",
  };
  updateCollection<ShoppingList>(COLLECTIONS.lists, (items) => [
    ...items,
    list,
  ]);
  return ok(list);
}

export function listPlaceLists(
  placeId: string,
  userId: string,
): ShoppingList[] {
  if (getPlaceRole(placeId, userId) === null) return [];
  return readLists().filter((l) => l.placeId === placeId);
}

export function setListState(
  listId: string,
  byUserId: string,
  state: ListState,
): ListsResult<ShoppingList> {
  const list = getList(listId);
  if (!list) return fail("La lista no existe.");
  if (!canEditList(listId, byUserId)) {
    return fail("No tenés permiso para cambiar el estado de la lista.");
  }
  if (!LIST_STATES.includes(state)) return fail("Estado inválido.");
  const updated: ShoppingList = { ...list, state };
  updateCollection<ShoppingList>(COLLECTIONS.lists, (items) =>
    items.map((l) => (l.id === listId ? updated : l)),
  );
  if (state === "listo" && list.state !== "listo") onListCompleted?.(updated);
  return ok(updated);
}

export function advanceListState(
  listId: string,
  byUserId: string,
): ListsResult<ShoppingList> {
  const list = getList(listId);
  if (!list) return fail("La lista no existe.");
  const next = LIST_STATES[LIST_STATES.indexOf(list.state) + 1];
  if (!next) return fail("La lista ya está en su estado final.");
  return setListState(listId, byUserId, next);
}

export interface NewListItem {
  productId: string;
  name: string;
  brand: string;
  imageUrl: string;
  suggestedPrice: number;
  units: number;
}

export function listListItems(listId: string): ListItem[] {
  return readItems().filter((i) => i.listId === listId);
}

/** Agrega un producto guardando un snapshot de sus datos al momento. */
export function addListItem(
  listId: string,
  byUserId: string,
  item: NewListItem,
): ListsResult<ListItem> {
  const list = getList(listId);
  if (!list) return fail("La lista no existe.");
  if (!canEditList(listId, byUserId)) {
    return fail("No tenés permiso para editar esta lista.");
  }
  if (item.units <= 0) return fail("Las unidades deben ser mayores a cero.");
  const existing = readItems().find(
    (i) => i.listId === listId && i.productId === item.productId,
  );
  if (existing) {
    const updated: ListItem = { ...existing, units: existing.units + item.units };
    updateCollection<ListItem>(COLLECTIONS.items, (items) =>
      items.map((i) => (i.id === existing.id ? updated : i)),
    );
    return ok(updated);
  }
  const snapshot: ListItemSnapshot = {
    name: item.name,
    brand: item.brand,
    imageUrl: item.imageUrl,
    suggestedPrice: item.suggestedPrice,
    capturedAt: new Date().toISOString(),
  };
  const newItem: ListItem = {
    id: crypto.randomUUID(),
    listId,
    productId: item.productId,
    units: item.units,
    checked: false,
    snapshot,
  };
  updateCollection<ListItem>(COLLECTIONS.items, (items) => [...items, newItem]);
  return ok(newItem);
}

export function removeListItem(
  listId: string,
  byUserId: string,
  itemId: string,
): ListsResult<null> {
  if (!canEditList(listId, byUserId)) {
    return fail("No tenés permiso para editar esta lista.");
  }
  updateCollection<ListItem>(COLLECTIONS.items, (items) =>
    items.filter((i) => !(i.id === itemId && i.listId === listId)),
  );
  return ok(null);
}

export function setItemChecked(
  listId: string,
  byUserId: string,
  itemId: string,
  checked: boolean,
): ListsResult<ListItem> {
  if (!canEditList(listId, byUserId)) {
    return fail("No tenés permiso para editar esta lista.");
  }
  const item = readItems().find(
    (i) => i.id === itemId && i.listId === listId,
  );
  if (!item) return fail("El producto no está en la lista.");
  const updated: ListItem = { ...item, checked };
  updateCollection<ListItem>(COLLECTIONS.items, (items) =>
    items.map((i) => (i.id === itemId ? updated : i)),
  );
  return ok(updated);
}

export function setItemUnits(
  listId: string,
  byUserId: string,
  itemId: string,
  units: number,
): ListsResult<ListItem> {
  if (!canEditList(listId, byUserId)) {
    return fail("No tenés permiso para editar esta lista.");
  }
  if (units <= 0) return fail("Las unidades deben ser mayores a cero.");
  const item = readItems().find(
    (i) => i.id === itemId && i.listId === listId,
  );
  if (!item) return fail("El producto no está en la lista.");
  const updated: ListItem = { ...item, units };
  updateCollection<ListItem>(COLLECTIONS.items, (items) =>
    items.map((i) => (i.id === itemId ? updated : i)),
  );
  return ok(updated);
}

// --- Invitados de la lista ---

export function listInvites(listId: string): ListInvite[] {
  return readInvites().filter((i) => i.listId === listId);
}

/** Solo se puede invitar a miembros del place que no sean el creador ni ya invitados. */
export function inviteToList(
  listId: string,
  byUserId: string,
  targetUserId: string,
): ListsResult<ListInvite> {
  const list = getList(listId);
  if (!list) return fail("La lista no existe.");
  if (!isListAdmin(listId, byUserId)) {
    return fail("Solo el administrador de la lista puede invitar.");
  }
  if (isListAdmin(listId, targetUserId)) {
    return fail("El usuario ya administra la lista.");
  }
  if (getPlaceRole(list.placeId, targetUserId) === null) {
    return fail("El usuario debe ser miembro del lugar.");
  }
  if (getListInvite(listId, targetUserId)) {
    return fail("El usuario ya está invitado a la lista.");
  }
  const invite: ListInvite = { listId, userId: targetUserId, permission: "read" };
  updateCollection<ListInvite>(COLLECTIONS.invites, (items) => [
    ...items,
    invite,
  ]);
  return ok(invite);
}

export function setInvitePermission(
  listId: string,
  byUserId: string,
  targetUserId: string,
  permission: InvitePermission,
): ListsResult<ListInvite> {
  if (!isListAdmin(listId, byUserId)) {
    return fail("Solo el administrador de la lista puede dar permisos.");
  }
  const invite = getListInvite(listId, targetUserId);
  if (!invite) return fail("El usuario no está invitado a la lista.");
  const updated: ListInvite = { ...invite, permission };
  updateCollection<ListInvite>(COLLECTIONS.invites, (items) =>
    items.map((i) =>
      i.listId === listId && i.userId === targetUserId ? updated : i,
    ),
  );
  return ok(updated);
}

export function removeListInvite(
  listId: string,
  byUserId: string,
  targetUserId: string,
): ListsResult<null> {
  if (!isListAdmin(listId, byUserId)) {
    return fail("Solo el administrador de la lista puede quitar invitados.");
  }
  updateCollection<ListInvite>(COLLECTIONS.invites, (items) =>
    items.filter(
      (i) => !(i.listId === listId && i.userId === targetUserId),
    ),
  );
  return ok(null);
}

/** Usuarios invitables: miembros del place que no administran la lista ni están invitados. */
export function listInvitableUsers(
  listId: string,
): Pick<User, "id" | "username">[] {
  const list = getList(listId);
  if (!list) return [];
  const invited = new Set(readInvites().filter((i) => i.listId === listId).map((i) => i.userId));
  return readCollection<User>(COLLECTIONS.users)
    .filter(
      (u) =>
        !isListAdmin(listId, u.id) &&
        !invited.has(u.id) &&
        getPlaceRole(list.placeId, u.id) !== null,
    )
    .map(({ id, username }) => ({ id, username }));
}
