import { GoogleGenAI } from "@google/genai";
import type { BotSettings } from "./db";

export type Turn = { role: "customer" | "business"; text: string };

const HANDOFF_TAG = "[DEVRET]";
const FALLBACK_MODEL = "gemini-flash-lite-latest";

function systemPrompt(s: BotSettings): string {
  return [
    `Sen ${s.business_name || "bir işletme"} adına WhatsApp'tan müşterilere cevap veren asistansın.`,
    "",
    "İşletme bilgileri (tek doğru bilgi kaynağın):",
    s.business_info || "(Henüz işletme bilgisi girilmedi.)",
    "",
    `Üslup: ${s.tone}`,
    "",
    "Kurallar:",
    "- WhatsApp mesajı yazıyorsun: kısa yaz, en fazla birkaç cümle. Markdown, başlık veya madde işareti kullanma.",
    "- Yalnızca yukarıdaki işletme bilgilerine dayan. Bilgilerde olmayan fiyat, stok, tarih veya söz uydurma.",
    "- Müşterinin dilinde cevap ver.",
    `- Cevabını bilmediğin bir şey sorulursa, müşteri bir insanla görüşmek isterse, şikâyet ederse ya da sipariş/ödeme gibi senin tamamlayamayacağın bir işlem isterse cevabının en başına ${HANDOFF_TAG} yaz ve konuyu ekibe ilettiğini kısaca söyle.`,
    "- Bir yapay zekâ asistanı olduğun sorulursa dürüstçe söyle.",
  ].join("\n");
}

export async function generateReply(
  settings: BotSettings,
  history: Turn[],
): Promise<{ text: string; handoff: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY eksik");

  const ai = new GoogleGenAI({ apiKey });
  const primary = settings.model || "gemini-flash-latest";
  // Model yoğunken (503/429) yedek modele geçer. Başarısız istek ~8 sn sürdüğü için
  // asıl model yeniden denenmez; müşteri fazla bekletilmez.
  const attempts = primary === FALLBACK_MODEL ? [primary, primary] : [primary, FALLBACK_MODEL];

  let raw = "";
  for (let i = 0; i < attempts.length; i++) {
    try {
      const response = await ai.models.generateContent({
        model: attempts[i],
        contents: history.map((t) => ({
          role: t.role === "customer" ? "user" : "model",
          parts: [{ text: t.text }],
        })),
        config: {
          systemInstruction: systemPrompt(settings),
          temperature: 0.5,
          maxOutputTokens: 1024,
        },
      });
      raw = (response.text ?? "").trim();
      break;
    } catch (err) {
      const status = (err as { status?: number }).status;
      const retryable = status === 503 || status === 429 || status === 500;
      if (!retryable || i === attempts.length - 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const handoff = raw.includes(HANDOFF_TAG);
  const text = raw.replaceAll(HANDOFF_TAG, "").trim();
  return { text, handoff };
}
