import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { appStateTable } from "@/db/schema";
import type {
  InvitePermission,
  ListImportance,
  ListItem,
  ListInvite,
  ListState,
  Membership,
  Place,
  PlaceRole,
  Product,
  ShoppingList,
  Tag,
  User,
} from "@/lib/types";

/**
 * Dominio server-side para el MCP: opera sobre el documento compartido
 * `app_state` aplicando las mismas reglas de permisos que el cliente.
 * La identidad del llamante la resuelve la route (Bearer → userId);
 * acá solo se verifican permisos y se aplican mutaciones.
 */

export type McpSource = "site" | "telegram";
export const MCP_SOURCES: McpSource[] = ["site", "telegram"];

export interface DomainDoc {
  schemaVersion?: number;
  users?: Partial<User>[];
  places?: Place[];
  memberships?: Membership[];
  lists?: ShoppingList[];
  items?: ListItem[];
  products?: Product[];
  invites?: ListInvite[];
  tags?: Tag[];
}

const STATE_ID = 1;

export async function loadDoc(): Promise<DomainDoc> {
  const rows = await getDb()
    .select()
    .from(appStateTable)
    .where(eq(appStateTable.id, STATE_ID))
    .limit(1);
  return rows[0] ? (JSON.parse(rows[0].doc) as DomainDoc) : {};
}

