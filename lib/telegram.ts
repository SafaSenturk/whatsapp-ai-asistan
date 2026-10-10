function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN tanımlı değil");
  return t;
}

function base(): string {
  // TELEGRAM_API_URL yalnızca testlerde sahte sunucuya yönlendirmek için kullanılır.
  return (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/+$/, "");
}

async function call(method: string, body: object) {
  const res = await fetch(`${base()}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(`Telegram ${method} ${res.status}: ${data?.description ?? "bilinmeyen hata"}`);
  }
  return data.result;
}

export async function sendTelegram(chatId: string, text: string): Promise<string | null> {
  const result = await call("sendMessage", { chat_id: chatId, text });
  return result?.message_id ? `tg:${chatId}:${result.message_id}` : null;
}

/** Fotoğraf/ses dosyasını indirir. Telegram botlara 20 MB'a kadar dosya verir. */
export async function downloadTelegramFile(fileId: string): Promise<{ base64: string; mimeType: string } | null> {
  const file = await call("getFile", { file_id: fileId });
  if (!file?.file_path) return null;
  const res = await fetch(`${base()}/file/bot${token()}/${file.file_path}`, { cache: "no-store" });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = String(file.file_path).split(".").pop()?.toLowerCase();
  const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "oga" || ext === "ogg" ? "audio/ogg" : ext === "mp3" ? "audio/mpeg" : ext === "m4a" ? "audio/mp4" : "image/jpeg";
  return { base64: buf.toString("base64"), mimeType };
}

export async function setTelegramWebhook(url: string, secret: string) {
  return call("setWebhook", { url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true });
}

export async function telegramWebhookInfo(): Promise<{ url: string; pending_update_count: number; last_error_message?: string }> {
  return call("getWebhookInfo", {});
}
