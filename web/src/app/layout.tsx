import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scout — Asago to the Moon",
  description: "Career cockpit for Sumika Moriwaki",
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", labelJp: "ダッシュボード" },
  { href: "/jobs", label: "Leads", labelJp: "求人" },
  { href: "/tracker", label: "Pipeline", labelJp: "進捗" },
  { href: "/orgs", label: "Organizations", labelJp: "企業" },
  { href: "/stories", label: "Stories", labelJp: "ストーリー" },
  { href: "/hype", label: "North Star", labelJp: "応援" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <nav className="w-52 shrink-0 border-r border-border bg-paper-warm/50 p-6 flex flex-col gap-1">
            <div className="mb-8">
              <h1 className="font-serif text-2xl font-light tracking-tight text-ink">Scout</h1>
              <p className="text-xs text-muted mt-1 font-light">Asago to the Moon</p>
            </div>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-light text-ink/80 hover:bg-paper-warm hover:text-ink transition-colors"
              >
                <span>{item.label}</span>
                <span className="text-[10px] text-muted">{item.labelJp}</span>
              </Link>
            ))}
          </nav>

          {/* Main content */}
          <main className="flex-1 p-12 overflow-auto max-w-4xl">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
