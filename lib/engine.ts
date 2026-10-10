import { parseMessage, type Media, type Parsed, type Turn } from "./ai";
import { BUCKETS, categoryLabel, type Bucket } from "./categories";
import { PERIOD_LABELS, monthStart, periodRange, today } from "./dates";
import { db, type Budget, type Channel, type ChatMessage, type Transaction, type User } from "./db";
import { money } from "./format";
import { FREE_BUDGET_LIMIT, FREE_MONTHLY_LIMIT, isPro } from "./plans";
import { averageExpense, bucketStatus, historyStart, forecast, loadPlan, monthlyIncome, pendingReceivables, type PlanData } from "./planning";
import { budgetsOf, createdThisMonth, round, summarize, transactionsBetween } from "./stats";

const HISTORY_LIMIT = 6;

export const HELP_TEXT = [
  "Merhaba! Ben Cüzdan, harcamalarını senin yerine tutarım. 👛",
  "",
  "• Harcama: \"kahve 85\", \"migros 1.240 tl\", \"dün taksi 320\"",
  "• Gelir: \"maaş yattı 45000\"",
  "• Fiş: fişin fotoğrafını gönder (Pro)",
  "• Sesli: sesli mesajla söyle (Pro)",
  "• Soru: \"bu ay ne kadar harcadım?\", \"markete ne verdim?\"",
  "• Kova: \"yaşama at\", \"mecburi\", \"serbest\" (son harcamayı kovaya koyar)",
  "• Hedefler: \"hedeflerime ne kadar kaldı?\"",
  "• Tahmin: \"ay sonunda ne kalır?\"",
  "• Bütçe: \"markete aylık 5000 bütçe koy\"",
  "• Hata mı oldu? \"geri al\" yaz, son kaydı silerim.",
].join("\n");

function appUrl(): string {
  return process.env.APP_URL?.replace(/\/+$/, "") || "";
}

function upgradeText(reason: string): string {
  const url = appUrl();
  return `${reason} Pro'ya geçerek sınırsız kullanabilirsin${url ? `: ${url}/app/billing` : "."}`;
}

/** Modelin bağlamı için kullanıcının bu ayki durumu. */
function contextText(user: User, monthTxs: Transaction[], budgets: Budget[], plan: PlanData): string {
  const c = user.currency;
  const s = summarize(monthTxs);
  const status = bucketStatus(user, monthTxs, monthlyIncome(plan.incomes));
  const lines = [
    `Gelir: ${money(s.income, c)}, Gider: ${money(s.expense, c)}`,
    "Gider kategorileri: " + s.expenseByCategory.slice(0, 8).map((x) => `${x.category} ${money(x.total, c)}`).join(", "),
    "Kovalar: " +
      status.buckets.map((b) => `${BUCKETS[b.bucket].label} %${b.pct} hedef ${money(b.target, c)} harcanan ${money(b.spent, c)}`).join("; ") +
      `; kovası seçilmemiş ${status.pendingCount} harcama (${money(status.pendingTotal, c)})`,
  ];
  if (budgets.length) lines.push("Bütçeler: " + budgets.map((b) => `${b.category} ${money(b.monthly_limit, c)}`).join(", "));
  if (plan.fixed.length) lines.push("Sabit giderler: " + plan.fixed.map((f) => `${f.name} ${money(f.amount, c)}`).join(", "));
  if (plan.incomes.length) {
    lines.push(
      "Gelir kaynakları: " +
        plan.incomes.map((i) => `${i.name} ${money(i.amount, c)} ${i.kind === "monthly" ? "aylık" : i.received ? "tahsil edildi" : `bekleniyor ${i.expected_on ?? ""}`}`).join(", "),
    );
  }
  if (plan.goals.length) lines.push("Hedefler: " + plan.goals.map((g) => `${g.name} ${money(g.saved_amount, c)}/${money(g.target_amount, c)}`).join(", "));
  if (plan.accounts.length) lines.push("Hesaplar: " + plan.accounts.map((a) => `${a.name} ${money(a.balance, c)}`).join(", "));
  return lines.join("\n");
}

