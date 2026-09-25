"use client";

import { useEffect, useReducer, useState } from "react";
import {
  getCurrentUser,
  getSession,
  logout,
  setActivePlace,
} from "@/lib/auth";
import { getSuggestedItems } from "@/lib/consumption";
import { createList, listPlaceLists } from "@/lib/lists";
import {
  canWritePlace,
  createPlace,
  inviteMemberByUsername,
  isPlaceAdmin,
  listMembers,
  listUserPlaces,
  removeMember,
  setMemberRole,
  updateConsumptionConfig,
  getPlace,
} from "@/lib/places";
import {
  deleteProduct,
  listPlaceProducts,
  updateProductVariables,
} from "@/lib/products";
import { STATE_LABELS, ListDetail } from "./ListDetail";
import { SuggestedPrice } from "./SuggestedPrice";

export function Dashboard({ onSessionChange }: { onSessionChange: () => void }) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newPlace, setNewPlace] = useState("");
  const [newList, setNewList] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [inviteUser, setInviteUser] = useState("");
  const [inviteRole, setInviteRole] = useState<"read" | "write">("read");
  const [error, setError] = useState<string | null>(null);

  const user = getCurrentUser();
  const session = getSession();
  const myPlaces = user ? listUserPlaces(user.id) : [];
  const activePlaceId =
    session?.placeId &&
    myPlaces.some((p) => p.place.id === session.placeId)
      ? session.placeId
      : (myPlaces[0]?.place.id ?? null);
  const place = activePlaceId ? getPlace(activePlaceId) : null;

  useEffect(() => {
    if (activePlaceId && session && session.placeId !== activePlaceId) {
      setActivePlace(activePlaceId);
    }
  }, [activePlaceId, session]);

  if (!user || !session) return null;

  const showError = (r: { ok: boolean; error?: string }) =>
    setError(r.ok ? null : (r.error ?? "Ocurrió un error."));

  const suggestions = place ? getSuggestedItems(place.id) : [];
  const placeLists = place ? listPlaceLists(place.id, user.id) : [];
  const placeProducts = place ? listPlaceProducts(place.id, user.id) : [];
  const admin = place ? isPlaceAdmin(place.id, user.id) : false;
  const writable = place ? canWritePlace(place.id, user.id) : false;
  const members = place ? listMembers(place.id) : [];

  return (
    <main className="flex min-h-screen">
      {/* Sidebar: lugares y administración */}
      <aside className="w-72 shrink-0 border-r border-gray-700 bg-gray-800 text-gray-200">
        <div className="bg-brand px-4 py-3 text-white">
          <h1 className="font-brand text-xl">food2check</h1>
          <p className="mt-1 text-xs text-white/80">Hola, {user.username}</p>
        </div>
        <div className="p-4">
        <h2 className="mt-2 text-sm font-semibold text-white">Mis lugares</h2>
        <ul className="mt-2 space-y-1">
          {myPlaces.map(({ place: p, role }) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setActivePlace(p.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  p.id === activePlaceId
                    ? "bg-brand font-medium text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                {p.name}
                <span className="ml-1 text-xs text-gray-400">({role})</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-1">
          <input
            className="block w-full rounded-lg border border-gray-600 bg-gray-700 p-2.5 text-sm text-white placeholder-gray-400 focus:border-brand focus:ring-brand/40"
            placeholder="Nuevo lugar…"
            value={newPlace}
            onChange={(e) => setNewPlace(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
            onClick={() => {
              const r = createPlace(user.id, newPlace);
              showError(r);
              if (r.ok) {
                setNewPlace("");
                setActivePlace(r.value.id);
              }
              bump();
            }}
          >
            +
          </button>
        </div>

        {place && admin && (
          <>
            <h2 className="mt-6 text-sm font-semibold text-white">
              Miembros de {place.name}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {members.map((m) => (
                <li key={m.user.id} className="flex items-center justify-between">
                  <span>
                    {m.user.username}
                    {m.isCreator && (
                      <span className="ml-1 text-xs text-gray-400">
                        (creador)
                      </span>
                    )}
                  </span>
                  {m.isCreator ? (
                    <span className="text-xs text-gray-400">admin</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <select
                        className="rounded-lg border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-xs text-white focus:border-brand focus:ring-brand/40"
                        value={m.role}
                        onChange={(e) => {
                          showError(
                            setMemberRole(
                              place.id,
                              user.id,
                              m.user.id,
                              e.target.value as "read" | "write" | "admin",
                            ),
                          );
                          bump();
                        }}
                      >
                        <option value="read">Lectura</option>
                        <option value="write">Escritura</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => {
                          showError(
                            removeMember(place.id, user.id, m.user.id),
                          );
                          bump();
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1">
              <input
                className="block w-full rounded-lg border border-gray-600 bg-gray-700 p-1.5 text-xs text-white placeholder-gray-400 focus:border-brand focus:ring-brand/40"
                placeholder="Nombre de usuario"
                value={inviteUser}
                onChange={(e) => setInviteUser(e.target.value)}
              />
              <select
                className="rounded-lg border border-gray-600 bg-gray-700 px-1.5 py-1 text-xs text-white focus:border-brand focus:ring-brand/40"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "read" | "write")
                }
              >
                <option value="read">Lectura</option>
                <option value="write">Escritura</option>
              </select>
              <button
                type="button"
                className="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
                onClick={() => {
                  if (!inviteUser.trim()) return;
                  showError(
                    inviteMemberByUsername(
                      place.id,
                      user.id,
                      inviteUser,
                      inviteRole,
                    ),
                  );
                  setInviteUser("");
                  bump();
                }}
              >
                Invitar
              </button>
            </div>

            <h2 className="mt-6 text-sm font-semibold text-white">
              Variables de consumo
            </h2>
            <div className="mt-2 space-y-2 text-sm">
              {(
                [
                  ["defaultRefreshDays", "Refresco por defecto (días)"],
                  ["reminderThresholdDays", "Avisar cuando queden (días)"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex flex-col gap-1 text-xs">
                  {label}
                  <input
                    type="number"
                    min={1}
                    className="block w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-xs text-white focus:border-brand focus:ring-brand/40"
                    defaultValue={place.consumptionConfig[field]}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0) {
                        showError(
                          updateConsumptionConfig(place.id, user.id, {
                            [field]: v,
                          }),
                        );
                        bump();
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          </>
        )}

        <div className="mt-8 space-y-2 border-t border-gray-700 pt-4">
          <button
            type="button"
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-5 py-2 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-4 focus:ring-gray-500"
            onClick={() => {
              logout();
              onSessionChange();
            }}
          >
            Cerrar sesión
          </button>
        </div>
        </div>
      </aside>

      {/* Panel principal */}
      <section className="flex-1 bg-gray-100 p-6">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {selectedListId ? (
          <ListDetail
            listId={selectedListId}
            userId={user.id}
            onBack={() => setSelectedListId(null)}
            onChanged={bump}
          />
        ) : (
          <>
        {!place && (
          <p className="text-gray-500">
            Creá un lugar para empezar a armar tus listas.
          </p>
        )}

        {place && (
          <>
            <h2 className="text-2xl font-semibold">{place.name}</h2>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Listas del lugar */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Listas de compras
                </h3>
                {writable && (
                  <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <input
                      className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                      placeholder="Nombre de la lista"
                      value={newList}
                      onChange={(e) => setNewList(e.target.value)}
                    />
                    <input
                      className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                      placeholder="Descripción (opcional)"
                      value={newListDesc}
                      onChange={(e) => setNewListDesc(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
                      onClick={() => {
                        const r = createList(
                          place.id,
                          user.id,
                          newList,
                          newListDesc,
                        );
                        showError(r);
                        if (r.ok) {
                          setNewList("");
                          setNewListDesc("");
                        }
                        bump();
                      }}
                    >
                      Crear lista
                    </button>
                  </div>
                )}
                <ul className="mt-3 space-y-2">
                  {placeLists.length === 0 && (
                    <li className="text-sm text-gray-500">
                      Todavía no hay listas en este lugar.
                    </li>
                  )}
                  {placeLists.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedListId(l.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-gray-50"
                      >
                        <span>
                          <span className="block text-sm font-medium">
                            {l.name}
                          </span>
                          {l.description && (
                            <span className="block text-xs text-gray-500">
                              {l.description}
                            </span>
                          )}
                        </span>
                        <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand-dark">
                          {STATE_LABELS[l.state]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Items a considerar */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  A considerar para comprar
                </h3>
                <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
                  {suggestions.length === 0 && (
                    <li className="p-4 text-sm text-gray-500">
                      Sin productos registrados en este lugar todavía.
                    </li>
                  )}
                  {suggestions.map((s) => (
                    <li
                      key={s.product.id}
                      className="flex items-center gap-3 p-3"
                    >
                      {s.product.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.product.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded object-contain"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.product.name}</p>
                        <p className="text-xs text-gray-500">
                          Quedan ~{Math.ceil(s.daysRemaining)} días · ~
                          {Math.max(0, Math.round(s.unitsRemaining))} uds.
                        </p>
                      </div>
                      <div className="h-2 w-16 overflow-hidden rounded bg-gray-200">
                        <div
                          className="h-full bg-brand"
                          style={{ width: `${Math.round(s.score * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Productos del lugar */}
            {placeProducts.length > 0 && (
              <section className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Productos del lugar
                </h3>
                <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
                  {placeProducts.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded object-contain"
                        />
                      )}
                      <div className="min-w-40 flex-1">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.brand}</p>
                      </div>
                      <SuggestedPrice price={p.suggestedPrice} />
                      {writable && (
                        <>
                          <label className="text-xs text-gray-500">
                            Raciones
                            <input
                              type="number"
                              min={0}
                              className="ml-1 w-16 rounded-lg border border-gray-300 bg-gray-50 p-1.5 text-xs text-gray-900 focus:border-brand focus:ring-brand/40"
                              defaultValue={p.unitsRemaining}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (v >= 0 && v !== p.unitsRemaining) {
                                  showError(
                                    updateProductVariables(
                                      place.id,
                                      user.id,
                                      p.id,
                                      { unitsRemaining: v },
                                    ),
                                  );
                                  bump();
                                }
                              }}
                            />
                          </label>
                          <label className="text-xs text-gray-500">
                            Refresco (días)
                            <input
                              type="number"
                              min={1}
                              className="ml-1 w-16 rounded-lg border border-gray-300 bg-gray-50 p-1.5 text-xs text-gray-900 focus:border-brand focus:ring-brand/40"
                              defaultValue={p.refreshDays}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (v > 0 && v !== p.refreshDays) {
                                  showError(
                                    updateProductVariables(
                                      place.id,
                                      user.id,
                                      p.id,
                                      { refreshDays: v },
                                    ),
                                  );
                                  bump();
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `¿Eliminar "${p.name}" del lugar?`,
                                )
                              ) {
                                showError(
                                  deleteProduct(place.id, user.id, p.id),
                                );
                                bump();
                              }
                            }}
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
          </>
        )}
      </section>
    </main>
  );
}
