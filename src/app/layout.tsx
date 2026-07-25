import type { Metadata } from "next";
import { Cairo, El_Messiri, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store/StoreProvider";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const messiri = El_Messiri({
  variable: "--font-messiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "معالي أبها ١٤٤٨هـ",
  description: "منصّة إدارة الرحلات التربويّة — من مرتفعات عسير.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${messiri.variable} ${playfair.variable} ${jetbrains.variable} antialiased`}
    >
      <body className="min-h-screen bg-bg text-text">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