async function budgetWarnings(user: User, categories: string[]): Promise<string[]> {
  const budgets = (await budgetsOf(user.id)).filter((b) => categories.includes(b.category));
  if (!budgets.length) return [];
  const { from, to } = periodRange("month");
  const s = summarize(await transactionsBetween(user.id, from, to));
  const warnings: string[] = [];
  for (const b of budgets) {
    const spent = s.expenseByCategory.find((c) => c.category === b.category)?.total ?? 0;
    const pct = Math.round((spent / b.monthly_limit) * 100);
    const label = categoryLabel(b.category);
    if (pct >= 100) {
      warnings.push(`🚨 ${label} bütçeni aştın: ${money(spent, user.currency)} / ${money(b.monthly_limit, user.currency)} (%${pct})`);
    } else if (pct >= 80) {
      warnings.push(`⚠️ ${label} bütçesinin %${pct}'ini kullandın. Kalan: ${money(round(b.monthly_limit - spent), user.currency)}`);
    }
  }
  return warnings;
}

const SOURCE_BY_MEDIA = { image: "receipt", audio: "voice" } as const;

export const BUCKET_PROMPT = "Kovası için \"mecburi\", \"yaşam\" ya da \"serbest\" yaz.";

async function addTransactions(user: User, parsed: Parsed, media: Media | null | undefined, channel: Channel) {
  if (!isPro(user)) {
    const used = await createdThisMonth(user.id, monthStart(today()));
    if (used + parsed.transactions.length > FREE_MONTHLY_LIMIT) {
      return upgradeText(`Ücretsiz planda ayda ${FREE_MONTHLY_LIMIT} işlem kaydedebilirsin, bu ayki hakkın doldu.`);
    }
  }

  const source = media ? SOURCE_BY_MEDIA[media.kind] : channel;
  const rows = parsed.transactions.map((t) => ({
    user_id: user.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    description: t.description,
    occurred_on: t.date,
    bucket: t.bucket,
    suggested_bucket: t.bucket,
    source,
  }));
  const { error } = await db().from("transactions").insert(rows);
  if (error) throw new Error(`İşlem kaydedilemedi: ${error.message}`);

  const lines = parsed.transactions.map((t) => {
    const sign = t.type === "income" ? "+" : "−";
    const when = t.date === today() ? "" : ` · ${t.date.split("-").reverse().join(".")}`;
    const bucket = t.type === "expense" && t.bucket ? ` → ${BUCKETS[t.bucket].label}` : "";
    return `${sign}${money(t.amount, user.currency)} ${t.description || categoryLabel(t.category)} (${categoryLabel(t.category)})${when}${bucket}`;
  });
  const unbucketed = parsed.transactions.some((t) => t.type === "expense" && !t.bucket);
  const head = lines.length > 1 ? `✅ ${lines.length} kayıt eklendi:` : "✅ Kaydedildi:";
  const warnings = await budgetWarnings(
    user,
    parsed.transactions.filter((t) => t.type === "expense").map((t) => t.category),
  );
  return [head, ...lines, ...warnings, ...(unbucketed ? [`⏳ ${BUCKET_PROMPT}`] : [])].join("\n");
}

