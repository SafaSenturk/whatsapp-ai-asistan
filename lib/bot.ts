import { db, getSettings, type Contact, type Message } from "./db";
import { generateReply, type Turn } from "./ai";
import { sendText } from "./evolution";

const HISTORY_LIMIT = 20;

export type Incoming = {
  jid: string;
  phone: string;
  name: string | null;
  text: string;
  waMessageId: string;
  fromMe: boolean;
};

async function upsertContact(m: Incoming): Promise<Contact> {
  const now = new Date().toISOString();
  const { data: existing } = await db()
    .from("contacts")
    .select("*")
    .eq("jid", m.jid)
    .maybeSingle();

  if (existing) {
    const patch: Partial<Contact> = { last_message_at: now };
    if (!existing.name && m.name && !m.fromMe) patch.name = m.name;
    if (existing.status === "new" && !m.fromMe) patch.status = "active";
    await db().from("contacts").update(patch).eq("id", existing.id);
    return { ...existing, ...patch } as Contact;
  }

  const { data, error } = await db()
    .from("contacts")
    .insert({
      jid: m.jid,
      phone: m.phone,
      name: m.fromMe ? null : m.name,
      last_message_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Kişi kaydedilemedi: ${error.message}`);
  return data as Contact;
}

/** Bot veya panelden giden mesajı kaydeder. Webhook yankısı önce geldiyse göndereni düzeltir. */
export async function saveOutgoing(
  contactId: string,
  sender: "bot" | "agent",
  body: string,
  waMessageId: string | null,
) {
  const row = { contact_id: contactId, sender, body, wa_message_id: waMessageId };
  const query = waMessageId
    ? db().from("messages").upsert(row, { onConflict: "wa_message_id" })
    : db().from("messages").insert(row);
  const { error } = await query;
  if (error) throw new Error(`Mesaj kaydedilemedi: ${error.message}`);
  await db()
    .from("contacts")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", contactId);
}

function matchesKeyword(text: string, keywords: string): boolean {
  const lower = text.toLocaleLowerCase("tr");
  return keywords
    .split(",")
    .map((k) => k.trim().toLocaleLowerCase("tr"))
    .filter(Boolean)
    .some((k) => lower.includes(k));
}

async function handoff(contact: Contact, message: string) {
  await db()
    .from("contacts")
    .update({ status: "handoff", bot_enabled: false })
    .eq("id", contact.id);
  if (message) {
    const id = await sendText(contact.jid, message);
    await saveOutgoing(contact.id, "bot", message, id);
  }
}

export async function handleIncoming(m: Incoming) {
  const contact = await upsertContact(m);

  // Aynı mesaj iki kez gelirse (Evolution yeniden denerse) ikinci kez işlenmez.
  const { data: inserted, error } = await db()
    .from("messages")
    .upsert(
      {
        contact_id: contact.id,
        sender: m.fromMe ? "agent" : "customer",
        body: m.text,
        wa_message_id: m.waMessageId,
      },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`Mesaj kaydedilemedi: ${error.message}`);
  if (!inserted?.length || m.fromMe) return;

  const settings = await getSettings();
  if (!settings.enabled || !contact.bot_enabled) return;

  if (matchesKeyword(m.text, settings.handoff_keywords)) {
    await handoff(contact, settings.handoff_message);
    return;
  }

  const { data: rows } = await db()
    .from("messages")
    .select("sender, body")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: Turn[] = ((rows ?? []) as Pick<Message, "sender" | "body">[])
    .reverse()
    .map((r) => ({
      role: r.sender === "customer" ? "customer" : "business",
      text: r.body,
    }));

  const reply = await generateReply(settings, history);

  if (reply.handoff) {
    await handoff(contact, reply.text || settings.handoff_message);
    return;
  }
  if (!reply.text) return;

  const id = await sendText(contact.jid, reply.text);
  await saveOutgoing(contact.id, "bot", reply.text, id);
}
