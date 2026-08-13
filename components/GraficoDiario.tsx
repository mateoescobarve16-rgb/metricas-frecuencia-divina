"use client";

import { useEffect, useRef } from "react";
import { Chart, type ChartConfiguration } from "chart.js/auto";

type Punto = { fecha: string; inversion: number; facturacion: number };

export default function GraficoDiario({ datos }: { datos: Punto[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const config: ChartConfiguration = {
      type: "line",
      data: {
        labels: datos.map((d) => d.fecha.slice(5)),
        datasets: [
          {
            label: "Inversión",
            data: datos.map((d) => d.inversion),
            borderColor: "#2a78d6",
            backgroundColor: "#2a78d6",
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.2,
          },
          {
            label: "Facturación",
            data: datos.map((d) => d.facturacion),
            borderColor: "#1baf7a",
            backgroundColor: "#1baf7a",
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `$${Number(v).toLocaleString("en-US")}` },
            grid: { color: "rgba(128,128,128,0.15)" },
          },
          x: {
            grid: { display: false },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
  }, [datos]);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12, color: "var(--text-secondary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#2a78d6", display: "inline-block" }} />
          Inversión
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#1baf7a", display: "inline-block" }} />
          Facturación
        </span>
      </div>
      <div style={{ position: "relative", width: "100%", height: 260 }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Gráfico de línea de inversión publicitaria vs facturación por día"
        />
      </div>
    </div>
  );
}
