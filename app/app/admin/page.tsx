import { setPlan } from "@/app/actions";
import WebhookButton from "@/components/WebhookButton";
import WhatsappConnect from "@/components/WhatsappConnect";
import { requireAdmin } from "@/lib/auth";
import { db, missingEnv, type User } from "@/lib/db";
import { isPro } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: PageProps<"/app/admin">) {
  await requireAdmin();
  const q = String((await searchParams).q ?? "").trim().toLowerCase();
  let query = db()
    .from("users")
    .select("id, email, name, plan, plan_until, wa_phone, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike("email", `%${q.replace(/[%_]/g, "")}%`);

  const [{ data }, { count: total }, { count: linked }, { data: proRows }] = await Promise.all([
    query,
    db().from("users").select("id", { count: "exact", head: true }),
    db().from("users").select("id", { count: "exact", head: true }).not("wa_jid", "is", null),
    db().from("users").select("plan, plan_until").eq("plan", "pro"),
  ]);
  const users = (data ?? []) as User[];
  const proCount = ((proRows ?? []) as User[]).filter((u) => isPro(u)).length;
  const whatsappReady = missingEnv("whatsapp").length === 0;

  const stats = [
    { label: "Kullanıcı", value: total ?? 0 },
    { label: "WhatsApp bağlı", value: linked ?? 0 },
    { label: "Aktif Pro", value: proCount },
    { label: "Dönüşüm", value: total ? `%${Math.round((proCount / total) * 100)}` : "—" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Yönetim</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="text-sm text-zinc-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="card space-y-4">
        <h2 className="font-semibold">Bot WhatsApp numarası</h2>
        {whatsappReady ? (
          <>
            <WhatsappConnect />
            <WebhookButton />
          </>
        ) : (
          <p className="text-sm text-zinc-600">Eksik ortam değişkenleri: {missingEnv("whatsapp").join(", ")}</p>
        )}
        {missingEnv("ai").length > 0 && <p className="text-sm text-amber-700">GEMINI_API_KEY tanımlı değil.</p>}
      </section>

      <section className="card p-0">
        <form className="flex gap-2 border-b border-zinc-100 p-4">
          <input name="q" defaultValue={q} placeholder="E-posta ara" className="input max-w-xs" />
          <button className="btn-ghost">Ara</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">E-posta</th>
                <th className="px-2 py-2 font-medium">WhatsApp</th>
                <th className="px-2 py-2 font-medium">Plan</th>
                <th className="px-2 py-2 font-medium">Kayıt</th>
                <th className="px-4 py-2 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">
                    {u.email}
                    {u.name && <span className="text-zinc-500"> · {u.name}</span>}
                  </td>
                  <td className="px-2 py-2 text-zinc-600">{u.wa_phone ? `+${u.wa_phone}` : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {isPro(u) ? `Pro${u.plan_until ? ` · ${new Date(u.plan_until).toLocaleDateString("tr-TR")}` : ""}` : "Ücretsiz"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-zinc-500">{new Date(u.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <form action={setPlan}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="plan" value="pro" />
                        <input type="hidden" name="days" value="31" />
                        <button className="btn-ghost whitespace-nowrap px-2 py-1 text-xs">+1 ay Pro</button>
                      </form>
                      <form action={setPlan}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="plan" value="pro" />
                        <input type="hidden" name="days" value="366" />
                        <button className="btn-ghost whitespace-nowrap px-2 py-1 text-xs">+1 yıl Pro</button>
                      </form>
                      {isPro(u) && (
                        <form action={setPlan}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="plan" value="free" />
                          <button className="btn-ghost whitespace-nowrap px-2 py-1 text-xs">Ücretsize al</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