export async function saveDoc(doc: DomainDoc): Promise<void> {
  const now = new Date().toISOString();
  await getDb()
    .insert(appStateTable)
    .values({ id: STATE_ID, doc: JSON.stringify(doc), updatedAt: now })
    .onConflictDoUpdate({
      target: appStateTable.id,
      set: { doc: JSON.stringify(doc), updatedAt: now },
    });
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
const fail = <T>(error: string): Result<T> => ({ ok: false, error });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

// --- Lecturas de colección -------------------------------------------------

const places = (d: DomainDoc) => d.places ?? [];
const memberships = (d: DomainDoc) => d.memberships ?? [];
const lists = (d: DomainDoc) => d.lists ?? [];
const items = (d: DomainDoc) => d.items ?? [];
const products = (d: DomainDoc) => d.products ?? [];
const invites = (d: DomainDoc) => d.invites ?? [];
const users = (d: DomainDoc) => d.users ?? [];

// --- Permisos (espejo de src/lib/places.ts y src/lib/lists.ts) --------------

const getPlace = (d: DomainDoc, id: string) =>
  places(d).find((p) => p.id === id) ?? null;

const placeRole = (d: DomainDoc, placeId: string, userId: string) =>
  memberships(d).find((m) => m.placeId === placeId && m.userId === userId)
    ?.role ?? null;

const isPlaceAdmin = (d: DomainDoc, placeId: string, userId: string) =>
  placeRole(d, placeId, userId) === "admin";

const canWritePlace = (d: DomainDoc, placeId: string, userId: string) => {
  const r = placeRole(d, placeId, userId);
  return r === "admin" || r === "write";
};

const getList = (d: DomainDoc, id: string) =>
  lists(d).find((l) => l.id === id) ?? null;

const listInvite = (d: DomainDoc, listId: string, userId: string) =>
  invites(d).find((i) => i.listId === listId && i.userId === userId) ?? null;

const isListAdmin = (d: DomainDoc, listId: string, userId: string) => {
  const l = getList(d, listId);
  return !!l && (l.createdBy === userId || isPlaceAdmin(d, l.placeId, userId));
};

const canEditList = (d: DomainDoc, listId: string, userId: string) => {
  const l = getList(d, listId);
  return (
    !!l &&
    (l.createdBy === userId ||
      canWritePlace(d, l.placeId, userId) ||
      listInvite(d, listId, userId)?.permission === "edit")
  );
};

const canReadList = (d: DomainDoc, listId: string, userId: string) => {
  const l = getList(d, listId);
  return (
    !!l &&
    (placeRole(d, l.placeId, userId) !== null ||
      listInvite(d, listId, userId) !== null)
  );
};

const findUser = (d: DomainDoc, q: { id?: string; username?: string }) =>
  users(d).find(
    (u) =>
      (q.id && u.id === q.id) ||
      (q.username &&
        (u.username ?? "").trim().toLowerCase() ===
          q.username.trim().toLowerCase()),
  ) ?? null;

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

// --- Tools ------------------------------------------------------------------

export function tListPlaces(d: DomainDoc, userId: string) {
  return memberships(d)
    .filter((m) => m.userId === userId)
    .flatMap((m) => {
      const p = getPlace(d, m.placeId);
      return p ? [{ place: p, role: m.role }] : [];
    });
}

export function tGetPlace(d: DomainDoc, userId: string, placeId: string) {
  const p = getPlace(d, placeId);
  if (!p) return fail("El lugar no existe.");
  if (placeRole(d, placeId, userId) === null) {
    return fail("No sos miembro de este lugar.");
  }
  const members = memberships(d)
    .filter((m) => m.placeId === placeId)
    .flatMap((m) => {
      const u = findUser(d, { id: m.userId });
      return u
        ? [
            {
              userId: m.userId,
              username: u.username,
              role: m.role as PlaceRole,
              isOwner: m.userId === p.createdBy,
            },
          ]
        : [];
    });
  return ok({ place: p, members });
}

export function tCreatePlace(d: DomainDoc, userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return fail("El nombre del lugar es obligatorio.");
  const place: Place = {
    id: uid(),
    name: trimmed,
    createdBy: userId,
    createdAt: now(),
    consumptionConfig: { defaultRefreshDays: 30, reminderThresholdDays: 3 },
  };
  d.places = [...places(d), place];
  d.memberships = [
    ...memberships(d),
    { placeId: place.id, userId, role: "admin" },
  ];
  return ok(place);
}

export function tInvitePlaceMember(
  d: DomainDoc,
  userId: string,
  placeId: string,
  target: { userId?: string; username?: string },
  role: Exclude<PlaceRole, "admin">,
) {
  if (!getPlace(d, placeId)) return fail("El lugar no existe.");
  if (!isPlaceAdmin(d, placeId, userId)) {
    return fail("Solo el administrador puede invitar miembros.");
  }
  const u = findUser(d, { id: target.userId, username: target.username });
  if (!u?.id) return fail("El usuario no existe.");
  if (placeRole(d, placeId, u.id) !== null) {
    return fail("El usuario ya es miembro del lugar.");
  }
  const m: Membership = { placeId, userId: u.id, role };
  d.memberships = [...memberships(d), m];
  return ok(m);
}

export function tSetPlaceMemberRole(
  d: DomainDoc,
  userId: string,
  placeId: string,
  targetUserId: string,
  role: PlaceRole,
) {
  const p = getPlace(d, placeId);
  if (!p) return fail("El lugar no existe.");
  if (!isPlaceAdmin(d, placeId, userId)) {
    return fail("Solo el administrador puede cambiar permisos.");
  }
  if (userId === targetUserId) {
    return fail("No podés cambiar tu propio rol de administrador.");
  }
  if (p.createdBy === targetUserId) {
    return fail("No se puede cambiar el rol del propietario.");
  }
  const m = memberships(d).find(
    (x) => x.placeId === placeId && x.userId === targetUserId,
  );
  if (!m) return fail("El usuario no es miembro del lugar.");
  const updated = { ...m, role };
  d.memberships = memberships(d).map((x) =>
    x.placeId === placeId && x.userId === targetUserId ? updated : x,
  );
  return ok(updated);
}

export function tRemovePlaceMember(
  d: DomainDoc,
  userId: string,
  placeId: string,
  targetUserId: string,
) {
  const p = getPlace(d, placeId);
  if (!p) return fail("El lugar no existe.");
  if (!isPlaceAdmin(d, placeId, userId)) {
    return fail("Solo el administrador puede quitar miembros.");
  }
  if (p.createdBy === targetUserId) {
    return fail("No se puede quitar al propietario del lugar.");
  }
  d.memberships = memberships(d).filter(
    (x) => !(x.placeId === placeId && x.userId === targetUserId),
  );
  return ok(null);
}

export function tListLists(d: DomainDoc, userId: string, placeId: string) {
  const member = placeRole(d, placeId, userId) !== null;
  const invited = new Set(
    invites(d)
      .filter((i) => i.userId === userId)
      .map((i) => i.listId),
  );
  return lists(d).filter(
    (l) => l.placeId === placeId && (member || invited.has(l.id)),
  );
}

export function tGetList(d: DomainDoc, userId: string, listId: string) {
  const l = getList(d, listId);
  if (!l) return fail("La lista no existe.");
  if (!canReadList(d, listId, userId)) {
    return fail("No tenés acceso a esta lista.");
  }
  const invited = invites(d)
    .filter((i) => i.listId === listId)
    .flatMap((i) => {
      const u = findUser(d, { id: i.userId });
      return u
        ? [{ userId: i.userId, username: u.username, permission: i.permission }]
        : [];
    });
  const owner = findUser(d, { id: l.createdBy });
  return ok({
    list: l,
    items: items(d).filter((i) => i.listId === listId),
    owner: owner ? { userId: owner.id, username: owner.username } : null,
    invited,
  });
}

const LIST_STATES: ListState[] = ["listando", "a_comprar", "comprando", "listo"];
const IMPORTANCES: ListImportance[] = ["alta", "media", "baja"];

const normalizeTags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags
    .map((t) => t.trim())
    .filter((t) => {
      if (!t || seen.has(t.toLowerCase())) return false;
      seen.add(t.toLowerCase());
      return true;
    });
};

