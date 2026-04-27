import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formatto · Control de Entregas",
  description: "Control de programas, despachos y cumplimiento Formatto"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
