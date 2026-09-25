"use client";

import { useMemo, useState } from "react";
import type { ShoppingList } from "@/lib/types";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Calendario mensual: marca los días con compras programadas. */
export function ShoppingCalendar({
  lists,
  onPick,
}: {
  lists: ShoppingList[];
  onPick: (listId: string) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, ShoppingList[]>();
    for (const l of lists) {
      if (!l.scheduledAt) continue;
      const d = new Date(l.scheduledAt);
      map.set(dayKey(d), [...(map.get(dayKey(d)) ?? []), l]);
    }
    return map;
  }, [lists]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // semana desde lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = dayKey(new Date());
  const monthName = cursor.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  const selectedLists = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ←
        </button>
        <p className="text-sm font-semibold capitalize">{monthName}</p>
        <button
          type="button"
          aria-label="Mes siguiente"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          →
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={i} />;
          const key = dayKey(new Date(year, month, day));
          const count = byDay.get(key)?.length ?? 0;
          const isToday = key === today;
          const isSelected = key === selected;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(count ? key : null)}
              disabled={!count}
              className={`relative flex h-9 items-center justify-center rounded-lg text-sm ${
                isSelected
                  ? "bg-brand font-semibold text-white"
                  : count
                    ? "bg-brand/15 font-medium text-brand-dark hover:bg-brand/25"
                    : isToday
                      ? "font-semibold text-gray-900 ring-1 ring-gray-300"
                      : "text-gray-500"
              }`}
            >
              {day}
              {count > 0 && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3">
          {selectedLists.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                onClick={() => onPick(l.id)}
              >
                <span className="font-medium">{l.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {new Date(l.scheduledAt as string).toLocaleTimeString(
                    "es-AR",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
