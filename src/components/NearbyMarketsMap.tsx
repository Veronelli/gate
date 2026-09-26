"use client";

import { useEffect, useState } from "react";

type GeoState = "idle" | "asking" | "granted" | "denied";

const CHAIN_SUGGESTIONS = ["supermercado", "Dia", "Coto", "Carrefour"];

/**
 * Mapa embebido de Google Maps con supermercados cercanos.
 * Usa el embed público (sin API key): el estilo se aproxima con un
 * filtro CSS hacia el color de marca, y las cadenas se eligen con
 * chips que cambian la búsqueda.
 * El permiso de ubicación se pide explícitamente con un botón.
 */
export function NearbyMarketsMap() {
  const [state, setState] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [query, setQuery] = useState("supermercado");
  const [search, setSearch] = useState("supermercado");

  // Debounce: el iframe no se recarga en cada tecla.
  useEffect(() => {
    const t = setTimeout(
      () => setQuery(search.trim() || "supermercado"),
      600,
    );
    return () => clearTimeout(t);
  }, [search]);

  // z=15 ≈ 1 km de radio en la vista del mapa.
  const src = coords
    ? `https://maps.google.com/maps?q=${encodeURIComponent(query || "supermercado")}&ll=${coords.lat},${coords.lng}&z=15&output=embed`
    : `https://maps.google.com/maps?q=supermercado&z=13&output=embed`;

  function askLocation() {
    if (!navigator.geolocation) {
      setState("denied");
      return;
    }
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setState("granted");
      },
      () => setState("denied"),
      { timeout: 10000 },
    );
  }

  return (
    <div>
      {state === "idle" && (
        <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-600">
            Para mostrarte los supermercados cercanos necesitamos tu
            ubicación.
          </p>
          <button
            type="button"
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
            onClick={askLocation}
          >
            📍 Compartir mi ubicación
          </button>
        </div>
      )}
      {state === "asking" && (
        <div className="flex h-72 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500 shadow-sm">
          Esperando tu permiso de ubicación…
        </div>
      )}
      {(state === "granted" || state === "denied") && (
        <div className="relative">
          <iframe
            title="Supermercados cercanos"
            src={src}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-72 w-full rounded-lg border border-gray-200 shadow-sm"
            allowFullScreen
          />
          {state === "granted" && (
            <div className="absolute right-2 top-2 flex gap-1">
              <input
                type="text"
                list="f2c-chains"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setQuery(search.trim() || "supermercado");
                  }
                }}
                placeholder="Buscar: Día, Coto, Carrefour…"
                className="w-44 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 shadow focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <button
                type="button"
                title="Buscar"
                onClick={() => setQuery(search.trim() || "supermercado")}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-600 shadow hover:bg-gray-50"
              >
                🔍
              </button>
              <datalist id="f2c-chains">
                {CHAIN_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-gray-500">
        {state === "granted" &&
          "Supermercados en un radio de ~1 km de tu ubicación."}
        {state === "denied" && (
          <>
            No pudimos acceder a tu ubicación; mostramos supermercados en
            general.{" "}
            <button
              type="button"
              className="underline hover:text-brand-dark"
              onClick={askLocation}
            >
              Reintentar
            </button>
          </>
        )}
        {(state === "idle" || state === "asking") &&
          "Solo se usa para centrar el mapa; no se guarda."}
      </p>
    </div>
  );
}
