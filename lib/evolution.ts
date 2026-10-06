function config() {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!url || !key || !instance) {
    throw new Error("Evolution API ortam değişkenleri eksik");
  }
  return { url, key, instance };
}

async function call(path: string, init?: RequestInit) {
  const { url, key } = config();
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", apikey: key },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Evolution API ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Mesajı gönderir, WhatsApp mesaj kimliğini döndürür. */
export async function sendText(jid: string, text: string): Promise<string | null> {
  const { instance } = config();
  const data = await call(`/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({ number: jid, text }),
  });
  return data?.key?.id ?? null;
}

export async function connectionState(): Promise<string> {
  const { instance } = config();
  const data = await call(
    `/instance/connectionState/${encodeURIComponent(instance)}`,
  );
  return data?.instance?.state ?? "unknown";
}

/** Evolution'a gelen mesajları bu uygulamanın webhook adresine yollamasını söyler. */
export async function setWebhook(webhookUrl: string) {
  const { instance } = config();
  return call(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: ["MESSAGES_UPSERT"],
      },
    }),
  });
}
