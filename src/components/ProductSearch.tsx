"use client";

import { useEffect, useRef, useState } from "react";
import { CatalogProduct, debounce, searchCatalog } from "@/lib/dia";
import { SuggestedPrice } from "./SuggestedPrice";

export function ProductSearch({
  onPick,
}: {
  onPick: (product: CatalogProduct) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run(query: string) {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    try {
      const found = await searchCatalog(query, controller.signal);
      if (!controller.signal.aborted) {
        setResults(found);
        setError(
          found.length === 0
            ? `Sin resultados para "${query.trim()}".`
            : null,
        );
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setResults([]);
        setError(
          e instanceof Error ? e.message : "No se pudo buscar. Reintentá.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  const debounced = useRef(debounce(run, 300)).current;

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="relative">
      <input
        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40"
        placeholder="Buscar producto en Día…"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          debounced(e.target.value);
        }}
      />
      {searching && (
        <p className="mt-1 text-xs text-gray-500">Buscando…</p>
      )}
      {error && (
        <div className="mt-1 flex items-center gap-2 text-xs text-red-600">
          <span>{error}</span>
          <button
            type="button"
            className="underline"
            onClick={() => run(term)}
          >
            Reintentar
          </button>
        </div>
      )}
      {results.length > 0 && (
        <ul className="mt-1 max-h-64 divide-y divide-gray-200 overflow-auto rounded-lg border border-gray-200 bg-white shadow">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                onClick={() => {
                  onPick(p);
                  setTerm("");
                  setResults([]);
                }}
              >
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded object-contain"
                  />
                )}
                <span className="flex-1">
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-gray-500">
                    {p.brand}
                  </span>
                </span>
                <SuggestedPrice price={p.suggestedPrice} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
