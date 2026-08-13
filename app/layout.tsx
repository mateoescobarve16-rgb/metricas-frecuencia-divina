import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Métricas Frecuencia Divina",
  description: "Panel diario de métricas de marketing y ventas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
