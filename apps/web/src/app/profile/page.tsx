"use client";

/**
 * Profile: goal, trusted people, achievements, privacy, and erase.
 *
 * The privacy section is the point of this screen. Every toggle is off until
 * the teen turns it on, each says in plain words what it actually does, and
 * "Erase everything" is a real button that really erases.
 *
 * Motion note: the erase confirmation is the one place the app deliberately
 * adds friction. It expands rather than swapping in place, so the destructive
 * button is never where the safe button just was.
 */

import { useState } from "react";
import {
  ACHIEVEMENTS, ACHIEVEMENT_LABELS, AGE_BANDS, RELATIONS, RELATION_LABELS,
  type Relation,
} from "@teenbuddy/contracts";
import { achievementHint } from "@teenbuddy/progress";
import { SUPPORTED_REGIONS } from "@teenbuddy/safety";
import { useStore } from "../../lib/store.tsx";
import { ErrorNote, Loading } from "../../components/ui.tsx";
import {
  AnimatePresence, CountUp, Item, Page, Pop, Stagger, motion,
} from "../../components/motion.tsx";
import { Pressable } from "../../components/Pressable.tsx";
import { Confetti } from "../../components/Confetti.tsx";
import { ThemeToggle } from "../../components/ThemeToggle.tsx";
import { PILLAR_HUE, hue } from "../../lib/palette.ts";

/** One hue per achievement tile, so the grid reads as a set of trophies. */
const ACHIEVEMENT_HUES = [65, 25, 285, 145, 350, 200];

