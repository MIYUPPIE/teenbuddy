"use client";

/**
 * Journal.
 *
 * The privacy line at the top is not decoration. Spec section 8 says to make
 * privacy extremely clear, and this sentence is generated from the adapter
 * actually in use, so it can never claim something untrue about where the text
 * is going.
 *
 * Entries animate out on delete rather than vanishing, so a mis-tap is
 * legible: you can see which one went.
 */

import { useState } from "react";
import { useStore } from "../../lib/store.tsx";
import { ErrorNote, Loading } from "../../components/ui.tsx";
import { AnimatePresence, Page, motion } from "../../components/motion.tsx";
import { Pressable } from "../../components/Pressable.tsx";
import { MOOD_HUE, hue } from "../../lib/palette.ts";
import { MOOD_LABELS } from "@teenbuddy/contracts";

export default function JournalPage() {
  const { ready, adapter, records, addJournal, deleteJournal, error } = useStore();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  if (!ready) return <Loading />;

  const entries = [...records.journal].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // An entry inherits the colour of the mood logged that day, so scrolling the
  // journal shows the shape of a month without reading a word of it.
  const moodByDate = new Map(records.moods.map((m) => [m.localDate, m.mood]));

  async function save() {
    if (!body.trim()) return;
    setSaving(true);
    await addJournal(body.trim());
    setBody("");
    setSaving(false);
  }

  return (
    <Page>
      <header>
        <h1>What&apos;s on your mind?</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {adapter.kind === "local"
            ? "Stored on this device only. It is not sent anywhere and nobody else can read it."
            : "Stored in your private account. Only you can read it, and nothing here is shared unless you choose to share it."}
        </p>
      </header>

      <ErrorNote message={error} />

      <div className="stack">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={20_000}
          placeholder="Write whatever. Nobody is marking this."
          aria-label="Journal entry"
        />
        <div className="spread">
          <span className="muted tabular">
            {body.length > 0 ? `${body.length.toLocaleString()} characters` : ""}
          </span>
          <Pressable
            className="btn btn-primary"
            disabled={!body.trim() || saving}
            haptic="success"
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save entry"}
          </Pressable>
        </div>
      </div>

      {entries.length > 0 && <h2>Earlier</h2>}

      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="card"
              style={{
                marginBottom: "var(--sp-4)",
                ...(moodByDate.has(entry.localDate) ? hue(MOOD_HUE[moodByDate.get(entry.localDate)!]) : {}),
              }}
            >
              <div className="spread">
                <span className="muted tabular">
                  {moodByDate.has(entry.localDate) && (
                    <span aria-hidden="true" style={{ marginRight: 6 }}>
                      {MOOD_LABELS[moodByDate.get(entry.localDate)!].emoji}
                    </span>
                  )}
                  {entry.localDate}
                </span>
                <Pressable
                  className="btn btn-ghost btn-sm"
                  haptic="warn"
                  onClick={() => void deleteJournal(entry.id)}
                  aria-label={`Delete entry from ${entry.localDate}`}
                >
                  Delete
                </Pressable>
              </div>
              <p style={{ whiteSpace: "pre-wrap", margin: "10px 0 0", lineHeight: 1.65 }}>
                {entry.body}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {entries.length === 0 && (
        <div className="card quiet" style={{ textAlign: "center", paddingBlock: "var(--sp-6)" }}>
          <div aria-hidden="true" style={{ fontSize: "2rem" }}>📓</div>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Nothing here yet. This stays empty until you want it not to be.
          </p>
        </div>
      )}
    </Page>
  );
}
