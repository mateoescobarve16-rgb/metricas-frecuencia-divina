export type TasasCambio = Record<string, number>;

// Se llama UNA vez al inicio de cada corrida de sincronización (nunca por cada venta
// individual, eso disparaba N peticiones idénticas en paralelo y la API las rechazaba).
// No guarda estado entre invocaciones del cron -- cada corrida pide las tasas frescas,
// para no quedar nunca atascado con un resultado fallido de una corrida anterior.
export async function obtenerTasas(): Promise<TasasCambio | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    return body.rates ?? null;
  } catch (error) {
    console.error("No se pudieron obtener tasas de cambio, se sincroniza sin price_usd:", error);
    return null;
  }
}

// Convierte un monto de "moneda" a USD usando la tasa del día de la sincronización
// (no la tasa histórica exacta del día de la venta -- suficientemente preciso para
// un panel de métricas de marketing, no para contabilidad).
export function convertirAUsd(valor: number, moneda: string, tasas: TasasCambio | null): number | null {
  if (moneda === "USD") return valor;
  if (!tasas) return null;
  const tasa = tasas[moneda];
  if (!tasa) return null;
  return valor / tasa;
}
