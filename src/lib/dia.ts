export const DIA_ENDPOINT =
  "https://diaonline.supermercadosdia.com.ar/api/intelligent-search/v1/product-search";
const TIMEOUT_MS = 6000;

export const SUGGESTED_PRICE_LEGEND = "Precio sugerido (referencia Día)";

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
  suggestedPrice: number;
}

interface DiaItem {
  images?: { imageUrl?: string }[];
  sellers?: {
    commertialOffer?: { Price?: number; ListPrice?: number };
  }[];
}

interface DiaProduct {
  productId?: string;
  productName?: string;
  brand?: string;
  items?: DiaItem[];
}

interface DiaSearchResponse {
  products?: DiaProduct[];
}

function mapProduct(p: DiaProduct): CatalogProduct | null {
  if (!p.productId || !p.productName) return null;
  const item = p.items?.[0];
  const price =
    item?.sellers?.[0]?.commertialOffer?.Price ??
    item?.sellers?.[0]?.commertialOffer?.ListPrice ??
    0;
  return {
    id: p.productId,
    name: p.productName,
    brand: p.brand ?? "",
    imageUrl: item?.images?.[0]?.imageUrl ?? "",
    suggestedPrice: price,
  };
}

export function mapDiaProducts(body: DiaSearchResponse): CatalogProduct[] {
  return (body.products ?? [])
    .map(mapProduct)
    .filter((p): p is CatalogProduct => p !== null);
}

/**
 * Busca en el catálogo vía `/api/productos` (proxy server-side de la API de
 * Día, que no permite CORS desde el navegador).
 */
export async function searchCatalog(
  term: string,
  signal?: AbortSignal,
): Promise<CatalogProduct[]> {
  const query = term.trim();
  if (!query) return [];
  const signals = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) signals.push(signal);
  let res: Response;
  try {
    res = await fetch(`/api/productos?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.any(signals),
    });
  } catch {
    throw new Error(
      "No se pudo consultar el catálogo de Día. Revisá tu conexión e intentá de nuevo.",
    );
  }
  if (!res.ok) {
    throw new Error(
      "No se pudo consultar el catálogo de Día. Intentá de nuevo más tarde.",
    );
  }
  const body = (await res.json()) as { products?: CatalogProduct[] };
  return body.products ?? [];
}

/** Debounce simple para la búsqueda desde la UI. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