async function answerQuery(user: User, q: Parsed["query"]) {
  const { from, to } = periodRange(q.period);
  let txs = await transactionsBetween(user.id, from, to);
  const label = PERIOD_LABELS[q.period];

  if (q.category) {
    txs = txs.filter((t) => t.category === q.category);
    const total = round(txs.reduce((s, t) => s + t.amount, 0));
    const lines = [`📊 ${label} ${categoryLabel(q.category)}: ${money(total, user.currency)} (${txs.length} işlem)`];
    if (q.period === "month") {
      const budget = (await budgetsOf(user.id)).find((b) => b.category === q.category);
      if (budget) {
        const pct = Math.round((total / budget.monthly_limit) * 100);
        lines.push(`Bütçe: ${money(budget.monthly_limit, user.currency)} · %${pct} kullanıldı`);
      }
    }
    for (const t of txs.slice(0, 5)) {
      lines.push(`• ${t.occurred_on.split("-").reverse().slice(0, 2).join(".")} ${t.description || "—"} ${money(t.amount, user.currency)}`);
    }
    return lines.join("\n");
  }

  const s = summarize(txs);
  if (s.count === 0) return `${label} için kayıtlı işlem yok.`;
  const net = round(s.income - s.expense);
  const lines = [`📊 ${label}`];
  if (q.type !== "income") lines.push(`Gider: ${money(s.expense, user.currency)}`);
  if (q.type !== "expense") lines.push(`Gelir: ${money(s.income, user.currency)}`);
  if (q.type === "both" || (s.income > 0 && q.type !== "income")) {
    lines.push(`Net: ${net >= 0 ? "+" : "−"}${money(Math.abs(net), user.currency)}`);
  }
  const cats = q.type === "income" ? s.incomeByCategory : s.expenseByCategory;
  if (cats.length) {
    lines.push("", "En çok:");
    for (const c of cats.slice(0, 5)) lines.push(`• ${categoryLabel(c.category)}: ${money(c.total, user.currency)}`);
  }
  return lines.join("\n");
}

async function undoLast(user: User) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await db()
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return "Son 24 saatte silinecek bir kayıt bulamadım.";
  await db().from("transactions").delete().eq("id", data.id).eq("user_id", user.id);
  return `🗑️ Silindi: ${money(Number(data.amount), user.currency)} ${data.description || categoryLabel(data.category)}`;
}

async function setBudget(user: User, budget: NonNullable<Parsed["budget"]>) {
  if (!isPro(user)) {
    const existing = await budgetsOf(user.id);
    const isNew = !existing.some((b) => b.category === budget.category);
    if (isNew && existing.length >= FREE_BUDGET_LIMIT) {
      return upgradeText(`Ücretsiz planda en fazla ${FREE_BUDGET_LIMIT} kategoriye bütçe koyabilirsin.`);
    }
  }
  const { error } = await db()
    .from("budgets")
    .upsert({ user_id: user.id, category: budget.category, monthly_limit: budget.amount });
  if (error) throw new Error(`Bütçe kaydedilemedi: ${error.message}`);
  return `🎯 ${categoryLabel(budget.category)} için aylık bütçe: ${money(budget.amount, user.currency)}. %80'e gelince ve aşınca haber vereceğim.`;
}

/** Son kovasız harcamayı (yoksa son 24 saatteki harcamayı) kovaya koyar. */
export async function assignBucket(user: User, bucket: Bucket) {
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const base = () =>
    db().from("transactions").select("*").eq("user_id", user.id).eq("type", "expense").order("created_at", { ascending: false }).limit(1);
  let { data } = await base().is("bucket", null).gte("created_at", week).maybeSingle();
  if (!data) ({ data } = await base().gte("created_at", day).maybeSingle());
  if (!data) return "Kovaya koyulacak yeni bir harcama bulamadım.";
  await db().from("transactions").update({ bucket }).eq("id", data.id).eq("user_id", user.id);
  const { count } = await db()
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "expense")
    .is("bucket", null);
  const rest = count ? `\n⏳ ${count} harcama daha kova bekliyor.` : "";
  return `👌 ${money(Number(data.amount), user.currency)} ${data.description || categoryLabel(data.category)} → ${BUCKETS[bucket].label}${rest}`;
}

const BUCKET_WORDS: Record<string, Bucket> = { mecburi: "needs", yaşam: "life", yasam: "life", serbest: "free" };

async function goalsReply(user: User, plan: PlanData) {
  const c = user.currency;
  if (!plan.goals.length) return "Henüz hedef eklemedin. Panelde Hedefler sayfasından tatil, ekipman ya da acil durum fonu ekleyebilirsin.";
  const lines = ["🎯 Hedeflerin"];
  for (const g of plan.goals) {
    const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
    const left = round(g.target_amount - g.saved_amount);
    lines.push(left <= 0 ? `✅ ${g.name}: tamamlandı (${money(g.target_amount, c)})` : `• ${g.name}: %${pct} · ${money(left, c)} kaldı`);
  }
  return lines.join("\n");
}

