let cache: { rates: Record<string, number>; fecha: string } | null = null;
let fallo = false;

async function obtenerTasas(): Promise<Record<string, number> | null> {
  const hoy = new Date().toISOString().slice(0, 10);
  if (cache && cache.fecha === hoy) return cache.rates;
  if (fallo) return null; // ya falló una vez en esta corrida, no reintentar por cada venta

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    cache = { rates: body.rates, fecha: hoy };
    return cache.rates;
  } catch (error) {
    console.error("No se pudieron obtener tasas de cambio, se sincroniza sin price_usd:", error);
    fallo = true;
    return null;
  }
}

// Convierte un monto de "moneda" a USD usando la tasa del día de la sincronización
// (no la tasa histórica exacta del día de la venta -- suficientemente preciso para
// un panel de métricas de marketing, no para contabilidad). Si la API de tasas falla,
// devuelve null en vez de tumbar la sincronización -- guardar la venta es lo prioritario.
export async function convertirAUsd(valor: number, moneda: string): Promise<number | null> {
  if (moneda === "USD") return valor;
  const tasas = await obtenerTasas();
  if (!tasas) return null;
  const tasa = tasas[moneda];
  if (!tasa) return null;
  return valor / tasa;
}
