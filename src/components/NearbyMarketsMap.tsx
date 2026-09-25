"use client";

import { useState } from "react";

type GeoState = "idle" | "asking" | "granted" | "denied";

/**
 * Mapa embebido de Google Maps con supermercados cercanos.
 * Usa el embed público (sin API key). El permiso de ubicación se
 * pide explícitamente con un botón; sin permiso se muestra una
 * búsqueda genérica.
 */
export function NearbyMarketsMap() {
  const [state, setState] = useState<GeoState>("idle");
  const [src, setSrc] = useState(
    "https://maps.google.com/maps?q=supermercados&z=13&output=embed",
  );

  function askLocation() {
    if (!navigator.geolocation) {
      setState("denied");
      return;
    }
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // z=20 ≈ 50 m de radio en la vista del mapa.
        setSrc(
          `https://maps.google.com/maps?q=supermercado&ll=${latitude},${longitude}&z=20&output=embed`,
        );
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
        <iframe
          title="Supermercados cercanos"
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-72 w-full rounded-lg border border-gray-200 shadow-sm"
          allowFullScreen
        />
      )}
      <p className="mt-1 text-xs text-gray-500">
        {state === "granted" &&
          "Supermercados en un radio de ~50 m de tu ubicación."}
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
