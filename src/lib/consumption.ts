import { listListItems, registerListCompletedHandler } from "./lists";
import { getPlace } from "./places";
import { getProduct, saveProduct } from "./products";
import { COLLECTIONS, readCollection } from "./storage";
import type { Place, Product, ShoppingList } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PLAZOS = 3;

export interface Purchase {
  productId: string;
  units: number;
}

export interface SuggestedItem {
  product: Product;
  /** 0 = recién repuesto, 1 = agotado (orden descendente). */
  score: number;
  daysRemaining: number;
  reminder: string | null;
}

/**
 * Plazo estimado entre compras: promedio ponderado del historial
 * (más peso al más reciente). Sin historial usa `refreshDays`
 * del producto o el default del place.
 */
export function estimatedIntervalDays(product: Product, place: Place): number {
  const { plazos } = product;
  if (plazos.length === 0) {
    return product.refreshDays || place.consumptionConfig.defaultRefreshDays;
  }
  let weighted = 0;
  let weights = 0;
  plazos.forEach((plazo, index) => {
    const weight = index + 1;
    weighted += plazo * weight;
    weights += weight;
  });
  return weighted / weights;
}

/** Días estimados hasta agotar las raciones actuales al ritmo de consumo. */
export function daysRemaining(product: Product, place: Place): number {
  const interval = estimatedIntervalDays(product, place);
  const reference = product.lastUnitsPurchased || 1;
  const unitsPerDay = reference / interval;
  return unitsPerDay > 0 ? product.unitsRemaining / unitsPerDay : 0;
}

/** 0 = recién repuesto, →1 = por agotarse. */
export function consumptionScore(product: Product, place: Place): number {
  const interval = estimatedIntervalDays(product, place);
  if (interval <= 0) return 1;
  return 1 - Math.min(1, Math.max(0, daysRemaining(product, place) / interval));
}

/**
 * Al finalizar una compra: registra el intervalo desde la última compra,
 * rota el historial a máx. 3 plazos y actualiza stock y referencia.
 */
export function recordPurchase(
  placeId: string,
  purchases: Purchase[],
  now: Date = new Date(),
): void {
  for (const { productId, units } of purchases) {
    const product = getProduct(placeId, productId);
    if (!product || units <= 0) continue;
    const plazos = [...product.plazos];
    if (product.lastPurchaseAt) {
      const intervalDays =
        (now.getTime() - new Date(product.lastPurchaseAt).getTime()) / DAY_MS;
      if (intervalDays > 0) {
        plazos.push(intervalDays);
        while (plazos.length > MAX_PLAZOS) plazos.shift();
      }
    }
    saveProduct({
      ...product,
      plazos,
      unitsRemaining: product.unitsRemaining + units,
      lastUnitsPurchased: units,
      lastPurchaseAt: now.toISOString(),
    });
  }
}

/** Ajuste manual de raciones restantes (recalcula con el plazo vigente). */
export function updateProductStock(
  placeId: string,
  productId: string,
  unitsRemaining: number,
): void {
  const product = getProduct(placeId, productId);
  if (!product || unitsRemaining < 0) return;
  saveProduct({ ...product, unitsRemaining });
}

function onListCompleted(list: ShoppingList): void {
  const items = listListItems(list.id);
  const checked = items.filter((i) => i.checked);
  // Si no se marcó nada al cerrar, se asume que todo se compró.
  const purchased = checked.length > 0 ? checked : items;
  recordPurchase(
    list.placeId,
    purchased.map((i) => ({ productId: i.productId, units: i.units })),
  );
}

registerListCompletedHandler(onListCompleted);

export function reminderMessage(product: Product): string {
  return `Es posible que tengas que comprar más unidades del producto "${product.name}".`;
}

/** Items a considerar para comprar, ordenados por consumo decreciente. */
export function getSuggestedItems(placeId: string): SuggestedItem[] {
  const place = getPlace(placeId);
  if (!place) return [];
  return readCollection<Product>(COLLECTIONS.products)
    .filter((p) => p.placeId === placeId)
    .map((product) => {
      const remaining = daysRemaining(product, place);
      return {
        product,
        score: consumptionScore(product, place),
        daysRemaining: remaining,
        reminder:
          remaining <= place.consumptionConfig.reminderThresholdDays
            ? reminderMessage(product)
            : null,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function getReminders(placeId: string): string[] {
  return getSuggestedItems(placeId)
    .filter((s) => s.reminder !== null)
    .map((s) => s.reminder as string);
}
