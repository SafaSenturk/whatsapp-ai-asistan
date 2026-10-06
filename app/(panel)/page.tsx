import Link from "next/link";
import { db, getSettings, missingEnv } from "@/lib/db";
import { connectionState } from "@/lib/evolution";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function count(table: "contacts" | "messages", filter?: (q: any) => any) {
  let q = db().from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

async function whatsappState(): Promise<string> {
  if (missingEnv("bot").some((k) => k.startsWith("EVOLUTION"))) return "ayarlanmadı";
  try {
    const state = await connectionState();
    return state === "open" ? "bağlı" : state;
  } catch {
    return "ulaşılamıyor";
  }
}

export default async function DashboardPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [settings, todayMessages, contacts, newLeads, waiting, wa] = await Promise.all([
    getSettings(),
    count("messages", (q) => q.gte("created_at", startOfDay.toISOString())),
    count("contacts"),
    count("contacts", (q) => q.gte("created_at", startOfDay.toISOString())),
    count("contacts", (q) => q.eq("status", "handoff")),
    whatsappState(),
  ]);

  const stats = [
    { label: "Bugünkü mesaj", value: todayMessages },
    { label: "Bugün gelen yeni kişi", value: newLeads },
    { label: "Toplam kişi", value: contacts },
    { label: "İnsan bekleyen", value: waiting, href: "/inbox?filter=handoff" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Özet</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <div className="text-sm text-zinc-500">{s.label}</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</div>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="card hover:border-emerald-600">
              {body}
            </Link>
          ) : (
            <div key={s.label} className="card">
              {body}
            </div>
          );
        })}
      </div>

      <div className="card max-w-xl space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Bot</span>
          <span className={settings.enabled ? "text-emerald-700" : "text-red-600"}>
            {settings.enabled ? "Açık" : "Kapalı"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">WhatsApp bağlantısı</span>
          <span className={wa === "bağlı" ? "text-emerald-700" : "text-amber-600"}>{wa}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Yapay zekâ anahtarı</span>
          <span className={process.env.GEMINI_API_KEY ? "text-emerald-700" : "text-amber-600"}>
            {process.env.GEMINI_API_KEY ? "tanımlı" : "ayarlanmadı"}
          </span>
        </div>
      </div>
    </div>
  );
}
