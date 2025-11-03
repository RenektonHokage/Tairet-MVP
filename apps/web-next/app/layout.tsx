import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tairet",
  description: "MVP Tairet - Sistema de gestión de eventos y reservas",
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

