"use client";

import { useEffect, useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hydrateFromServer } from "@/lib/sync";
import { Dashboard } from "@/components/Dashboard";
import { CheckyChat } from "@/components/CheckyChat";

/** Deep-link a una lista: /listas/<id>. Sin sesión → login con redirect_path. */
export default function ListPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const listId = params.id;
  const [mounted, setMounted] = useState(false);
  const [tick, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!getSession()?.token) {
      router.replace(
        `/?redirect_path=${encodeURIComponent(`/listas/${listId}`)}`,
      );
      return;
    }
    void hydrateFromServer().then(() => {
      bump();
      setMounted(true);
    });
  }, [listId, router]);

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Cargando…</p>
      </main>
    );
  }

  return (
    <>
      <Dashboard
        key={tick}
        onSessionChange={bump}
        initialListId={listId}
      />
      <CheckyChat />
    </>
  );
}
