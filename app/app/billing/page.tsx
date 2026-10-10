import { requireUser } from "@/lib/auth";
import { monthStart, today } from "@/lib/dates";
import { FREE_MONTHLY_LIMIT, PLANS, isPro } from "@/lib/plans";
import { createdThisMonth } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await requireUser();
  const pro = isPro(user);
  const used = await createdThisMonth(user.id, monthStart(today()));
  const checkout = process.env.CHECKOUT_URL;
  const checkoutHref = checkout
    ? `${checkout}${checkout.includes("?") ? "&" : "?"}email=${encodeURIComponent(user.email)}`
    : null;
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Plan</h1>

      <div className="card space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Mevcut plan</span>
          <strong>{pro ? PLANS.pro.name : PLANS.free.name}</strong>
        </div>
        {pro && user.plan_until && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Bitiş</span>
            <span>{new Date(user.plan_until).toLocaleDateString("tr-TR")}</span>
          </div>
        )}
        {!pro && (
          <div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Bu ay kullanılan</span>
              <span className="tabular-nums">
                {used} / {FREE_MONTHLY_LIMIT} işlem
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (used / FREE_MONTHLY_LIMIT) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["free", "pro"] as const).map((key) => {
          const plan = PLANS[key];
          const current = (key === "pro") === pro;
          return (
            <div key={key} className={`card flex flex-col ${key === "pro" ? "border-2 border-emerald-600" : ""}`}>
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <div className="mt-1 text-2xl font-bold">{plan.price}</div>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              {current ? (
                <span className="btn-ghost mt-6 cursor-default py-2">Mevcut planın</span>
              ) : key === "pro" && checkoutHref ? (
                <a href={checkoutHref} className="btn mt-6">Pro&apos;ya geç</a>
              ) : key === "pro" ? (
                <a href={contact ? `mailto:${contact}?subject=Cüzdan Pro` : "#"} className="btn mt-6">
                  Pro için iletişime geç
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
      {!pro && checkoutHref && (
        <p className="text-sm text-zinc-500">
          Ödemede bu hesabın e-postasını ({user.email}) kullan; Pro, ödeme onaylandıktan sonra hesabına tanımlanır.
        </p>
      )}
    </div>
  );
}
