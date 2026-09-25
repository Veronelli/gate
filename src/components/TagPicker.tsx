"use client";

import { useState } from "react";

const inputCls =
  "block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40";
const chipCls =
  "inline-flex items-center gap-1 rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand-dark";

export function TagPicker({
  tags,
  suggestions,
  onChange,
}: {
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = (name: string) => {
    const t = name.trim();
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t]);
    }
    setInput("");
  };

  const remove = (name: string) =>
    onChange(tags.filter((x) => x !== name));

  const unused = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className={chipCls}>
              {t}
              <button
                type="button"
                aria-label={`Quitar ${t}`}
                className="text-brand-dark/60 hover:text-brand-dark"
                onClick={() => remove(t)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <input
          className={inputCls}
          placeholder="Nueva etiqueta…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            }
          }}
        />
        <button
          type="button"
          className="rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => add(input)}
        >
          +
        </button>
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((t) => (
            <button
              key={t}
              type="button"
              className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-600 hover:border-brand hover:text-brand-dark"
              onClick={() => add(t)}
            >
              + {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
