"use client";

import { useState, type FormEvent } from "react";
import { sendTestEmailAction } from "@/app/dashboard/email-test/actions";
import type { TestEmailSender } from "@/lib/outbound/test-email";

type Feedback =
  | { kind: "success"; message: string; messageId: string }
  | { kind: "error"; message: string }
  | null;

export function TestEmailForm({
  sender,
  initialRequestId,
}: {
  sender: TestEmailSender;
  initialRequestId: string;
}) {
  const [requestId, setRequestId] = useState(initialRequestId);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function markPayloadChanged() {
    setRequestId(window.crypto.randomUUID());
    setFeedback(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    const formData = new FormData(event.currentTarget);
    const recipient = String(formData.get("recipient") ?? "").trim();
    if (
      !window.confirm(`Realiai išsiųsti testinį laišką adresu ${recipient}?`)
    ) {
      return;
    }

    setSending(true);
    setFeedback(null);
    try {
      const result = await sendTestEmailAction(formData);
      if (result.ok) {
        setFeedback({
          kind: "success",
          message: result.message,
          messageId: result.messageId,
        });
        setRequestId(window.crypto.randomUUID());
      } else {
        setFeedback({ kind: "error", message: result.message });
      }
    } catch (error) {
      console.error("[dashboard-test-email] request failed", error);
      setFeedback({
        kind: "error",
        message:
          "Siuntimo rezultatas neaiškus. Nekeičiant laukų galima saugiai bandyti dar kartą.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 rounded-lg border border-line bg-white p-5 shadow-cardsoft"
    >
      <input type="hidden" name="requestId" value={requestId} />

      <div className="rounded-lg border border-line bg-line-soft p-4 text-sm text-ink-soft">
        <div>
          <span className="font-bold text-ink">Iš:</span> {sender.fromName} &lt;
          {sender.fromEmail}&gt;
        </div>
        <div className="mt-1">
          <span className="font-bold text-ink">Reply-To:</span>{" "}
          {sender.replyToEmail}
        </div>
      </div>

      <label className="mt-4 block text-sm font-bold text-ink">
        Gavėjo el. paštas
        <input
          type="email"
          name="recipient"
          required
          maxLength={320}
          autoComplete="email"
          placeholder="jusu-testas@example.com"
          onChange={markPayloadChanged}
          className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 py-2 font-normal outline-none focus:border-brand"
        />
      </label>

      <label className="mt-4 block text-sm font-bold text-ink">
        Tema
        <input
          name="subject"
          required
          maxLength={300}
          defaultValue="FirstReply siuntimo testas"
          onChange={markPayloadChanged}
          className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 py-2 font-normal outline-none focus:border-brand"
        />
      </label>

      <label className="mt-4 block text-sm font-bold text-ink">
        Laiško tekstas
        <textarea
          name="text"
          required
          maxLength={20_000}
          rows={7}
          defaultValue={
            "Sveiki,\n\nTai bandomasis laiškas iš FirstReply.\n\nJei jį gavote, siuntimo konfigūracija veikia."
          }
          onChange={markPayloadChanged}
          className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal leading-relaxed outline-none focus:border-brand"
        />
      </label>

      <div className="mt-4 rounded-lg border border-warn-border bg-warn-bg p-3 text-sm font-semibold text-warn-text">
        Tai realus siuntimas. Naudokite tik savo arba aiškiai testavimui skirtą
        gavėjo adresą.
      </div>

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending}
        className="mt-4 rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
      >
        {sending ? "Siunčiama…" : "Siųsti testinį laišką"}
      </button>

      {feedback ? (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`mt-4 rounded-lg border p-4 text-sm ${
            feedback.kind === "error"
              ? "border-warn-border bg-warn-bg text-warn-text"
              : "border-brand-tintborder bg-brand-tint text-brand"
          }`}
        >
          <div className="font-bold">{feedback.message}</div>
          {feedback.kind === "success" ? (
            <div className="mt-1 break-all text-xs">
              Siuntimo ID: <code>{feedback.messageId}</code>. Patikrinkite
              gavėjo dėžutę.
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
