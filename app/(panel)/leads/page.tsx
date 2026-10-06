import Link from "next/link";
import AddContactForm from "@/components/AddContactForm";
import StatusBadge, { formatTime } from "@/components/StatusBadge";
import { db, type Contact } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { data } = await db()
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  const contacts = (data ?? []) as Contact[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Kişiler</h1>
      <AddContactForm />

      {contacts.length === 0 ? (
        <div className="card text-sm text-zinc-500">Henüz kayıtlı kişi yok.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Ad</th>
                <th className="px-4 py-2 font-medium">Telefon</th>
                <th className="px-4 py-2 font-medium">Durum</th>
                <th className="px-4 py-2 font-medium">Not</th>
                <th className="px-4 py-2 font-medium">Son mesaj</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/inbox/${c.id}`} className="hover:underline">
                      {c.name || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 tabular-nums">+{c.phone}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-zinc-600">{c.notes}</td>
                  <td className="px-4 py-2 text-zinc-500">{formatTime(c.last_message_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