async function forecastReply(user: User, plan: PlanData) {
  const c = user.currency;
  const { from, to } = periodRange("month");
  const past = await transactionsBetween(user.id, historyStart(), to);
  const month = summarize(past.filter((t) => t.occurred_on >= from));
  const rows = forecast({ plan, avgExpense: averageExpense(past), monthActual: { income: month.income, expense: month.expense }, months: 3 });
  if (!plan.incomes.length && !plan.fixed.length && !past.length) {
    return "Tahmin için panelde gelir kaynaklarını ve sabit giderlerini eklemelisin.";
  }
  const lines = ["🔮 Tahmin"];
  for (const r of rows) {
    const name = new Date(`${r.month}-01T00:00:00Z`).toLocaleDateString("tr-TR", { month: "long", timeZone: "UTC" });
    lines.push(`• ${name}: gelir ${money(r.income, c)}, gider ${money(round(r.fixed + r.variable), c)} → ${r.left >= 0 ? "kalan" : "açık"} ${money(Math.abs(r.left), c)}`);
  }
  const pending = pendingReceivables(plan.incomes);
  if (pending.length) lines.push("", `Bekleyen tahsilat: ${pending.map((p) => `${p.name} ${money(p.amount, c)}`).join(", ")}`);
  return lines.join("\n");
}

export async function recentTurns(userId: string, channel: Channel): Promise<Turn[]> {
  const { data } = await db()
    .from("chat_messages")
    .select("role, body")
    .eq("user_id", userId)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  return ((data ?? []) as Pick<ChatMessage, "role" | "body">[])
    .reverse()
    .map((r) => ({ role: r.role, text: r.body }));
}

/**
 * Kullanıcının mesajını işler ve gönderilecek cevabı döndürür.
 * WhatsApp webhook'u ve web'deki asistan sohbeti aynı akışı kullanır.
 */
export async function handleUserMessage(
  user: User,
  input: { text: string; media?: Media | null; channel: Channel; history: Turn[] },
): Promise<string> {
  const text = input.text.trim();
  const lower = text.toLocaleLowerCase("tr");
  if (!input.media && ["yardım", "yardim", "help", "?"].includes(lower)) return HELP_TEXT;
  if (!input.media && ["geri al", "sil", "iptal"].includes(lower)) return undoLast(user);
  if (!input.media && BUCKET_WORDS[lower]) return assignBucket(user, BUCKET_WORDS[lower]);

  if (input.media && !isPro(user)) {
    return upgradeText(
      input.media.kind === "image"
        ? "Fiş fotoğrafından kayıt Pro planda. Şimdilik tutarı yazarak ekleyebilirsin (örn. \"migros 1240\")."
        : "Sesli mesajla kayıt Pro planda. Şimdilik yazarak ekleyebilirsin (örn. \"taksi 320\").",
    );
  }

  const { from, to } = periodRange("month");
  const [monthTxs, budgets, plan] = await Promise.all([transactionsBetween(user.id, from, to), budgetsOf(user.id), loadPlan(user.id)]);

  const parsed = await parseMessage({
    text,
    media: input.media,
    history: input.history,
    today: today(),
    currency: user.currency,
    context: contextText(user, monthTxs, budgets, plan),
  });

  switch (parsed.intent) {
    case "add":
      return addTransactions(user, parsed, input.media, input.channel);
    case "query":
      return answerQuery(user, parsed.query);
    case "undo":
      return undoLast(user);
    case "set_budget":
      return parsed.budget
        ? setBudget(user, parsed.budget)
        : "Bütçeyi anlayamadım. Örnek: \"markete aylık 5000 bütçe koy\"";
    case "assign_bucket":
      return parsed.bucket ? assignBucket(user, parsed.bucket) : `Hangi kova? ${BUCKET_PROMPT}`;
    case "goals":
      return goalsReply(user, plan);
    case "forecast":
      return forecastReply(user, plan);
    case "help":
      return HELP_TEXT;
    default:
      return parsed.reply || "Bunu tam anlayamadım. Harcamayı \"kahve 85\" gibi yazabilir ya da \"yardım\" diyebilirsin.";
  }
}