function registerTags(d: DomainDoc, userId: string, tags: string[]) {
  const known = new Set(
    (d.tags ?? [])
      .filter((t) => t.userId === userId)
      .map((t) => t.name.toLowerCase()),
  );
  const fresh = tags.filter((t) => !known.has(t.toLowerCase()));
  if (!fresh.length) return;
  d.tags = [
    ...(d.tags ?? []),
    ...fresh.map((name) => ({ id: uid(), userId, name, createdAt: now() })),
  ];
}

export function tCreateList(
  d: DomainDoc,
  userId: string,
  placeId: string,
  name: string,
  opts: {
    description?: string;
    tags?: string[];
    scheduledAt?: string | null;
    importance?: ListImportance;
  } = {},
) {
  const trimmed = name.trim();
  if (!trimmed) return fail("El nombre de la lista es obligatorio.");
  if (!canWritePlace(d, placeId, userId)) {
    return fail("Necesitás permiso de escritura en el lugar para crear listas.");
  }
  if (opts.importance && !IMPORTANCES.includes(opts.importance)) {
    return fail("Importancia inválida.");
  }
  const tags = normalizeTags(opts.tags ?? []);
  const list: ShoppingList = {
    id: uid(),
    placeId,
    name: trimmed,
    description: opts.description?.trim() || undefined,
    createdBy: userId,
    state: "listando",
    tags,
    scheduledAt: opts.scheduledAt ?? null,
    importance: opts.importance ?? "media",
  };
  d.lists = [...lists(d), list];
  registerTags(d, userId, tags);
  return ok(list);
}

export interface McpItem {
  id?: string;
  productId: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  suggestedPrice?: number;
  units: number;
  checked?: boolean;
}

/** Reemplazo completo del contenido provisto (semántica PUT). */
export function tUpdateList(
  d: DomainDoc,
  userId: string,
  listId: string,
  changes: {
    name?: string;
    description?: string;
    state?: ListState;
    tags?: string[];
    scheduledAt?: string | null;
    importance?: ListImportance;
    items?: McpItem[];
  },
) {
  const l = getList(d, listId);
  if (!l) return fail("La lista no existe.");
  if (!canEditList(d, listId, userId)) {
    return fail("No tenés permiso para editar esta lista.");
  }
  if (changes.state && !LIST_STATES.includes(changes.state)) {
    return fail("Estado inválido.");
  }
  if (changes.importance && !IMPORTANCES.includes(changes.importance)) {
    return fail("Importancia inválida.");
  }
  const updated: ShoppingList = {
    ...l,
    name: changes.name !== undefined ? changes.name.trim() || l.name : l.name,
    description:
      changes.description !== undefined
        ? changes.description.trim() || undefined
        : l.description,
    state: changes.state ?? l.state,
    tags:
      changes.tags !== undefined ? normalizeTags(changes.tags) : (l.tags ?? []),
    scheduledAt:
      changes.scheduledAt !== undefined
        ? changes.scheduledAt
        : (l.scheduledAt ?? null),
    importance: changes.importance ?? l.importance ?? "media",
  };
  d.lists = lists(d).map((x) => (x.id === listId ? updated : x));
  if (changes.tags !== undefined) registerTags(d, userId, updated.tags);

  if (changes.items !== undefined) {
    const next: ListItem[] = changes.items.map((i) => {
      const existing = i.id
        ? items(d).find((x) => x.id === i.id && x.listId === listId)
        : items(d).find(
            (x) => x.listId === listId && x.productId === i.productId,
          );
      return {
        id: existing?.id ?? i.id ?? uid(),
        listId,
        productId: i.productId,
        units: Math.max(1, Math.round(i.units)),
        checked: i.checked ?? existing?.checked ?? false,
        snapshot: {
          name: i.name || existing?.snapshot.name || "",
          brand: i.brand ?? existing?.snapshot.brand ?? "",
          imageUrl: i.imageUrl ?? existing?.snapshot.imageUrl ?? "",
          suggestedPrice:
            i.suggestedPrice ?? existing?.snapshot.suggestedPrice ?? 0,
          capturedAt: existing?.snapshot.capturedAt ?? now(),
        },
      };
    });
    d.items = [
      ...items(d).filter((x) => x.listId !== listId),
      ...next,
    ];
  }
  return ok(updated);
}

