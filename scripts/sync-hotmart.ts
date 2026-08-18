import { sincronizarVentas } from "../lib/hotmart/sync";
import { inicioDiaLocalComoUTC, fechaLocalDesdeUTC } from "../lib/tiempo/zonaHorariaHotmart";

// Usa limites de dia local de Hotmart (UTC-5), igual que el endpoint de produccion --
// nunca horas UTC crudas. Una version anterior de este script usaba Date.now() directo,
// lo que desalineaba la ventana de 24h contra el dia calendario real de Hotmart y
// corrompia el resumen oficial guardado para esos dias (encontrado el 2026-08-19).
const dias = Number(process.argv[2] ?? "1");
const UN_DIA_MS = 24 * 60 * 60 * 1000;

// startDate se ancla a la medianoche local de HOY (no a "ahora"), para que cada tramo de
// 24h de sincronizarResumenDiario caiga exacto en un dia calendario de Hotmart -- si se
// ancla a Date.now(), el desplazamiento de "cuantas horas van del dia de hoy" corre TODOS
// los dias anteriores fuera de su limite real, aunque el rango total cubra los mismos dias.
const hoyLocal = fechaLocalDesdeUTC(new Date().toISOString());
const inicioHoyLocalUTC = inicioDiaLocalComoUTC(hoyLocal);
const endDate = Math.min(inicioHoyLocalUTC + UN_DIA_MS, Date.now());
const startDate = inicioHoyLocalUTC - (dias - 1) * UN_DIA_MS;

const resultado = await sincronizarVentas(startDate, endDate);
console.log(`Sincronizadas ${resultado.insertadas} ventas de los ultimos ${dias} dia(s) (de ${resultado.total} traidas de Hotmart).`);
