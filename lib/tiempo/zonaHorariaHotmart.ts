// La cuenta de Hotmart reporta fechas en UTC-5 (hora de Colombia). Confirmado empiricamente:
// comparando contra un export oficial de Hotmart para un dia especifico, la ventana en UTC-5
// dio exactamente el mismo numero de ventas que el export (191), mientras que agrupar por
// UTC puro daba un numero distinto (154) -- Hotmart corta "el dia" a medianoche LOCAL de la
// cuenta, no a medianoche UTC.
const HOTMART_OFFSET_HORAS = -5;
const MS_POR_HORA = 60 * 60 * 1000;

// Convierte una fecha local (YYYY-MM-DD, medianoche en UTC-5) al instante UTC correspondiente.
export function inicioDiaLocalComoUTC(fechaLocalYYYYMMDD: string): number {
  return new Date(`${fechaLocalYYYYMMDD}T00:00:00Z`).getTime() - HOTMART_OFFSET_HORAS * MS_POR_HORA;
}

// Dado un timestamp UTC (ej. fecha_venta), devuelve la fecha local (YYYY-MM-DD) en UTC-5.
export function fechaLocalDesdeUTC(fechaUTC: string): string {
  const ms = new Date(fechaUTC).getTime() + HOTMART_OFFSET_HORAS * MS_POR_HORA;
  return new Date(ms).toISOString().slice(0, 10);
}
