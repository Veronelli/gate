import type { Metadata } from "next";
import { Cal_Sans } from "next/font/google";
import "./globals.css";

const calSans = Cal_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-cal-sans",
});

export const metadata: Metadata = {
  title: "food2check",
  description: "Listas de compras compartidas con seguimiento de consumo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={calSans.variable}>{children}</body>
    </html>
  );
}
