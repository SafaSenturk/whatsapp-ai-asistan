import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Cüzdan — WhatsApp'tan yapay zekâ ile para yönetimi",
  description:
    "Harcamanı WhatsApp'tan yaz, fişin fotoğrafını çek ya da sesli söyle. Cüzdan kaydeder, kategorize eder, bütçeni takip eder.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 font-sans text-zinc-900">{children}</body>
    </html>
  );
}
