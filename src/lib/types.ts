export type PlaceRole = "admin" | "write" | "read";
export type InvitePermission = "read" | "edit";
export type ListState = "listando" | "a_comprar" | "comprando" | "listo";
export type ListImportance = "alta" | "media" | "baja";

export interface User {
  id: string;
  username: string;
  /** Solo existe en el servidor (SQLite); el cliente guarda registros sin secretos. */
  passwordHash?: string;
  salt?: string;
  createdAt: string;
}

export interface ConsumptionConfig {
  defaultRefreshDays: number;
  reminderThresholdDays: number;
}

export interface Place {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  consumptionConfig: ConsumptionConfig;
}

export interface Membership {
  placeId: string;
  userId: string;
  role: PlaceRole;
}

export interface Product {
  id: string;
  placeId: string;
  name: string;
  brand: string;
  imageUrl: string;
  suggestedPrice: number;
  refreshDays: number;
  unitsRemaining: number;
  /** Unidades compradas la última vez; referencia para la tasa de consumo. */
  lastUnitsPurchased: number;
  /** Últimos intervalos (días) entre compras; máx. NEXT_PUBLIC_CONSUMPTION_HISTORY_MAX entradas (default 3). */
  plazos: number[];
  lastPurchaseAt: string | null;
  /** Cuándo se actualizó el stock (compra o ajuste manual); base para descontar raciones por tiempo. */
  stockUpdatedAt: string | null;
}

export interface ShoppingList {
  id: string;
  placeId: string;
  name: string;
  description?: string;
  createdBy: string;
  state: ListState;
  /** Etiquetas del usuario asignadas a la lista (ej.: "asado", "cumpleaños"). */
  tags: string[];
  /** Fecha y hora programadas para hacer la compra (ISO); null si no se programó. */
  scheduledAt: string | null;
  /** Nivel de importancia de la lista. */
  importance: ListImportance;
}

/** Etiqueta reutilizable del usuario (se puede aplicar a varias listas). */
export interface Tag {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface ListItemSnapshot {
  name: string;
  brand: string;
  imageUrl: string;
  suggestedPrice: number;
  capturedAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  productId: string;
  units: number;
  checked: boolean;
  snapshot: ListItemSnapshot;
}

export interface ListInvite {
  listId: string;
  userId: string;
  permission: InvitePermission;
}

export interface Session {
  userId: string;
  /** Token bearer emitido por el servidor para autenticar las requests. */
  token: string;
  placeId: string | null;
  startedAt: string;
}
