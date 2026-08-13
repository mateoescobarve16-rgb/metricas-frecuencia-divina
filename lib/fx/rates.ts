let cache: Record<string, number> | null = null;

// Se llama UNA vez antes de convertir un lote de ventas, para no disparar N peticiones
// idénticas en paralelo (eso causaba que la API de tasas rechazara casi todas). Si falla,
// deja cache en null: convertirAUsd devolverá null para todo el lote en vez de tumbar
// la sincronización -- guardar la venta es lo prioritario, price_usd es secundario.
export async function precargarTasas(): Promise<void> {
  if (cache) return;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    cache = body.rates;
  } catch (error) {
    console.error("No se pudieron obtener tasas de cambio, se sincroniza sin price_usd:", error);
    cache = {};
  }
}

// Convierte un monto de "moneda" a USD usando la tasa del día de la sincronización
// (no la tasa histórica exacta del día de la venta -- suficientemente preciso para
// un panel de métricas de marketing, no para contabilidad). Requiere haber llamado
// precargarTasas() antes.
export function convertirAUsd(valor: number, moneda: string): number | null {
  if (moneda === "USD") return valor;
  if (!cache) return null;
  const tasa = cache[moneda];
  if (!tasa) return null;
  return valor / tasa;
}
