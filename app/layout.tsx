import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Cüzdan — yapay zekâ destekli kişisel finans paneli",
  description:
    "Banka harcamaların kendiliğinden düşer, 50/30/20 kovalarıyla bütçeni yönetirsin; Telegram ve WhatsApp asistanıyla fiş at, soru sor, ay sonunu önceden gör.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 font-sans text-zinc-900">{children}</body>
    </html>
  );
}
