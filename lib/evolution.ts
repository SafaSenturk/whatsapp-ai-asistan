function config() {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!url || !key || !instance) {
    throw new Error("Evolution API ortam değişkenleri eksik");
  }
  return { url, key, instance: encodeURIComponent(instance) };
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

export async function sendText(jid: string, text: string): Promise<string | null> {
  const { instance } = config();
  const data = await call(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({ number: jid, text }),
  });
  return data?.key?.id ?? null;
}

/** Görsel/ses mesajının içeriğini base64 olarak indirir. */
export async function downloadMedia(
  messageId: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const { instance } = config();
  const data = await call(`/chat/getBase64FromMediaMessage/${instance}`, {
    method: "POST",
    body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
  });
  if (!data?.base64) return null;
  return { base64: data.base64, mimeType: data.mimetype ?? "application/octet-stream" };
}

export async function connectionState(): Promise<string> {
  const { instance } = config();
  const data = await call(`/instance/connectionState/${instance}`);
  return data?.instance?.state ?? "unknown";
}

/** Eşleştirme için güncel QR kodunu (data URL) döndürür; bağlıysa null. */
export async function connectQr(): Promise<string | null> {
  const { instance } = config();
  const data = await call(`/instance/connect/${instance}`);
  return data?.base64 ?? null;
}

export async function setWebhook(webhookUrl: string, secret: string) {
  const { instance } = config();
  return call(`/webhook/set/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        // Gizli anahtar adreste değil başlıkta taşınır; sunucu kayıtlarına düşmez.
        headers: { "x-webhook-secret": secret },
        webhookByEvents: false,
        webhookBase64: false,
        events: ["MESSAGES_UPSERT"],
      },
    }),
  });
}
