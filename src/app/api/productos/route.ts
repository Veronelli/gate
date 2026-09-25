import { NextResponse } from "next/server";
import { DIA_ENDPOINT, mapDiaProducts } from "@/lib/dia";

const TIMEOUT_MS = 6000;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ products: [] });
  try {
    const res = await fetch(
      `${DIA_ENDPOINT}?query=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: "La API de Día respondió con error." },
        { status: 502 },
      );
    }
    const body = (await res.json()) as Parameters<typeof mapDiaProducts>[0];
    return NextResponse.json({ products: mapDiaProducts(body) });
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar la API de Día." },
      { status: 502 },
    );
  }
}
