const COTO_ENDPOINT = "https://ac.cnstrc.com/autocomplete";
const TIMEOUT_MS = 6000;

export const SUGGESTED_PRICE_LEGEND = "Precio sugerido (referencia Coto)";

export interface CotoProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
  suggestedPrice: number;
}

interface CotoPriceEntry {
  listPrice?: number;
  formatPrice?: number;
}

interface CotoSectionItem {
  value?: string;
  data?: {
    id?: string;
    image_url?: string;
    product_medium_image_url?: string;
    product_large_image_url?: string;
    product_brand?: string;
    sku_display_name?: string;
    product_list_price?: number;
    price?: CotoPriceEntry[];
  };
}

interface CotoAutocompleteResponse {
  sections?: {
    Products?: CotoSectionItem[];
  };
}

/** Clave temporal: `key_` + 16 caracteres alfanuméricos aleatorios por request. */
export function generateApiKey(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `key_${[...bytes].map((b) => chars[b % chars.length]).join("")}`;
}

/** Usa `NEXT_PUBLIC_COTO_API_KEY` si está configurada; si no, una aleatoria. */
function apiKey(): string {
  return process.env.NEXT_PUBLIC_COTO_API_KEY || generateApiKey();
}

/** Precio sugerido: el menor listPrice entre las tiendas devueltas. */
function pickSuggestedPrice(data: CotoSectionItem["data"]): number {
  const prices = (data?.price ?? [])
    .map((p) => p.listPrice ?? p.formatPrice)
    .filter((p): p is number => typeof p === "number" && p > 0);
  if (prices.length > 0) return Math.min(...prices);
  return data?.product_list_price ?? 0;
}

function mapSectionItem(item: CotoSectionItem): CotoProduct | null {
  const id = item.data?.id;
  const name = item.data?.sku_display_name ?? item.value;
  if (!id || !name) return null;
  return {
    id,
    name,
    brand: item.data?.product_brand ?? "",
    imageUrl:
      item.data?.image_url ??
      item.data?.product_medium_image_url ??
      item.data?.product_large_image_url ??
      "",
    suggestedPrice: pickSuggestedPrice(item.data),
  };
}

export async function searchCoto(
  term: string,
  signal?: AbortSignal,
): Promise<CotoProduct[]> {
  const query = term.trim();
  if (!query) return [];
  const signals = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) signals.push(signal);
  const url = `${COTO_ENDPOINT}/${encodeURIComponent(query)}?key=${apiKey()}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.any(signals) });
  } catch {
    throw new Error(
      "No se pudo consultar el catálogo de Coto. Revisá tu conexión e intentá de nuevo.",
    );
  }
  if (!res.ok) {
    throw new Error(
      "No se pudo consultar el catálogo de Coto. Intentá de nuevo más tarde.",
    );
  }
  const body = (await res.json()) as CotoAutocompleteResponse;
  return (body.sections?.Products ?? [])
    .map(mapSectionItem)
    .filter((p): p is CotoProduct => p !== null);
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