export function tSetListState(
  d: DomainDoc,
  userId: string,
  listId: string,
  state: ListState,
) {
  if (!LIST_STATES.includes(state)) return fail("Estado inválido.");
  return tUpdateList(d, userId, listId, { state });
}

export function tDeleteList(d: DomainDoc, userId: string, listId: string) {
  if (!getList(d, listId)) return fail("La lista no existe.");
  if (!canEditList(d, listId, userId)) {
    return fail("No tenés permiso para eliminar esta lista.");
  }
  d.items = items(d).filter((i) => i.listId !== listId);
  d.invites = invites(d).filter((i) => i.listId !== listId);
  d.lists = lists(d).filter((l) => l.id !== listId);
  return ok(null);
}

export function tInviteToList(
  d: DomainDoc,
  userId: string,
  listId: string,
  target: { userId?: string; username?: string },
) {
  const l = getList(d, listId);
  if (!l) return fail("La lista no existe.");
  if (!isListAdmin(d, listId, userId)) {
    return fail("Solo el administrador de la lista puede invitar.");
  }
  const u = findUser(d, { id: target.userId, username: target.username });
  if (!u?.id) return fail("El usuario no existe.");
  if (isListAdmin(d, listId, u.id)) {
    return fail("El usuario ya administra la lista.");
  }
  if (placeRole(d, l.placeId, u.id) === null) {
    return fail("El usuario debe ser miembro del lugar.");
  }
  if (listInvite(d, listId, u.id)) {
    return fail("El usuario ya está invitado a la lista.");
  }
  const inv: ListInvite = { listId, userId: u.id, permission: "read" };
  d.invites = [...invites(d), inv];
  return ok(inv);
}

export function tSetListInvitePermission(
  d: DomainDoc,
  userId: string,
  listId: string,
  targetUserId: string,
  permission: InvitePermission,
) {
  if (!isListAdmin(d, listId, userId)) {
    return fail("Solo el administrador de la lista puede dar permisos.");
  }
  const inv = listInvite(d, listId, targetUserId);
  if (!inv) return fail("El usuario no está invitado a la lista.");
  const updated = { ...inv, permission };
  d.invites = invites(d).map((i) =>
    i.listId === listId && i.userId === targetUserId ? updated : i,
  );
  return ok(updated);
}

export function tRemoveListInvite(
  d: DomainDoc,
  userId: string,
  listId: string,
  targetUserId: string,
) {
  if (!isListAdmin(d, listId, userId)) {
    return fail("Solo el administrador de la lista puede quitar invitados.");
  }
  d.invites = invites(d).filter(
    (i) => !(i.listId === listId && i.userId === targetUserId),
  );
  return ok(null);
}

export function tListProducts(d: DomainDoc, userId: string, placeId: string) {
  if (placeRole(d, placeId, userId) === null) {
    return { ok: false as const, error: "No sos miembro de este lugar." };
  }
  return ok(products(d).filter((p) => p.placeId === placeId));
}

export function tCreateProduct(
  d: DomainDoc,
  userId: string,
  placeId: string,
  data: {
    name: string;
    brand?: string;
    imageUrl?: string;
    suggestedPrice?: number;
    unitsRemaining?: number;
  },
) {
  const p = getPlace(d, placeId);
  if (!p) return fail("El lugar no existe.");
  if (!canWritePlace(d, placeId, userId)) {
    return fail("Necesitás permiso de escritura para agregar productos.");
  }
  const trimmed = data.name.trim();
  if (!trimmed) return fail("El nombre del producto es obligatorio.");
  const product: Product = {
    id: uid(),
    placeId,
    name: trimmed,
    brand: data.brand ?? "",
    imageUrl: data.imageUrl ?? "",
    suggestedPrice: data.suggestedPrice ?? 0,
    refreshDays: p.consumptionConfig.defaultRefreshDays,
    unitsRemaining: data.unitsRemaining ?? 0,
    lastUnitsPurchased: 0,
    plazos: [],
    lastPurchaseAt: null,
    stockUpdatedAt: null,
  };
  d.products = [...products(d), product];
  return ok(product);
}
