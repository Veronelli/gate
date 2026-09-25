import { NextResponse } from "next/server";
import { mapCatalogProducts } from "@/lib/catalog";
import type { CatalogSearchResponse } from "@/lib/catalog";

const TIMEOUT_MS = 6000;

export async function GET(request: Request) {
  const endpoint = process.env.CATALOG_API_URL?.trim();
  if (!endpoint) {
    return NextResponse.json(
      { error: "El catálogo no está configurado (falta CATALOG_API_URL)." },
      { status: 503 },
    );
  }
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ products: [] });
  const url = endpoint.includes("{q}")
    ? endpoint.replace("{q}", encodeURIComponent(q))
    : `${endpoint}${endpoint.includes("?") ? "&" : "?"}query=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "El catálogo respondió con error." },
        { status: 502 },
      );
    }
    const body = (await res.json()) as CatalogSearchResponse;
    return NextResponse.json({ products: mapCatalogProducts(body) });
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar el catálogo." },
      { status: 502 },
    );
  }
}
