"use client";

import { useActionState } from "react";
import { addContact } from "@/app/actions";

export default function AddContactForm() {
  const [message, action, pending] = useActionState(addContact, null);

  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
      <div>
        <label htmlFor="new-name" className="label">
          Ad
        </label>
        <input id="new-name" name="name" className="input" />
      </div>
      <div>
        <label htmlFor="new-phone" className="label">
          Telefon
        </label>
        <input
          id="new-phone"
          name="phone"
          required
          inputMode="tel"
          placeholder="905xxxxxxxxx"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="new-notes" className="label">
          Not
        </label>
        <input id="new-notes" name="notes" className="input" />
      </div>
      <button className="btn" disabled={pending}>
        Ekle
      </button>
      {message && <p className="text-sm text-zinc-600 sm:col-span-4">{message}</p>}
    </form>
  );
}
