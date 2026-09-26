"use client";

import { useState } from "react";
import { listLocalAccounts } from "@/lib/auth";
import {
  advanceListState,
  addListItem,
  canEditList,
  canReadList,
  deleteList,
  getList,
  inviteToList,
  isListAdmin,
  listInvitableUsers,
  listInvites,
  listListItems,
  LIST_STATES,
  removeListInvite,
  removeListItem,
  setItemChecked,
  setItemUnits,
  setInvitePermission,
  setListMeta,
  listUserTags,
} from "@/lib/lists";
import { listMembers } from "@/lib/places";
import type {
  ListImportance,
  ListItem,
  ListState,
} from "@/lib/types";
import { addProductFromSearch } from "@/lib/products";
import type { CatalogProduct } from "@/lib/catalog";
import { ProductSearch } from "./ProductSearch";
import { SuggestedPrice } from "./SuggestedPrice";
import { TagPicker } from "./TagPicker";

/** ISO → formato `YYYY-MM-DDTHH:mm` del input datetime-local (hora local). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const STATE_LABELS: Record<ListState, string> = {
  listando: "Listando",
  a_comprar: "A comprar",
  comprando: "Comprando",
  listo: "Listo",
};

export const IMPORTANCE_LABELS: Record<ListImportance, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export function ListDetail({
  listId,
  userId,
  onBack,
  onChanged,
}: {
  listId: string;
  userId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState("");

  const list = getList(listId);
  const [draftItems, setDraftItems] = useState<ListItem[]>(() =>
    list ? listListItems(listId) : [],
  );
  const [draftTags, setDraftTags] = useState<string[]>(list?.tags ?? []);
  const [draftScheduled, setDraftScheduled] = useState(
    toLocalInput(list?.scheduledAt ?? null),
  );
  const [draftImportance, setDraftImportance] = useState<ListImportance>(
    list?.importance ?? "media",
  );
  const [dirty, setDirty] = useState(false);

  if (!list) {
    return (
      <div>
        <button type="button" onClick={onBack} className="text-sm underline">
          ← Volver
        </button>
        <p className="mt-4 text-gray-500">La lista no existe.</p>
      </div>
    );
  }
  if (!canReadList(listId, userId)) {
    return (
      <div>
        <button type="button" onClick={onBack} className="text-sm underline">
          ← Volver
        </button>
        <p className="mt-4 text-red-600">
          No tenés acceso a esta lista.
        </p>
      </div>
    );
  }

  const editable = canEditList(listId, userId);
  const admin = isListAdmin(listId, userId);
  const invites = listInvites(listId);
  const invitable = listInvitableUsers(listId);
  const accounts = new Map(
    listLocalAccounts().map((a) => [a.id, a.username]),
  );
  const stateIndex = LIST_STATES.indexOf(list.state);
  const nextState = LIST_STATES[stateIndex + 1];
  const hasLeftPanel =
    editable ||
    admin ||
    (list.tags ?? []).length > 0 ||
    Boolean(list.scheduledAt);
  // Admins con acceso a la lista: creador (propietario) + admins del place.
  const admins = listMembers(list.placeId).filter(
    (m) => m.user.id === list.createdBy || m.role === "admin",
  );

  function showError(result: { ok: boolean; error?: string }) {
    setError(result.ok ? null : (result.error ?? "Ocurrió un error."));
  }

  function touch() {
    setDirty(true);
  }

  function handlePick(product: CatalogProduct) {
    // El producto del lugar se crea al instante; el item entra al borrador
    // y solo persiste con "Guardar".
    const added = addProductFromSearch(list!.placeId, userId, product);
    if (!added.ok) return showError(added);
    const existing = draftItems.find((i) => i.productId === product.id);
    if (existing) {
      setDraftItems((items) =>
        items.map((i) =>
          i.id === existing.id ? { ...i, units: i.units + 1 } : i,
        ),
      );
    } else {
      setDraftItems((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          listId,
          productId: product.id,
          units: 1,
          checked: false,
          snapshot: {
            name: product.name,
            brand: product.brand,
            imageUrl: product.imageUrl,
            suggestedPrice: product.suggestedPrice,
            capturedAt: new Date().toISOString(),
          },
        },
      ]);
    }
    setDirty(true);
  }

  /** PUT único: aplica todos los cambios del borrador de una vez. */
  function saveAll() {
    const original = listListItems(listId);
    const origById = new Map(original.map((o) => [o.id, o]));

    // Meta (etiquetas, fecha, importancia)
    showError(
      setListMeta(listId, userId, {
        tags: draftTags,
        scheduledAt: draftScheduled
          ? new Date(draftScheduled).toISOString()
          : null,
        importance: draftImportance,
      }),
    );

    // Items quitados
    for (const o of original) {
      if (!draftItems.some((d) => d.id === o.id)) {
        showError(removeListItem(listId, userId, o.id));
      }
    }
    // Items nuevos y modificados
    for (const d of draftItems) {
      const o = origById.get(d.id);
      if (!o) {
        showError(
          addListItem(listId, userId, {
            productId: d.productId,
            name: d.snapshot.name,
            brand: d.snapshot.brand,
            imageUrl: d.snapshot.imageUrl,
            suggestedPrice: d.snapshot.suggestedPrice,
            units: d.units,
          }),
        );
        continue;
      }
      if (o.units !== d.units) {
        showError(setItemUnits(listId, userId, d.id, d.units));
      }
      if (o.checked !== d.checked) {
        showError(setItemChecked(listId, userId, d.id, d.checked));
      }
    }

    setDirty(false);
    onChanged();
  }

  function handleDelete() {
    if (!window.confirm(`¿Eliminar la lista "${list!.name}"?`)) return;
    showError(deleteList(listId, userId));
    onBack();
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm underline">
        ← Volver
      </button>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">{list.name}</h2>
        <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand-dark">
          {STATE_LABELS[list.state]}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            (list.importance ?? "media") === "alta"
              ? "bg-red-100 text-red-700"
              : (list.importance ?? "media") === "baja"
                ? "bg-gray-200 text-gray-600"
                : "bg-amber-100 text-amber-700"
          }`}
        >
          {IMPORTANCE_LABELS[list.importance ?? "media"]}
        </span>
        {editable && nextState && (
          <button
            type="button"
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
            onClick={() => {
              showError(advanceListState(listId, userId));
              onChanged();
            }}
          >
            Pasar a {STATE_LABELS[nextState]}
          </button>
        )}
      </header>
      {dirty && (
        <p className="mt-2 text-xs font-medium text-amber-600">
          ● Cambios sin guardar — tocá “Guardar cambios” para aplicarlos.
        </p>
      )}
      {list.description && (
        <p className="mt-1 text-sm text-gray-600">{list.description}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div
        className={`mt-4 flex flex-col gap-6 ${hasLeftPanel ? "lg:flex-row" : ""}`}
      >
        {/* Columna izquierda: configuración, invitados y acciones */}
        {hasLeftPanel && (
        <div className="w-full shrink-0 space-y-6 lg:max-w-md">
          {editable || admin ? (
            <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              {editable && (
                <>
                  <h3 className="text-sm font-medium">
                    Etiquetas y programación
                  </h3>
                  <TagPicker
                    tags={draftTags}
                    suggestions={listUserTags(userId)}
                    onChange={(tags) => {
                      setDraftTags(tags);
                      touch();
                    }}
                  />
                  <label className="block text-xs text-gray-500">
                    Programar para
                    <input
                      type="datetime-local"
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                      value={draftScheduled}
                      onChange={(e) => {
                        setDraftScheduled(e.target.value);
                        touch();
                      }}
                    />
                  </label>
                  <label className="block text-xs text-gray-500">
                    Importancia
                    <select
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                      value={draftImportance}
                      onChange={(e) => {
                        setDraftImportance(e.target.value as ListImportance);
                        touch();
                      }}
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  </label>
                </>
              )}

              {admin && (
                <div
                  className={editable ? "border-t border-gray-200 pt-3" : ""}
                >
                  <h3 className="text-sm font-medium">
                    Invitados de la lista
                  </h3>
                  <ul className="mt-2 max-h-[300px] divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200">
                    {admins.map((m) => (
                      <li
                        key={m.user.id}
                        className="flex items-center justify-between p-3 text-sm"
                      >
                        <span>{m.user.username}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.user.id === list.createdBy
                              ? "bg-brand/15 text-brand-dark"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {m.user.id === list.createdBy
                            ? "Propietario"
                            : "Admin"}
                        </span>
                      </li>
                    ))}
                    {invites.length === 0 && (
                      <li className="p-3 text-sm text-gray-500">
                        Nadie está invitado todavía.
                      </li>
                    )}
                    {invites.map((inv) => (
                      <li
                        key={inv.userId}
                        className="flex items-center justify-between p-3 text-sm"
                      >
                        <span>
                          {accounts.get(inv.userId) ?? inv.userId}
                        </span>
                        <span className="flex items-center gap-2">
                          <select
                            className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-900 focus:border-brand focus:ring-brand/40"
                            value={inv.permission}
                            onChange={(e) => {
                              showError(
                                setInvitePermission(
                                  listId,
                                  userId,
                                  inv.userId,
                                  e.target.value as "read" | "edit",
                                ),
                              );
                              onChanged();
                            }}
                          >
                            <option value="read">Solo lectura</option>
                            <option value="edit">Puede editar</option>
                          </select>
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => {
                              removeListInvite(listId, userId, inv.userId);
                              onChanged();
                            }}
                          >
                            Quitar
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {invitable.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      <select
                        className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                        value={inviteTarget}
                        onChange={(e) => setInviteTarget(e.target.value)}
                      >
                        <option value="">Elegir usuario…</option>
                        {invitable.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
                        onClick={() => {
                          if (!inviteTarget) return;
                          showError(
                            inviteToList(listId, userId, inviteTarget),
                          );
                          setInviteTarget("");
                          onChanged();
                        }}
                      >
                        Invitar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium">
                Etiquetas y programación
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {(list.tags ?? []).length === 0 && !list.scheduledAt && (
                  <span className="text-sm text-gray-500">
                    Sin etiquetas ni fecha programada.
                  </span>
                )}
                {(list.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs text-gray-600"
                  >
                    {t}
                  </span>
                ))}
                {list.scheduledAt && (
                  <span className="text-sm text-brand-dark">
                    📅{" "}
                    {new Date(list.scheduledAt).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </section>
          )}

          {editable && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!dirty}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-500/30 disabled:opacity-40"
                onClick={saveAll}
              >
                Guardar cambios
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                onClick={handleDelete}
              >
                Eliminar lista
              </button>
            </div>
          )}
        </div>
        )}

        {/* Columna derecha: buscador de productos e items */}
        <section className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {editable && (
            <div>
              <h3 className="text-sm font-medium">Agregar producto</h3>
              <div className="mt-2 max-w-md">
                <ProductSearch onPick={handlePick} />
              </div>
            </div>
          )}

          <h3
            className={`text-sm font-medium ${editable ? "mt-4 border-t border-gray-200 pt-3" : ""}`}
          >
            Productos
          </h3>
          <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
            {draftItems.length === 0 && (
              <li className="p-4 text-sm text-gray-500">
                La lista está vacía. Buscá productos para agregar.
              </li>
            )}
            {draftItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={!editable}
                  onChange={(e) => {
                    setDraftItems((items) =>
                      items.map((i) =>
                        i.id === item.id
                          ? { ...i, checked: e.target.checked }
                          : i,
                      ),
                    );
                    touch();
                  }}
                />
                {item.snapshot.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.snapshot.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded object-contain"
                  />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${item.checked ? "line-through opacity-60" : ""}`}
                  >
                    {item.snapshot.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.snapshot.brand}
                  </p>
                </div>
                {editable ? (
                  <input
                    type="number"
                    min={1}
                    className="w-16 rounded-lg border border-gray-300 bg-gray-50 p-1.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                    value={item.units}
                    onChange={(e) => {
                      const units = Number(e.target.value);
                      if (units <= 0) return;
                      setDraftItems((items) =>
                        items.map((i) =>
                          i.id === item.id ? { ...i, units } : i,
                        ),
                      );
                      touch();
                    }}
                  />
                ) : (
                  <span className="text-sm">×{item.units}</span>
                )}
                <SuggestedPrice price={item.snapshot.suggestedPrice} />
                {editable && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => {
                      setDraftItems((items) =>
                        items.filter((i) => i.id !== item.id),
                      );
                      touch();
                    }}
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
