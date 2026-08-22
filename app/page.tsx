import { obtenerResumenDiario, CATEGORIAS, restarDias, type ResumenDia } from "@/lib/resumen/diario";
import { ETIQUETAS_CATEGORIA, type CategoriaFunnel } from "@/lib/hotmart/mapeoProductos";
import { inicioDiaLocalComoUTC, fechaLocalDesdeUTC } from "@/lib/tiempo/zonaHorariaHotmart";
import GraficoDiario from "@/components/GraficoDiario";

export const dynamic = "force-dynamic";

function formatoUsd(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatoUsdPreciso(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatoNumero(valor: number) {
  return valor.toLocaleString("en-US");
}

function formatoPct(valor: number | null) {
  if (valor === null) return "—";
  return `${valor.toFixed(2)}%`;
}

function sumar(resumen: ResumenDia[], campo: (d: ResumenDia) => number) {
  return resumen.reduce((acc, d) => acc + campo(d), 0);
}

function flechaDia(actual: number | null, anterior: number | null | undefined, menorEsMejor = false) {
  if (actual === null || anterior === null || anterior === undefined) return null;
  const base = Math.max(Math.abs(anterior), 1);
  const cambio = ((actual - anterior) / base) * (menorEsMejor ? -1 : 1);
  if (Math.abs(cambio) < 0.005) return { icono: "≈", color: "var(--text-muted)" };
  return cambio > 0 ? { icono: "▲", color: "var(--positive-text)" } : { icono: "▼", color: "var(--negative-text)" };
}

function tendencia(actual: number, anterior: number): { texto: string; color: string; bg: string } {
  if (anterior <= 0) return { texto: "—", color: "var(--text-muted)", bg: "transparent" };
  const cambio = ((actual - anterior) / anterior) * 100;
  if (Math.abs(cambio) < 0.5) return { texto: "≈ igual", color: "var(--text-muted)", bg: "transparent" };
  const positivo = cambio > 0;
  return {
    texto: `${positivo ? "▲" : "▼"} ${Math.abs(cambio).toFixed(0)}%`,
    color: positivo ? "var(--positive-text)" : "var(--negative-text)",
    bg: positivo ? "var(--positive-bg)" : "var(--negative-bg)",
  };
}

const CATEGORIAS_EMBUDO = CATEGORIAS.filter((c) => c !== "miembros" && c !== "sin_clasificar");

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;

  let desde: string;
  let hastaStr: string;
  let dias: number;
  let rangoPersonalizado = false;
  const hoyLocal = fechaLocalDesdeUTC(new Date().toISOString());

  if (params.desde && params.hasta) {
    desde = params.desde;
    hastaStr = params.hasta;
    dias = Math.round((inicioDiaLocalComoUTC(hastaStr) - inicioDiaLocalComoUTC(desde)) / (24 * 60 * 60 * 1000)) + 1;
    rangoPersonalizado = true;
  } else {
    dias = Number(params.dias ?? "14");
    const hastaMs = inicioDiaLocalComoUTC(hoyLocal); // incluye hoy (con sync intradia, ya trae datos parciales)
    const desdeMs = hastaMs - (dias - 1) * 24 * 60 * 60 * 1000;
    desde = fechaLocalDesdeUTC(new Date(desdeMs).toISOString());
    hastaStr = fechaLocalDesdeUTC(new Date(hastaMs).toISOString());
  }

  const desdeAnterior = restarDias(desde, dias);
  const hastaAnterior = restarDias(desde, 1);
  const incluyeHoy = hastaStr === hoyLocal;

  const [resumen, resumenAnterior] = await Promise.all([
    obtenerResumenDiario(desde, hastaStr),
    obtenerResumenDiario(desdeAnterior, hastaAnterior),
  ]);

  const totalInversion = sumar(resumen, (d) => d.inversion);
  const totalFacturacion = sumar(resumen, (d) => d.facturacionTotal);
  const totalFacturacionNueva = sumar(resumen, (d) => d.facturacionNuevaTotal);
  const roasNuevoTotal = totalInversion > 0 ? totalFacturacionNueva / totalInversion : null;
  const roasTotal = totalInversion > 0 ? totalFacturacion / totalInversion : null;
  const totalUsuariosUnicos = sumar(resumen, (d) => d.usuariosUnicos);
  const arpuTotal = totalUsuariosUnicos > 0 ? totalFacturacion / totalUsuariosUnicos : null;
  const totalFrontEnd = sumar(resumen, (d) => d.porCategoria.front_end.conteo);
  const cpaTotal = totalFrontEnd > 0 ? totalInversion / totalFrontEnd : null;

  const invAnterior = sumar(resumenAnterior, (d) => d.inversion);
  const factAnterior = sumar(resumenAnterior, (d) => d.facturacionTotal);
  const factNuevaAnterior = sumar(resumenAnterior, (d) => d.facturacionNuevaTotal);
  const roasNuevoAnterior = invAnterior > 0 ? factNuevaAnterior / invAnterior : 0;
  const usuariosAnterior = sumar(resumenAnterior, (d) => d.usuariosUnicos);
  const arpuAnterior = usuariosAnterior > 0 ? factAnterior / usuariosAnterior : 0;
  const frontEndAnterior = sumar(resumenAnterior, (d) => d.porCategoria.front_end.conteo);
  const cpaAnterior = frontEndAnterior > 0 ? invAnterior / frontEndAnterior : 0;

  const diasConDiscrepancia = resumen.filter((d) => d.verificacion.estado === "discrepancia");
  const diasVerificados = resumen.filter((d) => d.verificacion.estado === "ok");
  const diasSinDatos = resumen.filter((d) => d.verificacion.estado === "sin_datos");
  const diasEnCurso = resumen.filter((d) => d.verificacion.estado === "en_curso");
  const diasConAnomaliaMeta = resumen.filter((d) => d.verificacionMeta.estado === "anomalia");
  // El dia de hoy no cuenta para el "X de Y dias coinciden" -- todavia no tiene con que
  // compararse, no es ni un acierto ni un fallo.
  const diasCerrados = resumen.length - diasEnCurso.length;

  const conteoPorCategoria: Record<CategoriaFunnel, number> = Object.fromEntries(
    CATEGORIAS.map((c) => [c, sumar(resumen, (d) => d.porCategoria[c].conteo)])
  ) as Record<CategoriaFunnel, number>;

  // Para la flecha dia-a-dia en la tabla: el dia anterior a cada fila casi siempre esta
  // dentro de "resumen" mismo, salvo el primero del rango, que necesita el ultimo dia de
  // "resumenAnterior" (ya lo estamos trayendo para las tendencias de las tarjetas KPI).
  const mapaPorFecha = new Map<string, ResumenDia>();
  for (const d of resumenAnterior) mapaPorFecha.set(d.fecha, d);
  for (const d of resumen) mapaPorFecha.set(d.fecha, d);

  const kpis = [
    { label: "Inversión", valor: formatoUsd(totalInversion), tend: tendencia(totalInversion, invAnterior) },
    { label: "Facturación", valor: formatoUsd(totalFacturacion), tend: tendencia(totalFacturacion, factAnterior) },
    { label: "ROAS (nuevo)", valor: roasNuevoTotal !== null ? roasNuevoTotal.toFixed(2) : "—", tend: tendencia(roasNuevoTotal ?? 0, roasNuevoAnterior) },
    { label: "ARPU", valor: formatoUsd(arpuTotal), tend: tendencia(arpuTotal ?? 0, arpuAnterior) },
    { label: "Front-end", valor: formatoNumero(totalFrontEnd), tend: tendencia(totalFrontEnd, frontEndAnterior) },
    { label: "CPA", valor: formatoUsdPreciso(cpaTotal), tend: tendencia(cpaAnterior, cpaTotal ?? 0) },
  ];

  const cardStyle: React.CSSProperties = {
    background: "var(--surface-1)",
    border: "0.5px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "1.1rem",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" };
  const valueStyle: React.CSSProperties = { fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Métricas Frecuencia Divina</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {[7, 14, 30, 90].map((n) => (
            <a
              key={n}
              href={`/?dias=${n}`}
              style={{
                fontSize: 13,
                padding: "5px 12px",
                borderRadius: "var(--radius)",
                border: `0.5px solid ${!rangoPersonalizado && n === dias ? "var(--accent)" : "var(--border-strong)"}`,
                color: !rangoPersonalizado && n === dias ? "var(--accent-text)" : "var(--text-secondary)",
                background: !rangoPersonalizado && n === dias ? "var(--accent-bg)" : "var(--surface-1)",
                textDecoration: "none",
              }}
            >
              {n}d
            </a>
          ))}
          <form
            action="/"
            method="get"
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              padding: "3px 8px",
              borderRadius: "var(--radius)",
              border: `0.5px solid ${rangoPersonalizado ? "var(--accent)" : "var(--border-strong)"}`,
              background: rangoPersonalizado ? "var(--accent-bg)" : "var(--surface-1)",
            }}
          >
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              style={{ fontSize: 12, background: "transparent", border: "none", color: "var(--text-primary)", colorScheme: "dark" }}
            />
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>a</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hastaStr}
              style={{ fontSize: 12, background: "transparent", border: "none", color: "var(--text-primary)", colorScheme: "dark" }}
            />
            <button
              type="submit"
              style={{
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 6,
                border: "0.5px solid var(--border-strong)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Ver
            </button>
          </form>
        </div>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0, marginBottom: 4 }}>
        {desde} a {hastaStr} {incluyeHoy ? "(incluye hoy en curso)" : "(día vencido)"} · vs. {desdeAnterior} a {hastaAnterior}
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 0, marginBottom: 20, maxWidth: 680 }}>
        Los conteos por etapa incluyen renovaciones de suscripción (Acompañamiento) — igual que Hotmart. Solo la
        facturación/ROAS &quot;nuevo&quot; excluye renovaciones, para juzgar si el gasto del día se pagó solo.
      </p>

      {diasConDiscrepancia.length > 0 ? (
        <div style={{ background: "var(--negative-bg)", color: "var(--negative-text)", border: "0.5px solid var(--negative)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          ⚠ {diasConDiscrepancia.length} día(s) no coinciden con los números oficiales de Hotmart, revisar:{" "}
          {diasConDiscrepancia.map((d) => d.fecha).join(", ")}
        </div>
      ) : (
        <div style={{ background: "var(--positive-bg)", color: "var(--positive-text)", border: "0.5px solid var(--positive)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          ✓ Verificado automáticamente contra Hotmart — {diasVerificados.length} de {diasCerrados} días cerrados coinciden exacto.
          {diasSinDatos.length > 0 ? ` ${diasSinDatos.length} día(s) sin dato oficial todavía.` : ""}
          {diasEnCurso.length > 0 ? ` Hoy sigue en curso, todavía no se verifica.` : ""}
        </div>
      )}

      {diasConAnomaliaMeta.length > 0 && (
        <div style={{ background: "var(--negative-bg)", color: "var(--negative-text)", border: "0.5px solid var(--negative)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, marginBottom: 24 }}>
          ⚠ Posible falla en la sincronización de Meta — la inversión cayó de golpe respecto al promedio de los 7 días anteriores en: {diasConAnomaliaMeta.map((d) => d.fecha).join(", ")}.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: diasConAnomaliaMeta.length > 0 ? 0 : 12, marginBottom: 32 }}>
        {kpis.map((k) => (
          <div key={k.label} style={cardStyle}>
            <div style={labelStyle}>{k.label}</div>
            <div style={valueStyle}>{k.valor}</div>
            <div style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 500, color: k.tend.color, background: k.tend.bg, padding: k.tend.bg !== "transparent" ? "2px 8px" : 0, borderRadius: 999 }}>
              {k.tend.texto}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)", margin: "0 0 12px" }}>Embudo</h2>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 12, minWidth: "max-content", paddingBottom: 4 }}>
          {CATEGORIAS_EMBUDO.map((c) => {
            const conteo = conteoPorCategoria[c];
            const convPct = totalFrontEnd > 0 ? (conteo / totalFrontEnd) * 100 : null;
            const cpa = conteo > 0 ? totalInversion / conteo : null;
            const esUpsell = c.startsWith("upsell");
            return (
              <div key={c} style={{ ...cardStyle, minWidth: 150, borderTop: `2px solid ${esUpsell ? "var(--positive)" : c === "front_end" ? "var(--accent)" : "var(--warning)"}` }}>
                <div style={labelStyle}>{ETIQUETAS_CATEGORIA[c]}</div>
                <div style={valueStyle}>{formatoNumero(conteo)}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>% conv.: {formatoPct(convPct)}</span>
                  <span>CPA: {formatoUsdPreciso(cpa)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <GraficoDiario datos={resumen.map((d) => ({ fecha: d.fecha, inversion: d.inversion, facturacion: d.facturacionNuevaTotal }))} />
      </div>

      <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: "var(--radius)" }}>
        <table style={{ width: "100%", fontSize: 13, whiteSpace: "nowrap", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...thGrupoStyle, position: "sticky", left: 0, zIndex: 2, textAlign: "left" }}>
                Fecha
              </th>
              <th colSpan={12} style={thGrupoStyle}>Meta Ads</th>
              <th colSpan={7} style={{ ...thGrupoStyle, borderLeft: "1px solid var(--border-strong)" }}>Embudo</th>
              <th colSpan={6} style={{ ...thGrupoStyle, borderLeft: "1px solid var(--border-strong)" }}>Resultado</th>
            </tr>
            <tr style={{ borderBottom: "0.5px solid var(--border)", background: "var(--surface-1)" }}>
              {["Inversión", "Impresiones", "Clics", "CPC", "CTR", "CPM", "Visitas LP", "Costo/Visita", "Pagos iniciados", "Costo/Pago iniciado", "Conv. checkout", "CPA"].map((h, i) => (
                <th key={h} style={{ ...thColStyle, ...(esColumnaSecundaria(h) ? { color: "var(--text-muted)", fontWeight: 400 } : {}), ...(i === 0 ? {} : {}) }}>
                  {h}
                </th>
              ))}
              {CATEGORIAS_EMBUDO.map((c, i) => (
                <th key={c} style={{ ...thColStyle, ...(i === 0 ? { borderLeft: "1px solid var(--border-strong)" } : {}) }}>
                  {ETIQUETAS_CATEGORIA[c]}
                </th>
              ))}
              {["Facturación nueva", "ROAS (nuevo)", "Facturación total", "ARPU", "ROAS total", "Lucro"].map((h, i) => (
                <th key={h} style={{ ...thColStyle, ...(i === 0 ? { borderLeft: "1px solid var(--border-strong)" } : {}) }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...resumen].reverse().map((dia, idx) => {
              const filaBg = idx % 2 === 0 ? "var(--surface-1)" : "transparent";
              const tieneAlerta = dia.verificacion.estado === "discrepancia" || dia.verificacionMeta.estado === "anomalia";
              const esHoy = dia.fecha === hoyLocal;
              const roasColor = dia.roasNuevo === null ? "var(--text-primary)" : dia.roasNuevo >= 1 ? "var(--positive-text)" : "var(--negative-text)";
              const roasBg = dia.roasNuevo === null ? "transparent" : dia.roasNuevo >= 1 ? "var(--positive-bg)" : "var(--negative-bg)";
              // Hoy esta a medio terminar: compararlo contra un dia de ayer completo daria una
              // flecha enganosa (ej. ▼ solo porque todavia no lleva la mitad del gasto del dia),
              // asi que no se le calcula tendencia dia-a-dia todavia.
              const diaAnterior = esHoy ? undefined : mapaPorFecha.get(restarDias(dia.fecha, 1));
              const flechaInversion = flechaDia(dia.inversion, diaAnterior?.inversion);
              const flechaFacturacion = flechaDia(dia.facturacionTotal, diaAnterior?.facturacionTotal);
              const flechaRoas = flechaDia(dia.roasNuevo, diaAnterior?.roasNuevo);
              const flechaLucro = flechaDia(dia.lucro, diaAnterior?.lucro);
              const flechaCpc = flechaDia(dia.cpc, diaAnterior?.cpc, true);
              const flechaCtr = flechaDia(dia.ctr, diaAnterior?.ctr);
              const flechaCpm = flechaDia(dia.cpm, diaAnterior?.cpm, true);
              const flechaCostoVisita = flechaDia(dia.costoPorVisita, diaAnterior?.costoPorVisita, true);
              const flechaCostoPago = flechaDia(dia.costoPorPagoIniciado, diaAnterior?.costoPorPagoIniciado, true);
              const flechaConversionCheckout = flechaDia(dia.conversionCheckout, diaAnterior?.conversionCheckout);
              const flechaCpa = flechaDia(dia.cpa, diaAnterior?.cpa, true);
              return (
                <tr key={dia.fecha} style={{ background: filaBg }}>
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      color: "var(--text-primary)",
                      position: "sticky",
                      left: 0,
                      background: filaBg === "transparent" ? "var(--bg)" : filaBg,
                      borderLeft: tieneAlerta ? "3px solid var(--negative)" : "3px solid transparent",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    {dia.fecha}
                    {esHoy ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          color: "var(--accent-text)",
                          background: "var(--accent-bg)",
                          borderRadius: 999,
                          padding: "1px 6px",
                        }}
                      >
                        en curso
                      </span>
                    ) : null}
                  </td>
                  <td style={tdStyle(filaBg)}>
                    {formatoUsd(dia.inversion)}
                    <Flecha f={flechaInversion} />
                  </td>
                  <td style={tdStyle(filaBg)}>{formatoNumero(dia.impresiones)}</td>
                  <td style={tdStyle(filaBg)}>{formatoNumero(dia.clics)}</td>
                  <td style={{ ...tdStyle(filaBg), color: "var(--text-muted)" }}>
                    {formatoUsdPreciso(dia.cpc)}
                    <Flecha f={flechaCpc} />
                  </td>
                  <td style={{ ...tdStyle(filaBg), color: "var(--text-muted)" }}>
                    {formatoPct(dia.ctr)}
                    <Flecha f={flechaCtr} />
                  </td>
                  <td style={{ ...tdStyle(filaBg), color: "var(--text-muted)" }}>
                    {formatoUsdPreciso(dia.cpm)}
                    <Flecha f={flechaCpm} />
                  </td>
                  <td style={tdStyle(filaBg)}>{formatoNumero(dia.landingPageViews)}</td>
                  <td style={{ ...tdStyle(filaBg), color: "var(--text-muted)" }}>
                    {formatoUsdPreciso(dia.costoPorVisita)}
                    <Flecha f={flechaCostoVisita} />
                  </td>
                  <td style={tdStyle(filaBg)}>{formatoNumero(dia.pagosIniciados)}</td>
                  <td style={{ ...tdStyle(filaBg), color: "var(--text-muted)" }}>
                    {formatoUsdPreciso(dia.costoPorPagoIniciado)}
                    <Flecha f={flechaCostoPago} />
                  </td>
                  <td style={{ ...tdStyle(filaBg), fontWeight: 500 }}>
                    {formatoPct(dia.conversionCheckout)}
                    <Flecha f={flechaConversionCheckout} />
                  </td>
                  <td style={{ ...tdStyle(filaBg), fontWeight: 500 }}>
                    {formatoUsdPreciso(dia.cpa)}
                    <Flecha f={flechaCpa} />
                  </td>
                  {CATEGORIAS_EMBUDO.map((c, i) => {
                    const conteoDia = dia.porCategoria[c].conteo;
                    const frontEndDia = dia.porCategoria.front_end.conteo;
                    const convPctDia = c !== "front_end" && frontEndDia > 0 ? (conteoDia / frontEndDia) * 100 : null;
                    return (
                      <td key={c} style={{ ...tdStyle(filaBg), ...(i === 0 ? { borderLeft: "1px solid var(--border-strong)" } : {}) }}>
                        {formatoNumero(conteoDia)}
                        {convPctDia !== null ? <span style={{ color: "var(--text-muted)", fontSize: 11 }}> ({convPctDia.toFixed(1)}%)</span> : null}
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle(filaBg), fontWeight: 500, borderLeft: "1px solid var(--border-strong)" }}>{formatoUsd(dia.facturacionNuevaTotal)}</td>
                  <td style={{ ...tdStyle(filaBg), color: roasColor, background: roasBg === "transparent" ? filaBg : roasBg, fontWeight: 500 }}>
                    {dia.roasNuevo !== null ? dia.roasNuevo.toFixed(2) : "—"}
                    <Flecha f={flechaRoas} />
                  </td>
                  <td style={tdStyle(filaBg)}>
                    {formatoUsd(dia.facturacionTotal)}
                    <Flecha f={flechaFacturacion} />
                  </td>
                  <td style={tdStyle(filaBg)}>{formatoUsd(dia.arpu)}</td>
                  <td style={tdStyle(filaBg)}>{dia.roas !== null ? dia.roas.toFixed(2) : "—"}</td>
                  <td
                    style={{
                      ...tdStyle(filaBg),
                      fontWeight: 500,
                      color: dia.lucro >= 0 ? "var(--positive-text)" : "var(--negative-text)",
                      background: dia.lucro >= 0 ? "var(--positive-bg)" : "var(--negative-bg)",
                    }}
                  >
                    {formatoUsd(dia.lucro)}
                    <Flecha f={flechaLucro} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 10 }}>
        <span style={{ borderLeft: "3px solid var(--negative)", paddingLeft: 6 }}>Barra roja a la izquierda</span> = día con alguna alerta de verificación. Celda de ROAS (nuevo) en verde/rojo según si superó 1.0 (el gasto se pagó solo) o no.
        Las flechitas (▲ ▼ ≈) comparan ese día contra el día calendario anterior. En Inversión, ROAS (nuevo), Facturación total, Lucro y CTR: ▲ verde = subió (bueno). En CPC, CPM, Costo/Visita, Costo/Pago iniciado y CPA (costos): ▲ verde = bajó (bueno) — más barato es mejor, por eso ahí la flecha va invertida.
        La etiqueta &quot;en curso&quot; marca el día de hoy: se sincroniza varias veces mientras avanza (10am, 3pm y 8pm), así que sus números son parciales — por eso no tiene flecha de tendencia todavía ni entra en la verificación contra Hotmart hasta que el día cierre.
      </p>
    </main>
  );
}

function Flecha({ f }: { f: { icono: string; color: string } | null }) {
  if (!f) return null;
  return (
    <span style={{ color: f.color, fontSize: 11, marginLeft: 5 }} title="vs. día anterior">
      {f.icono}
    </span>
  );
}

function esColumnaSecundaria(nombre: string) {
  return ["CPC", "CTR", "CPM", "Costo/Visita", "Costo/Pago iniciado"].includes(nombre);
}

const thGrupoStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  background: "var(--surface-2)",
  borderBottom: "0.5px solid var(--border)",
  textAlign: "center",
};

const thColStyle: React.CSSProperties = {
  textAlign: "right",
  padding: "8px 10px",
  color: "var(--text-secondary)",
  fontWeight: 500,
};

function tdStyle(filaBg: string): React.CSSProperties {
  return { padding: "8px 10px", textAlign: "right", borderBottom: "0.5px solid var(--border)" };
}
