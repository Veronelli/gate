"use client";

import { useEffect, useState } from "react";
import { login, register } from "@/lib/auth";

const INPUT =
  "block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand focus:ring-brand/40";
const LABEL = "mb-2 block text-sm font-medium text-gray-900";
const BTN_PRIMARY =
  "w-full rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30 disabled:opacity-50";

/** Imágenes del carrusel lateral: dejá tus archivos en public/lateral/. */
const LATERAL_IMAGES = [
  "/lateral/1.jpg",
  "/lateral/2.jpg",
  "/lateral/3.jpg",
];

const SLIDE_MS = 4000;

function LateralCarousel() {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % LATERAL_IMAGES.length),
      SLIDE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg bg-white/15">
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
        Imagen del lateral
      </div>
      {LATERAL_IMAGES.map((src, i) =>
        failed[src] ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            onError={() => setFailed((f) => ({ ...f, [src]: true }))}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ),
      )}
    </div>
  );
}

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
    <main className="flex min-h-screen flex-col">
      {/* Navbar a lo ancho de la página */}
      <nav className="border-b border-brand-dark bg-brand">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-2">
          <h1 className="font-brand text-[50px] leading-tight text-white">
            food2check
          </h1>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Lateral con carrusel de imágenes (55% de la página) */}
        <aside className="hidden w-[55%] flex-col gap-4 bg-brand p-6 lg:flex">
          <p className="text-sm text-white/80">
            Tus listas de compras, siempre al día.
          </p>
          <LateralCarousel />
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
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
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
                  className="font-medium text-brand hover:underline"
                  onClick={() => switchMode("login")}
                >
                  ¿Ya tenés cuenta? Iniciar sesión
                </button>
              ) : (
                <>
                  <p className="text-gray-500">¿No tenés cuenta?</p>
                  <button
                    type="button"
                    className="mt-1 font-medium text-brand hover:underline"
                    onClick={() => switchMode("register")}
                  >
                    Crear una cuenta local
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
