import Link from "next/link";
import { notFound } from "next/navigation";
import { updateContact } from "@/app/actions";
import AutoRefresh from "@/components/AutoRefresh";
import ReplyForm from "@/components/ReplyForm";
import StatusBadge, { formatTime } from "@/components/StatusBadge";
import { db, STATUS_LABELS, type Contact, type ContactStatus, type Message } from "@/lib/db";

export const dynamic = "force-dynamic";

const SENDER_LABEL = { customer: "Müşteri", bot: "Bot", agent: "Siz" } as const;

export default async function ConversationPage({ params }: PageProps<"/inbox/[id]">) {
  const { id } = await params;

  const [{ data: contactRow }, { data: messageRows }] = await Promise.all([
    db().from("contacts").select("*").eq("id", id).maybeSingle(),
    db()
      .from("messages")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (!contactRow) notFound();

  const contact = contactRow as Contact;
  const messages = ((messageRows ?? []) as Message[]).reverse();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <AutoRefresh seconds={5} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/inbox" className="text-sm text-zinc-500 hover:underline">
            ← Gelen Kutusu
          </Link>
          <h1 className="text-xl font-semibold">{contact.name || `+${contact.phone}`}</h1>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            +{contact.phone} <StatusBadge status={contact.status} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={updateContact}>
            <input type="hidden" name="id" value={contact.id} />
            <input type="hidden" name="bot_enabled" value={String(!contact.bot_enabled)} />
            {!contact.bot_enabled && <input type="hidden" name="status" value="active" />}
            <button className="btn-ghost">
              {contact.bot_enabled ? "Botu bu kişide durdur" : "Botu yeniden başlat"}
            </button>
          </form>
          <form action={updateContact} className="flex gap-2">
            <input type="hidden" name="id" value={contact.id} />
            <select
              name="status"
              defaultValue={contact.status}
              aria-label="Durum"
              className="input w-auto"
            >
              {(Object.keys(STATUS_LABELS) as ContactStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button className="btn-ghost">Kaydet</button>
          </form>
        </div>
      </div>

      {!contact.bot_enabled && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bot bu kişiye cevap vermiyor; mesajları siz yanıtlıyorsunuz.
        </p>
      )}

      <div className="card flex flex-col gap-2">
        {messages.length === 0 && <p className="text-sm text-zinc-500">Henüz mesaj yok.</p>}
        {messages.map((m) => {
          const mine = m.sender !== "customer";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender === "customer"
                    ? "bg-zinc-100"
                    : m.sender === "bot"
                      ? "bg-emerald-100"
                      : "bg-sky-100"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1 text-right text-[11px] text-zinc-500">
                  {SENDER_LABEL[m.sender]} · {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <ReplyForm contactId={contact.id} />

      <form action={updateContact} className="card space-y-2">
        <input type="hidden" name="id" value={contact.id} />
        <label htmlFor="notes" className="label">
          Notlar
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={contact.notes ?? ""}
          className="input"
        />
        <button className="btn-ghost">Notu kaydet</button>
      </form>
    </div>
  );
}
