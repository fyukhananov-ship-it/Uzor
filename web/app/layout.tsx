import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

const serif = Source_Serif_4({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: {
    default: "Узор — язык, на котором можно описать паттерны пары",
    template: "%s — Узор",
  },
  description:
    "Узор — инструмент совместной рефлексии для пар. Нумерология как язык наблюдения, не как система веры.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Узор",
    description:
      "Язык, на котором можно описать, почему у вас снова тот же разговор.",
    type: "website",
    locale: "ru_RU",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F3ED" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1916" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-screen flex flex-col">
        <header className="py-6 border-b border-line/60">
          <div className="container-prose flex items-center justify-between">
            <Link href="/" className="font-serif text-lg tracking-tight hover:text-ink-muted">
              Узор
            </Link>
            <nav className="text-sm text-ink-muted flex gap-6">
              <Link href="/about" className="hover:text-ink">О продукте</Link>
              <Link href="/pricing" className="hover:text-ink">Тарифы</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="py-10 border-t border-line/60 mt-16">
          <div className="container-prose text-sm text-ink-faint flex flex-col gap-3 sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} Узор</span>
            <nav className="flex gap-5">
              <Link href="/privacy" className="hover:text-ink">Политика</Link>
              <Link href="/terms" className="hover:text-ink">Условия</Link>
              <Link href="/ios-waitlist" className="hover:text-ink">iOS-лист ожидания</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
