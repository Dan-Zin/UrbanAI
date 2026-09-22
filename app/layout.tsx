import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "leaflet/dist/leaflet.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Точка роста / T-Сити — участие граждан в благоустройстве",
  description:
    "Платформа территориально-контекстного участия: карта инициатив, ИИ-помощник, 3D-студия двора и кабинет администрации. Пилот — Таганрог.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
