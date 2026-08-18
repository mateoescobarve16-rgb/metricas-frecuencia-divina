import { sincronizarVentas } from "../lib/hotmart/sync";
import { inicioDiaLocalComoUTC } from "../lib/tiempo/zonaHorariaHotmart";

const fecha = process.argv[2];
if (!fecha) throw new Error("uso: resync-puntual.ts YYYY-MM-DD");
const inicio = inicioDiaLocalComoUTC(fecha);
const fin = inicio + 24 * 60 * 60 * 1000;
const resultado = await sincronizarVentas(inicio, fin);
console.log(`${fecha}:`, resultado);
