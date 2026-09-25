"use client";

import { useState } from "react";
import { login, register } from "@/lib/auth";

const INPUT =
  "block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:ring-emerald-500";
const LABEL = "mb-2 block text-sm font-medium text-gray-900";
const BTN_PRIMARY =
  "w-full rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:opacity-50";

export function AuthScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let result;
    if (isRegister) {
      result = await register(username, password, repeatPassword);
      if (result.ok) result = await login(username, password);
    } else {
      result = await login(username, password);
    }
    setBusy(false);
    if (result.ok) {
      onLoggedIn();
    } else {
      setError(result.error);
    }
  }

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    setRepeatPassword("");
  }

  return (
    <main className="flex min-h-screen">
      {/* Lateral de imágenes */}
      <aside className="hidden w-1/3 flex-col gap-4 bg-emerald-700 p-6 lg:flex">
        <h1 className="font-brand text-4xl text-white">food2check</h1>
        <p className="text-sm text-emerald-100">
          Tus listas de compras, siempre al día.
        </p>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex flex-1 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-600/50 text-sm text-emerald-200"
          >
            Espacio para imagen {n}
          </div>
        ))}
        <footer className="-mx-6 -mb-6 mt-auto bg-[#E36954] px-6 py-4 text-white">
          <p className="font-brand text-lg">food2check</p>
          <p className="text-xs text-white/80">
            Organizá las compras de tu lugar.
          </p>
        </footer>
      </aside>

      {/* Login / registro */}
      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-brand text-2xl text-gray-900">
            {isRegister ? "Crear cuenta local" : "Iniciar sesión"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-6">
            <div className="mb-5">
              <label htmlFor="f2c-username" className={LABEL}>
                Usuario
              </label>
              <input
                id="f2c-username"
                className={INPUT}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="mb-5">
              <label htmlFor="f2c-password" className={LABEL}>
                Contraseña
              </label>
              <input
                id="f2c-password"
                type="password"
                className={INPUT}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
              />
            </div>
            {isRegister && (
              <div className="mb-5">
                <label htmlFor="f2c-repeat" className={LABEL}>
                  Repetir contraseña
                </label>
                <input
                  id="f2c-repeat"
                  type="password"
                  className={INPUT}
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}
            {error && (
              <p className="mb-4 text-sm text-red-600">{error}</p>
            )}
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              {busy
                ? "Cargando…"
                : isRegister
                  ? "Crear cuenta"
                  : "Ingresar"}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-4 text-center text-sm">
            {isRegister ? (
              <button
                type="button"
                className="font-medium text-emerald-700 hover:underline"
                onClick={() => switchMode("login")}
              >
                ¿Ya tenés cuenta? Iniciar sesión
              </button>
            ) : (
              <>
                <p className="text-gray-500">¿No tenés cuenta?</p>
                <button
                  type="button"
                  className="mt-1 font-medium text-emerald-700 hover:underline"
                  onClick={() => switchMode("register")}
                >
                  Crear una cuenta local
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
