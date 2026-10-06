import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import StatusBadge, { formatTime } from "@/components/StatusBadge";
import { db, type Contact } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const { filter } = await searchParams;
  const onlyHandoff = filter === "handoff";

  let query = db()
    .from("contacts")
    .select("*")
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (onlyHandoff) query = query.eq("status", "handoff");
  const { data } = await query;
  const contacts = (data ?? []) as Contact[];

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={10} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Gelen Kutusu</h1>
        <div className="flex gap-2">
          <Link href="/inbox" className="btn-ghost">
            Tümü
          </Link>
          <Link href="/inbox?filter=handoff" className="btn-ghost">
            İnsan bekleyenler
          </Link>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="card text-sm text-zinc-500">
          {onlyHandoff ? "İnsan bekleyen konuşma yok." : "Henüz konuşma yok. WhatsApp'tan ilk mesaj geldiğinde burada görünür."}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {contacts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/inbox/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name || `+${c.phone}`}</div>
                  <div className="text-xs text-zinc-500">+{c.phone}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={c.status} />
                  <span className="text-xs text-zinc-500">{formatTime(c.last_message_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
