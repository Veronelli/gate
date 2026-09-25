import { SUGGESTED_PRICE_LEGEND } from "@/lib/catalog";

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function SuggestedPrice({ price }: { price: number }) {
  return (
    <span className="inline-flex flex-col">
      <span className="font-semibold">{ars.format(price)}</span>
      <span className="text-xs text-gray-500">{SUGGESTED_PRICE_LEGEND}</span>
    </span>
  );
}
