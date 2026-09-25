"use client";

import { useState } from "react";
import { listLocalAccounts } from "@/lib/auth";
import {
  advanceListState,
  addListItem,
  canEditList,
  canReadList,
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
} from "@/lib/lists";
import type { ListState } from "@/lib/types";
import { addProductFromSearch } from "@/lib/products";
import type { CatalogProduct } from "@/lib/dia";
import { ProductSearch } from "./ProductSearch";
import { SuggestedPrice } from "./SuggestedPrice";

export const STATE_LABELS: Record<ListState, string> = {
  listando: "Listando",
  a_comprar: "A comprar",
  comprando: "Comprando",
  listo: "Listo",
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
  if (!list) {
    return (
      <div className="p-6">
        <button type="button" onClick={onBack} className="text-sm underline">
          ← Volver
        </button>
        <p className="mt-4 text-gray-500">La lista no existe.</p>
      </div>
    );
  }
  if (!canReadList(listId, userId)) {
    return (
      <div className="p-6">
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
  const items = listListItems(listId);
  const invites = listInvites(listId);
  const invitable = listInvitableUsers(listId);
  const accounts = new Map(
    listLocalAccounts().map((a) => [a.id, a.username]),
  );
  const stateIndex = LIST_STATES.indexOf(list.state);
  const nextState = LIST_STATES[stateIndex + 1];

  function showError(result: { ok: boolean; error?: string }) {
    setError(result.ok ? null : (result.error ?? "Ocurrió un error."));
  }

  function handlePick(product: CatalogProduct) {
    const added = addProductFromSearch(list!.placeId, userId, product);
    if (!added.ok) return showError(added);
    showError(
      addListItem(list!.id, userId, {
        productId: product.id,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        suggestedPrice: product.suggestedPrice,
        units: 1,
      }),
    );
    onChanged();
  }

  return (
    <div className="p-6">
      <button type="button" onClick={onBack} className="text-sm underline">
        ← Volver
      </button>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">{list.name}</h2>
        <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand-dark">
          {STATE_LABELS[list.state]}
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
      {list.description && (
        <p className="mt-1 text-sm text-gray-600">{list.description}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {editable && (
        <div className="mt-6">
          <h3 className="text-sm font-medium">Agregar producto</h3>
          <div className="mt-2 max-w-md">
            <ProductSearch onPick={handlePick} />
          </div>
        </div>
      )}

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {items.length === 0 && (
          <li className="p-4 text-sm text-gray-500">
            La lista está vacía. Buscá productos para agregar.
          </li>
        )}
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={item.checked}
              disabled={!editable}
              onChange={(e) => {
                setItemChecked(listId, userId, item.id, e.target.checked);
                onChanged();
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
              <p className="text-xs text-gray-500">{item.snapshot.brand}</p>
            </div>
            {editable ? (
              <input
                type="number"
                min={1}
                className="w-16 rounded-lg border border-gray-300 bg-gray-50 p-1.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                value={item.units}
                onChange={(e) => {
                  const units = Number(e.target.value);
                  if (units > 0) {
                    setItemUnits(listId, userId, item.id, units);
                    onChanged();
                  }
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
                  removeListItem(listId, userId, item.id);
                  onChanged();
                }}
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      {admin && (
        <section className="mt-8 max-w-md">
          <h3 className="text-sm font-medium">Invitados de la lista</h3>
          <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
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
                <span>{accounts.get(inv.userId) ?? inv.userId}</span>
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
                  showError(inviteToList(listId, userId, inviteTarget));
                  setInviteTarget("");
                  onChanged();
                }}
              >
                Invitar
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
