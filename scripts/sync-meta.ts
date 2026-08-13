import { sincronizarMeta } from "../lib/meta/sync";

const dias = Number(process.argv[2] ?? "3");
const hoy = new Date();
const hace = new Date(hoy.getTime() - dias * 24 * 60 * 60 * 1000);

const since = hace.toISOString().slice(0, 10);
const until = hoy.toISOString().slice(0, 10);

const resultado = await sincronizarMeta(since, until);
console.log(`Sincronizadas ${resultado.filas} filas de ${resultado.cuentas} cuentas activas (rango ${since} a ${until}).`);
