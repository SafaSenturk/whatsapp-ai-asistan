import Link from "next/link";
import { logout } from "@/app/actions";
import { isAdmin, requireUser } from "@/lib/auth";
import { db, missingEnv } from "@/lib/db";
import { isPro } from "@/lib/plans";

const NAV = [
  { href: "/app", label: "Özet" },
  { href: "/app/pending", label: "Bekleyenler" },
  { href: "/app/transactions", label: "İşlemler" },
  { href: "/app/planning", label: "Planlama" },
  { href: "/app/goals", label: "Hedefler & Hesaplar" },
  { href: "/app/budgets", label: "Kovalar & Bütçe" },
  { href: "/app/assistant", label: "Asistan" },
  { href: "/app/settings", label: "Ayarlar" },
  { href: "/app/billing", label: "Plan" },
];

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const missing = missingEnv("app");
  if (missing.length) {
    return (
      <main className="p-8">
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
      </main>
    );
  }

  const user = await requireUser();
  const nav = isAdmin(user) ? [...NAV, { href: "/app/admin", label: "Yönetim" }] : NAV;
  const { count: pending } = await db()
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "expense")
    .is("bucket", null);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-zinc-200 bg-white md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/app" className="text-base font-semibold">
            👛 Cüzdan
          </Link>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isPro(user) ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {isPro(user) ? "Pro" : "Ücretsiz"}
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {item.label}
              {item.href === "/app/pending" && pending ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium tabular-nums text-amber-800">{pending}</span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden p-3 md:block">
          <p className="truncate px-1 pb-2 text-xs text-zinc-500">{user.email}</p>
          <form action={logout}>
            <button className="btn-ghost w-full">Çıkış yap</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
