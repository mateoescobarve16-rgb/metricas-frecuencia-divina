import { sincronizarVentas } from "../lib/hotmart/sync.ts";

const dias = Number(process.argv[2] ?? "1");
const endDate = Date.now();
const startDate = endDate - dias * 24 * 60 * 60 * 1000;

const resultado = await sincronizarVentas(startDate, endDate);
console.log(`Sincronizadas ${resultado.insertadas} ventas de los ultimos ${dias} dia(s) (de ${resultado.total} traidas de Hotmart).`);
