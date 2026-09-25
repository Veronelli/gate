"use client";

import { useEffect, useReducer, useState } from "react";
import {
  getCurrentUser,
  getSession,
  listLocalAccounts,
  logout,
  setActivePlace,
  switchAccount,
} from "@/lib/auth";
import { getSuggestedItems } from "@/lib/consumption";
import { createList, listPlaceLists } from "@/lib/lists";
import {
  canWritePlace,
  createPlace,
  inviteMember,
  isPlaceAdmin,
  listMembers,
  listUserPlaces,
  removeMember,
  setMemberRole,
  updateConsumptionConfig,
  getPlace,
} from "@/lib/places";
import { listPlaceProducts, updateProductVariables } from "@/lib/products";
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
  const [switchUser, setSwitchUser] = useState("");
  const [switchPass, setSwitchPass] = useState("");
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
  const reminders = suggestions.filter((s) => s.reminder !== null);
  const placeLists = place ? listPlaceLists(place.id, user.id) : [];
  const placeProducts = place ? listPlaceProducts(place.id, user.id) : [];
  const admin = place ? isPlaceAdmin(place.id, user.id) : false;
  const writable = place ? canWritePlace(place.id, user.id) : false;
  const members = place ? listMembers(place.id) : [];
  const memberIds = new Set(members.map((m) => m.user.id));
  const invitableAccounts = listLocalAccounts().filter(
    (a) => !memberIds.has(a.id),
  );

  if (selectedListId) {
    return (
      <ListDetail
        listId={selectedListId}
        userId={user.id}
        onBack={() => setSelectedListId(null)}
        onChanged={bump}
      />
    );
  }

  return (
    <main className="flex min-h-screen">
      {/* Sidebar: lugares y administración */}
      <aside className="w-72 shrink-0 border-r bg-white p-4">
        <h1 className="text-xl font-bold text-emerald-700">food2check</h1>
        <p className="mt-1 text-xs text-neutral-500">Hola, {user.username}</p>

        <h2 className="mt-6 text-sm font-semibold">Mis lugares</h2>
        <ul className="mt-2 space-y-1">
          {myPlaces.map(({ place: p, role }) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setActivePlace(p.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  p.id === activePlaceId
                    ? "bg-emerald-100 font-medium text-emerald-900"
                    : "hover:bg-neutral-100"
                }`}
              >
                {p.name}
                <span className="ml-1 text-xs text-neutral-400">({role})</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-1">
          <input
            className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            placeholder="Nuevo lugar…"
            value={newPlace}
            onChange={(e) => setNewPlace(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-2 text-sm text-white"
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
            <h2 className="mt-6 text-sm font-semibold">
              Miembros de {place.name}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {members.map((m) => (
                <li key={m.user.id} className="flex items-center justify-between">
                  <span>
                    {m.user.username}
                    {m.isCreator && (
                      <span className="ml-1 text-xs text-neutral-400">
                        (creador)
                      </span>
                    )}
                  </span>
                  {m.isCreator ? (
                    <span className="text-xs text-neutral-400">admin</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <select
                        className="rounded border px-1 py-0.5 text-xs"
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
            {invitableAccounts.length > 0 && (
              <div className="mt-2 flex gap-1">
                <select
                  className="w-full rounded border px-1 py-1 text-xs"
                  value={inviteUser}
                  onChange={(e) => setInviteUser(e.target.value)}
                >
                  <option value="">Invitar usuario…</option>
                  {invitableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.username}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border px-1 py-1 text-xs"
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
                  className="rounded bg-emerald-600 px-2 text-xs text-white"
                  onClick={() => {
                    if (!inviteUser) return;
                    showError(
                      inviteMember(place.id, user.id, inviteUser, inviteRole),
                    );
                    setInviteUser("");
                    bump();
                  }}
                >
                  OK
                </button>
              </div>
            )}

            <h2 className="mt-6 text-sm font-semibold">
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
                    className="rounded border border-neutral-300 px-2 py-1"
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

        <div className="mt-8 space-y-2 border-t pt-4">
          <details className="text-xs">
            <summary className="cursor-pointer text-neutral-600">
              Cambiar de cuenta
            </summary>
            <div className="mt-2 space-y-1">
              <select
                className="w-full rounded border px-1 py-1"
                value={switchUser}
                onChange={(e) => setSwitchUser(e.target.value)}
              >
                <option value="">Elegir cuenta…</option>
                {listLocalAccounts()
                  .filter((a) => a.id !== user.id)
                  .map((a) => (
                    <option key={a.id} value={a.username}>
                      {a.username}
                    </option>
                  ))}
              </select>
              <input
                type="password"
                className="w-full rounded border px-1 py-1"
                placeholder="Contraseña de esa cuenta"
                value={switchPass}
                onChange={(e) => setSwitchPass(e.target.value)}
              />
              <button
                type="button"
                className="w-full rounded bg-neutral-800 py-1 text-white"
                onClick={async () => {
                  const r = await switchAccount(switchUser, switchPass);
                  if (r.ok) onSessionChange();
                  else setError(r.error);
                }}
              >
                Cambiar
              </button>
            </div>
          </details>
          <button
            type="button"
            className="w-full rounded-lg border border-neutral-300 py-1 text-sm hover:bg-neutral-100"
            onClick={() => {
              logout();
              onSessionChange();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Panel principal */}
      <section className="flex-1 p-6">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {!place && (
          <p className="text-neutral-500">
            Creá un lugar para empezar a armar tus listas.
          </p>
        )}

        {place && (
          <>
            <h2 className="text-2xl font-semibold">{place.name}</h2>

            {reminders.length > 0 && (
              <div className="mt-4 space-y-2">
                {reminders.map((r) => (
                  <p
                    key={r.product.id}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
                  >
                    {r.reminder}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Listas del lugar */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  Listas de compras
                </h3>
                {writable && (
                  <div className="mt-2 space-y-2 rounded-xl border bg-white p-3">
                    <input
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="Nombre de la lista"
                      value={newList}
                      onChange={(e) => setNewList(e.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="Descripción (opcional)"
                      value={newListDesc}
                      onChange={(e) => setNewListDesc(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
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
                    <li className="text-sm text-neutral-500">
                      Todavía no hay listas en este lugar.
                    </li>
                  )}
                  {placeLists.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedListId(l.id)}
                        className="flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 text-left hover:border-emerald-400"
                      >
                        <span>
                          <span className="block text-sm font-medium">
                            {l.name}
                          </span>
                          {l.description && (
                            <span className="block text-xs text-neutral-500">
                              {l.description}
                            </span>
                          )}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                          {STATE_LABELS[l.state]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Items a considerar */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  A considerar para comprar
                </h3>
                <ul className="mt-2 divide-y rounded-xl border bg-white">
                  {suggestions.length === 0 && (
                    <li className="p-4 text-sm text-neutral-500">
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
                        <p className="text-xs text-neutral-500">
                          Quedan ~{Math.ceil(s.daysRemaining)} días ·{" "}
                          {s.product.unitsRemaining} uds.
                        </p>
                      </div>
                      <div className="h-2 w-16 overflow-hidden rounded bg-neutral-200">
                        <div
                          className="h-full bg-emerald-500"
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
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  Productos del lugar
                </h3>
                <ul className="mt-2 divide-y rounded-xl border bg-white">
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
                        <p className="text-xs text-neutral-500">{p.brand}</p>
                      </div>
                      <SuggestedPrice price={p.suggestedPrice} />
                      {writable && (
                        <>
                          <label className="text-xs text-neutral-500">
                            Raciones
                            <input
                              type="number"
                              min={0}
                              className="ml-1 w-16 rounded border border-neutral-300 px-2 py-1"
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
                          <label className="text-xs text-neutral-500">
                            Refresco (días)
                            <input
                              type="number"
                              min={1}
                              className="ml-1 w-16 rounded border border-neutral-300 px-2 py-1"
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
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
