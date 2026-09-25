import { canWritePlace, getPlace, getPlaceRole } from "./places";
import { COLLECTIONS, readCollection, updateCollection } from "./storage";
import type { CatalogProduct } from "./dia";
import type { Product } from "./types";

export type ProductsResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const fail = <T>(error: string): ProductsResult<T> => ({ ok: false, error });
const ok = <T>(value: T): ProductsResult<T> => ({ ok: true, value });

const readProducts = () => readCollection<Product>(COLLECTIONS.products);

/** Producto único por `id` dentro del place. */
export function getProduct(
  placeId: string,
  productId: string,
): Product | null {
  return (
    readProducts().find(
      (p) => p.placeId === placeId && p.id === productId,
    ) ?? null
  );
}

export function listPlaceProducts(
  placeId: string,
  userId: string,
): Product[] {
  if (getPlaceRole(placeId, userId) === null) return [];
  return readProducts().filter((p) => p.placeId === placeId);
}

/**
 * Registra un producto del place a partir de un resultado de búsqueda.
 * Si el `id` ya existe en el place, reutiliza el existente (sin duplicar).
 */
export function addProductFromSearch(
  placeId: string,
  byUserId: string,
  result: CatalogProduct,
  options?: { refreshDays?: number; unitsRemaining?: number },
): ProductsResult<Product> {
  const place = getPlace(placeId);
  if (!place) return fail("El lugar no existe.");
  if (!canWritePlace(placeId, byUserId)) {
    return fail("Necesitás permiso de escritura para agregar productos.");
  }
  const existing = getProduct(placeId, result.id);
  if (existing) return ok(existing);
  const product: Product = {
    id: result.id,
    placeId,
    name: result.name,
    brand: result.brand,
    imageUrl: result.imageUrl,
    suggestedPrice: result.suggestedPrice,
    refreshDays:
      options?.refreshDays ?? place.consumptionConfig.defaultRefreshDays,
    unitsRemaining: options?.unitsRemaining ?? 0,
    lastUnitsPurchased: 0,
    plazos: [],
    lastPurchaseAt: null,
    stockUpdatedAt: null,
  };
  updateCollection<Product>(COLLECTIONS.products, (items) => [
    ...items,
    product,
  ]);
  return ok(product);
}

/** Edita las variables de consumo del producto (refresco y raciones restantes). */
export function updateProductVariables(
  placeId: string,
  byUserId: string,
  productId: string,
  changes: { refreshDays?: number; unitsRemaining?: number },
): ProductsResult<Product> {
  if (!canWritePlace(placeId, byUserId)) {
    return fail("Necesitás permiso de escritura para editar productos.");
  }
  const product = getProduct(placeId, productId);
  if (!product) return fail("El producto no existe en este lugar.");
  if (
    (changes.refreshDays !== undefined && changes.refreshDays <= 0) ||
    (changes.unitsRemaining !== undefined && changes.unitsRemaining < 0)
  ) {
    return fail("Los valores deben ser positivos.");
  }
  const updated: Product = {
    ...product,
    ...changes,
    // Rebasar el descuento de raciones desde el ajuste manual.
    ...(changes.unitsRemaining !== undefined
      ? { stockUpdatedAt: new Date().toISOString() }
      : {}),
  };
  updateCollection<Product>(COLLECTIONS.products, (items) =>
    items.map((p) =>
      p.placeId === placeId && p.id === productId ? updated : p,
    ),
  );
  return ok(updated);
}

/** Uso interno del motor de consumo: persiste campos calculados del producto. */
export function saveProduct(product: Product): void {
  updateCollection<Product>(COLLECTIONS.products, (items) =>
    items.map((p) =>
      p.placeId === product.placeId && p.id === product.id ? product : p,
    ),
  );
}
