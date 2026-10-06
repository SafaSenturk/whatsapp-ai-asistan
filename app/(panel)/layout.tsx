import Link from "next/link";
import { logout } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { missingEnv } from "@/lib/db";

const NAV = [
  { href: "/", label: "Özet" },
  { href: "/inbox", label: "Gelen Kutusu" },
  { href: "/leads", label: "Kişiler" },
  { href: "/settings", label: "Bot Ayarları" },
  { href: "/test", label: "Botu Dene" },
];

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  await requireAuth();
  const missing = missingEnv("panel");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-zinc-200 bg-white md:w-56 md:border-b-0 md:border-r">
        <div className="px-5 py-4 text-base font-semibold">WhatsApp Bot</div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="mt-auto hidden p-3 md:block">
          <button className="btn-ghost w-full">Çıkış yap</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        {missing.length ? (
          <div className="card max-w-xl">
            <h1 className="text-lg font-semibold">Kurulum tamamlanmadı</h1>
            <p className="mt-1 text-sm text-zinc-600">
              <code>.env.local</code> dosyasında şu değerler eksik:
            </p>
            <ul className="mt-3 list-disc pl-5 font-mono text-sm">
              {missing.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
