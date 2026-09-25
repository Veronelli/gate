"use client";

import { useEffect, useReducer, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getCurrentUser,
  getSession,
  logout,
  setActivePlace,
} from "@/lib/auth";
import { getSuggestedItems } from "@/lib/consumption";
import { createList, listPlaceLists, listUserTags } from "@/lib/lists";
import {
  canWritePlace,
  createPlace,
  inviteMemberByUsername,
  isPlaceAdmin,
  listMembers,
  listUserPlaces,
  removeMember,
  setMemberRole,
  getPlace,
} from "@/lib/places";
import {
  deleteProduct,
  updateProductVariables,
} from "@/lib/products";
import { STATE_LABELS, IMPORTANCE_LABELS, ListDetail } from "./ListDetail";
import { SuggestedPrice } from "./SuggestedPrice";
import { TagPicker } from "./TagPicker";
import { ShoppingCalendar } from "./ShoppingCalendar";
import { NearbyMarketsMap } from "./NearbyMarketsMap";

export function Dashboard({
  onSessionChange,
  initialListId,
}: {
  onSessionChange: () => void;
  /** Lista a abrir apenas se monta (deep-link /listas/[id]). */
  initialListId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [selectedListId, setSelectedListId] = useState<string | null>(
    initialListId ?? null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [newPlace, setNewPlace] = useState("");
  const [newList, setNewList] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListTags, setNewListTags] = useState<string[]>([]);
  const [newListAt, setNewListAt] = useState("");
  const [newListImp, setNewListImp] = useState<"alta" | "media" | "baja">(
    "media",
  );
  const [inviteUser, setInviteUser] = useState("");
  const [inviteRole, setInviteRole] = useState<"read" | "write">("read");
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<{
    phone: string;
    telegramChatId: string | null;
  } | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);

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

  // Carga el contact del usuario (teléfono / Telegram) una vez por sesión.
  useEffect(() => {
    if (!session?.token) return;
    fetch("/api/contacts", {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setContact(
          (
            d as {
              contact?: {
                phone: string;
                telegramChatId: string | null;
              } | null;
            } | null
          )?.contact ?? null,
        ),
      )
      .catch(() => setContact(null));
  }, [session?.token]);

  async function savePhone() {
    if (!session?.token) return;
    const res = await fetch("/api/contacts", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ phone }),
    });
    const data = (await res.json()) as {
      contact?: { phone: string; telegramChatId: string | null };
      error?: string;
    };
    if (!res.ok || !data.contact) {
      setPhoneMsg(data.error ?? "No se pudo guardar.");
      return;
    }
    setContact(data.contact);
    setPhoneMsg(null);
  }

  if (!user || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-600">
            No pudimos cargar tu sesión.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            onClick={() => {
              logout();
              onSessionChange();
            }}
          >
            Volver a iniciar sesión
          </button>
        </div>
      </main>
    );
  }

  const showError = (r: { ok: boolean; error?: string }) =>
    setError(r.ok ? null : (r.error ?? "Ocurrió un error."));

  const suggestions = place ? getSuggestedItems(place.id) : [];
  const placeLists = place ? listPlaceLists(place.id, user.id) : [];
  const admin = place ? isPlaceAdmin(place.id, user.id) : false;
  const writable = place ? canWritePlace(place.id, user.id) : false;
  const members = place ? listMembers(place.id) : [];
  const userTags = listUserTags(user.id);

  return (
    <main className="flex min-h-screen">
      {/* Sidebar: lugares y administración */}
      {/* Backdrop del menú en pantallas chicas */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-gray-700 bg-gray-800 text-gray-200 transition-transform duration-200 lg:static lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="bg-brand px-4 py-3 text-white">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="food2check"
              className="mr-2 h-7 w-auto"
            />
            <h1 className="font-brand text-xl">food2check</h1>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="ml-auto rounded p-1 text-white/80 hover:bg-white/10 lg:hidden"
              onClick={() => setMenuOpen(false)}
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-xs text-white/80">Hola, {user.username}</p>
        </div>
        <div className="flex flex-1 flex-col p-4">
        <h2 className="mt-2 text-sm font-semibold text-white">Mis lugares</h2>
        <ul className="mt-2 space-y-1">
          {myPlaces.map(({ place: p, role }) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setActivePlace(p.id);
                  setMenuOpen(false);
                }}
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
        {myPlaces.length === 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-medium text-white">
            Empezá creando tu primer lugar acá
            <span className="animate-bounce text-lg leading-none text-brand-light">
              ↓
            </span>
          </p>
        )}
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

          </>
        )}

        </div>
        {/* Recordatorios por Telegram */}
        <div className="border-t border-gray-700 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Recordatorios
          </h3>
          {contact === undefined ? null : contact?.telegramChatId ? (
            <p className="mt-2 text-xs text-green-400">
              ✓ Telegram vinculado — te avisamos de tus compras pendientes.
            </p>
          ) : (
            <>
              {!contact?.phone ? (
                <>
                  <p className="mt-2 text-xs text-gray-400">
                    Agregá tu teléfono para recibir recordatorios.
                  </p>
                  <div className="mt-2 flex gap-1">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 11 …"
                      className="w-full min-w-0 rounded-lg border border-gray-600 bg-gray-700 p-1.5 text-xs text-white placeholder-gray-400 focus:border-brand focus:ring-brand/40"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-lg bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                      onClick={() => void savePhone()}
                    >
                      Guardar
                    </button>
                  </div>
                  {phoneMsg && (
                    <p className="mt-1 text-xs text-red-400">{phoneMsg}</p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-xs text-gray-400">
                  📱 {contact.phone}
                </p>
              )}
              {process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && (
                <a
                  href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${user.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block rounded-lg border border-sky-500 px-3 py-1.5 text-center text-xs font-medium text-sky-400 hover:bg-sky-500/10"
                >
                  Vincular Telegram
                </a>
              )}
            </>
          )}
        </div>
        <div className="mt-auto border-t border-gray-700 p-4">
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
      </aside>

      {/* Panel principal */}
      <section className="flex-1 bg-gray-100 p-6">
        <button
          type="button"
          aria-label="Abrir menú"
          className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm lg:hidden"
          onClick={() => setMenuOpen(true)}
        >
          ☰ Menú
        </button>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {selectedListId ? (
          <ListDetail
            listId={selectedListId}
            userId={user.id}
            onBack={() => {
              setSelectedListId(null);
              if (pathname.startsWith("/listas/")) router.replace("/");
            }}
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
                {writable && placeLists.length === 0 && (
                  <p className="mt-3 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand bg-brand/10 px-4 py-3 text-sm font-semibold text-brand-dark">
                    Creá tu primera lista acá
                    <span className="animate-bounce text-2xl leading-none">
                      ↓
                    </span>
                  </p>
                )}
                {writable && (
                  <div
                    className={`mt-2 space-y-2 rounded-lg border bg-white p-4 shadow-sm ${
                      placeLists.length === 0
                        ? "border-brand ring-2 ring-brand/40"
                        : "border-gray-200"
                    }`}
                  >
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
                    <TagPicker
                      tags={newListTags}
                      suggestions={userTags}
                      onChange={setNewListTags}
                    />
                    <label className="block text-xs text-gray-500">
                      Programar para
                      <input
                        type="datetime-local"
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                        value={newListAt}
                        onChange={(e) => setNewListAt(e.target.value)}
                      />
                    </label>
                    <label className="block text-xs text-gray-500">
                      Importancia
                      <select
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
                        value={newListImp}
                        onChange={(e) =>
                          setNewListImp(
                            e.target.value as "alta" | "media" | "baja",
                          )
                        }
                      >
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baja">Baja</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
                      onClick={() => {
                        const r = createList(
                          place.id,
                          user.id,
                          newList,
                          newListDesc,
                          {
                            tags: newListTags,
                            scheduledAt: newListAt
                              ? new Date(newListAt).toISOString()
                              : null,
                            importance: newListImp,
                          },
                        );
                        showError(r);
                        if (r.ok) {
                          setNewList("");
                          setNewListDesc("");
                          setNewListTags([]);
                          setNewListAt("");
                          setNewListImp("media");
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
                          {((l.tags ?? []).length > 0 || l.scheduledAt) && (
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              {(l.tags ?? []).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600"
                                >
                                  {t}
                                </span>
                              ))}
                              {l.scheduledAt && (
                                <span className="text-xs text-brand-dark">
                                  📅{" "}
                                  {new Date(l.scheduledAt).toLocaleString(
                                    "es-AR",
                                    {
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand-dark">
                            {STATE_LABELS[l.state]}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              (l.importance ?? "media") === "alta"
                                ? "bg-red-100 text-red-700"
                                : (l.importance ?? "media") === "baja"
                                  ? "bg-gray-200 text-gray-600"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {IMPORTANCE_LABELS[l.importance ?? "media"]}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Items a considerar */}
              <section>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Calendario de compras
                    </h3>
                    <div className="mt-2">
                      <ShoppingCalendar
                        lists={placeLists}
                        onPick={setSelectedListId}
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Supermercados cercanos
                    </h3>
                    <div className="mt-2">
                      <NearbyMarketsMap />
                    </div>
                  </div>
                </div>

                <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Sugerencias de compra
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
                      className="flex flex-wrap items-center gap-3 p-3"
                    >
                      {s.product.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.product.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded object-contain"
                        />
                      )}
                      <div className="min-w-40 flex-1">
                        <p className="text-sm font-medium">{s.product.name}</p>
                        <p className="text-xs text-gray-500">
                          {Math.round(s.unitsRemaining) <= 0
                            ? "No tenés"
                            : `Quedan ~${Math.ceil(s.daysRemaining)} días · ~${Math.max(0, Math.round(s.unitsRemaining))} uds.`}
                          {s.product.brand ? ` · ${s.product.brand}` : ""}
                        </p>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded bg-gray-200">
                          <div
                            className="h-full bg-brand"
                            style={{ width: `${Math.round(s.score * 100)}%` }}
                          />
                        </div>
                      </div>
                      <SuggestedPrice price={s.product.suggestedPrice} />
                      {writable && (
                        <>
                          <label className="text-xs text-gray-500">
                            Raciones
                            <input
                              type="number"
                              min={0}
                              className="ml-1 w-16 rounded-lg border border-gray-300 bg-gray-50 p-1.5 text-xs text-gray-900 focus:border-brand focus:ring-brand/40"
                              defaultValue={s.product.unitsRemaining}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (v >= 0 && v !== s.product.unitsRemaining) {
                                  showError(
                                    updateProductVariables(
                                      place.id,
                                      user.id,
                                      s.product.id,
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
                              defaultValue={s.product.refreshDays}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (v > 0 && v !== s.product.refreshDays) {
                                  showError(
                                    updateProductVariables(
                                      place.id,
                                      user.id,
                                      s.product.id,
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
                                  `¿Eliminar "${s.product.name}" del lugar?`,
                                )
                              ) {
                                showError(
                                  deleteProduct(
                                    place.id,
                                    user.id,
                                    s.product.id,
                                  ),
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
            </div>
          </>
        )}
          </>
        )}
      </section>
    </main>
  );
}
