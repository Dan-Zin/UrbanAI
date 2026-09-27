import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "leaflet/dist/leaflet.css";
import { THEME_BOOT } from "@/lib/theme";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Благоустройство · Таганрог",
  description:
    "Платформа территориально-контекстного участия: карта инициатив, ИИ-помощник, 3D-студия двора и кабинет администрации. Пилот — Таганрог.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {children}
      </body>
    </html>
  );
}