export default function ProfilePage() {
  const {
    ready, adapter, profile, progress, records, error,
    saveProfile, addTrusted, removeTrusted, sendSupportRequest, eraseEverything,
  } = useStore();

  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation>("parent");
  const [contact, setContact] = useState("");
  const [confirmErase, setConfirmErase] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  if (!ready || !profile || !progress) return <Loading />;

  const earned = new Set(progress.snapshot.achievements);
  const s = progress.snapshot;

  return (
    <Page>
      <Confetti fire={celebrate} originY={0.3} />
      <header>
        <h1>You</h1>
      </header>

      <div className="card">
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", textAlign: "center" }}>
          {[
            { n: s.checkInsTotal, label: "check-ins", h: PILLAR_HUE.wellbeing },
            { n: s.lessonsTotal, label: "lessons", h: PILLAR_HUE.learning },
            { n: s.challengesTotal, label: "challenges", h: PILLAR_HUE.habits },
          ].map((stat) => (
            <div key={stat.label} style={hue(stat.h)}>
              <div
                className="tinted-fg-lg"
                style={{ fontSize: "var(--step-4)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.1 }}
              >
                <CountUp value={stat.n} />
              </div>
              <div className="muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <ErrorNote message={error} />

      <div className="card">
        <h3 style={{ marginBottom: 10 }}><span aria-hidden="true">🎯</span> Today&apos;s goal</h3>
        <input
          type="text"
          value={profile.goal ?? ""}
          maxLength={140}
          placeholder="e.g. Stay off my phone after 11 PM"
          aria-label="Your goal"
          onChange={(e) => void saveProfile({ ...profile, goal: e.target.value })}
        />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Your details</h3>
        <div className="stack">
          <label>
            <span className="muted">Name you want to be called</span>
            <input
              type="text"
              value={profile.displayName}
              maxLength={40}
              onChange={(e) => void saveProfile({ ...profile, displayName: e.target.value || "there" })}
            />
          </label>
          <label>
            <span className="muted">Age</span>
            <select
              value={profile.ageBand}
              onChange={(e) => void saveProfile({ ...profile, ageBand: e.target.value as typeof profile.ageBand })}
            >
              {AGE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label>
            <span className="muted">Where you are (chooses which helplines you see)</span>
            <select
              value={profile.regionCode ?? ""}
              onChange={(e) => void saveProfile({ ...profile, regionCode: e.target.value || undefined })}
            >
              <option value="">Somewhere else</option>
              {SUPPORTED_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Time zone: {profile.timezone} · today is {progress.today}
          </p>
        </div>
      </div>

      <section id="trusted">
        <h2><span aria-hidden="true">👤</span> People you trust</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          Nothing you write is ever sent to them automatically. You choose, every time.
        </p>

        <AnimatePresence initial={false}>
          {records.trusted.map((person) => (
            <motion.div
              key={person.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              style={{ overflow: "hidden" }}
            >
              <div className="card" style={{ marginBottom: "var(--sp-4)" }}>
                <div className="spread">
                  <div>
                    <strong>{person.name}</strong>
                    <div className="muted">{RELATION_LABELS[person.relation]}</div>
                  </div>
                  <Pressable
                    className="btn btn-ghost btn-sm"
                    haptic="warn"
                    onClick={() => void removeTrusted(person.id)}
                  >
                    Remove
                  </Pressable>
                </div>
                <Pressable
                  className="btn tinted-grad block"
                  style={{ marginTop: 14, ...hue(PILLAR_HUE.wellbeing) }}
                  haptic="success"
                  onClick={() => {
                    void sendSupportRequest({
                      trustedPersonId: person.id,
                      message: "I'm having a difficult day. Can we talk?",
                      urgency: "today",
                    });
                    setSentTo(person.name);
                  }}
                >
                  I want {person.name} to know I&apos;m struggling
                </Pressable>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {sentTo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
            >
              <div className="card tinted" style={hue(PILLAR_HUE.wellbeing)}>
                <p style={{ margin: 0 }}>
                  Saved a request to talk to {sentTo}. Reaching out is the hard part, and you did it.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Add someone</h3>
          <div className="stack">
            <input type="text" value={name} placeholder="Their name" maxLength={60}
              aria-label="Their name" onChange={(e) => setName(e.target.value)} />
            <select value={relation} aria-label="Relationship"
              onChange={(e) => setRelation(e.target.value as Relation)}>
              {RELATIONS.map((r) => <option key={r} value={r}>{RELATION_LABELS[r]}</option>)}
            </select>
            <input type="text" value={contact} placeholder="Phone or email" maxLength={200}
              aria-label="Phone or email" onChange={(e) => setContact(e.target.value)} />
            <Pressable
                className="btn block"
                disabled={!name.trim() || contact.trim().length < 3}
                haptic="success"
                onClick={() => {
                  void addTrusted({
                    name: name.trim(),
                    relation,
                    contactMethod: contact.includes("@") ? "email" : "sms",
                    contactValue: contact.trim(),
                  });
                  setName("");
                  setContact("");
                }}
              >
                Add
            </Pressable>
          </div>
        </div>
      </section>

      <ThemeToggle />

      <section>
        <h2><span aria-hidden="true">🏆</span> Achievements</h2>
        <Stagger className="grid two">
          {ACHIEVEMENTS.map((id, i) => {
            const got = earned.has(id);
            return (
              <Item key={id}>
                <div
                  className={got ? "card tinted" : "card quiet"}
                  style={{ height: "100%", opacity: got ? 1 : 0.6, ...hue(ACHIEVEMENT_HUES[i % ACHIEVEMENT_HUES.length]!) }}
                >
                  <Pop play={got}>
                    <div
                      aria-hidden="true"
                      style={{ fontSize: "1.6rem", lineHeight: 1, cursor: got ? "pointer" : "default" }}
                      onClick={got ? () => setCelebrate((n) => n + 1) : undefined}
                    >
                      {ACHIEVEMENT_LABELS[id].emoji}
                    </div>
                  </Pop>
                  <div
                    className={got ? "tinted-fg" : ""}
                    style={{ fontWeight: 650, marginTop: 8, fontSize: "0.9rem" }}
                  >
                    {ACHIEVEMENT_LABELS[id].label}
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {got ? "Earned" : achievementHint(id)}
                  </div>
                </div>
              </Item>
            );
          })}
        </Stagger>
      </section>

      <section>
        <h2><span aria-hidden="true">🔒</span> Your private space</h2>

        <div className="card">
          <p>
            {adapter.kind === "local"
              ? "Everything you write is stored on this device and nowhere else. There is no account and no server copy."
              : "Everything is stored in your own private account. Nobody else can read it."}
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            TeenBuddy never asks for your contacts, your location, your camera, your microphone,
            or your messages.
          </p>
        </div>

        <PrivacyToggle
          label="Let the coach read my journal"
          detail="Off by default. When on, the coach can notice patterns across what you write."
          checked={profile.privacy.aiMayReadJournal}
          onChange={(v) => void saveProfile({ ...profile, privacy: { ...profile.privacy, aiMayReadJournal: v } })}
        />
        <PrivacyToggle
          label="Let the coach remember our conversations"
          detail="Off by default. When off, every conversation starts fresh."
          checked={profile.privacy.aiMayRememberConversations}
          onChange={(v) => void saveProfile({ ...profile, privacy: { ...profile.privacy, aiMayRememberConversations: v } })}
        />
        <PrivacyToggle
          label="Share anonymous usage data"
          detail="Off by default. Counts of screens opened, never anything you wrote."
          checked={profile.privacy.shareAnonymousUsage}
          onChange={(v) => void saveProfile({ ...profile, privacy: { ...profile.privacy, shareAnonymousUsage: v } })}
        />

        <div className="card urgent">
          <h3 style={{ marginBottom: 6 }}>Erase everything</h3>
          <p className="muted">
            Deletes every check-in, journal entry, lesson, challenge and trusted person.
            This cannot be undone.
          </p>
          <AnimatePresence mode="wait" initial={false}>
            {confirmErase ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div className="stack" style={{ paddingTop: 4 }}>
                  <p style={{ margin: 0, fontWeight: 550 }}>
                    Really erase everything? There is no undo.
                  </p>
                  <div className="row">
                    <Pressable className="btn btn-ghost" onClick={() => setConfirmErase(false)}>Cancel</Pressable>
                    <Pressable
                      className="btn btn-urgent"
                      style={{ width: "auto", minHeight: 46, paddingInline: "var(--sp-4)" }}
                      haptic="warn"
                      onClick={() => { void eraseEverything(); setConfirmErase(false); }}
                    >
                      Yes, erase everything
                    </Pressable>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Pressable className="btn" haptic="warn" onClick={() => setConfirmErase(true)}>
                  Erase everything
                </Pressable>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </Page>
  );
}

/** A switch rather than a checkbox: the state is readable at a glance. */
function PrivacyToggle({
  label, detail, checked, onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="card">
      <div className="spread" style={{ alignItems: "flex-start", gap: "var(--sp-4)" }}>
        <span>
          <strong>{label}</strong>
          <div className="muted" style={{ marginTop: 2 }}>{detail}</div>
        </span>
        <button
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          style={{
            flexShrink: 0,
            width: 52,
            minHeight: 30,
            height: 30,
            padding: 3,
            borderRadius: 999,
            justifyContent: "flex-start",
            background: checked ? "var(--accent)" : "var(--surface-3)",
            borderColor: "transparent",
            boxShadow: "none",
          }}
        >
          <motion.span
            aria-hidden="true"
            layout
            transition={{ type: "spring", stiffness: 620, damping: 34 }}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "var(--bg-elevated)",
              boxShadow: "var(--shadow-sm)",
              marginLeft: checked ? 22 : 0,
            }}
          />
        </button>
      </div>
    </div>
  );
}
