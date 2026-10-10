import { parseBankEmail, type BankEmail } from "./ai";
import { BUCKETS, categoryLabel } from "./categories";
import { today } from "./dates";
import { db, type User } from "./db";
import { BUCKET_PROMPT } from "./engine";
import { money } from "./format";
import { notifyUser } from "./channels";

export const MAX_EMAILS_PER_REQUEST = 20;

export type IngestResult = {
  received: number;
  created: number;
  ignored: number;
  duplicates: number;
  /** İşlenemeyen e-postalar; script bunları bir sonraki çalışmada yeniden gönderir. */
  failedIds: string[];
};

/**
 * Banka bildirim e-postalarını işler: her e-posta bir kez ayrıştırılır, harcama/gelir olanlar
 * kovası boş ("Bekleyenler") olarak kaydedilir ve kullanıcıya bildirim gider.
 */
export async function ingestEmails(user: User, emails: (BankEmail & { id: string })[]): Promise<IngestResult> {
  const result: IngestResult = { received: emails.length, created: 0, ignored: 0, duplicates: 0, failedIds: [] };
  const created: string[] = [];

  for (const email of emails) {
    const externalId = `email:${email.id}`;
    const { data: seen } = await db()
      .from("ingested_emails")
      .select("status")
      .eq("user_id", user.id)
      .eq("external_id", externalId)
      .maybeSingle();
    if (seen) {
      result.duplicates++;
      continue;
    }

    let status: string;
    try {
      const parsed = await parseBankEmail(email, today());
      if (!parsed.isTransaction) {
        status = "ignored";
        result.ignored++;
      } else {
        const foreign = parsed.currency !== user.currency ? ` (${parsed.currency})` : "";
        const { error } = await db().from("transactions").insert({
          user_id: user.id,
          type: parsed.type,
          amount: parsed.amount,
          category: parsed.category,
          description: `${parsed.description}${foreign}`.slice(0, 120),
          occurred_on: parsed.date,
          bucket: null,
          suggested_bucket: parsed.suggestedBucket,
          source: "email",
          external_id: externalId,
        });
        // Aynı e-posta iki istekte aynı anda gelirse benzersizlik kısıtı ikinciyi durdurur.
        if (error && error.code !== "23505") throw new Error(error.message);
        status = "created";
        result.created++;
        const sign = parsed.type === "income" ? "+" : "−";
        const hint = parsed.suggestedBucket ? ` · öneri: ${BUCKETS[parsed.suggestedBucket].label}` : "";
        created.push(`${sign}${money(parsed.amount, user.currency)}${foreign} ${parsed.description || categoryLabel(parsed.category)}${parsed.type === "expense" ? hint : ""}`);
      }
    } catch (err) {
      // Kaydedilmez; script bir sonraki çalışmada yeniden dener.
      console.error("[ingest] e-posta işlenemedi:", err);
      result.failedIds.push(email.id);
      continue;
    }
    await db().from("ingested_emails").upsert({ user_id: user.id, external_id: externalId, status });
  }

  if (created.length) {
    const lines = [`💳 Bankadan ${created.length} yeni işlem:`, ...created.slice(0, 5)];
    if (created.length > 5) lines.push(`…ve ${created.length - 5} işlem daha`);
    lines.push("", `Panelde Bekleyenler'den ya da buradan kova seçebilirsin. ${BUCKET_PROMPT}`);
    try {
      await notifyUser(user, lines.join("\n"));
    } catch (err) {
      console.error("[ingest] bildirim gönderilemedi:", err);
    }
  }
  return result;
}
