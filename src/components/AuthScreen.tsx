"use client";

import { useState } from "react";
import { login, register } from "@/lib/auth";

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
        <h1 className="text-3xl font-bold text-white">food2check</h1>
        <p className="text-emerald-100">
          Tus listas de compras, siempre al día.
        </p>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600/50 text-sm text-emerald-200"
          >
            Espacio para imagen {n}
          </div>
        ))}
      </aside>

      {/* Login / registro */}
      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="text-2xl font-semibold">
            {isRegister ? "Crear cuenta local" : "Iniciar sesión"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Usuario
              <input
                className="rounded-lg border border-neutral-300 px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Contraseña
              <input
                type="password"
                className="rounded-lg border border-neutral-300 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
              />
            </label>
            {isRegister && (
              <label className="flex flex-col gap-1 text-sm">
                Repetir contraseña
                <input
                  type="password"
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy
                ? "Cargando…"
                : isRegister
                  ? "Crear cuenta"
                  : "Ingresar"}
            </button>
          </form>

          <div className="mt-6 border-t pt-4 text-center text-sm">
            {isRegister ? (
              <button
                type="button"
                className="text-emerald-700 hover:underline"
                onClick={() => switchMode("login")}
              >
                ¿Ya tenés cuenta? Iniciar sesión
              </button>
            ) : (
              <>
                <p className="text-neutral-500">¿No tenés cuenta?</p>
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
