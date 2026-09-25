"use client";

import { useEffect, useReducer, useState } from "react";
import { getSession } from "@/lib/auth";
import { AuthScreen } from "@/components/AuthScreen";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tick, bump] = useReducer((x: number) => x + 1, 0);

  // localStorage solo existe en el cliente: leer tras el mount evita
  // diferencias de hidratación entre SSR y el primer render del cliente.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Cargando…</p>
      </main>
    );
  }

  const session = getSession();
  if (!session) return <AuthScreen onLoggedIn={bump} />;
  return <Dashboard key={session.userId + tick} onSessionChange={bump} />;
}
