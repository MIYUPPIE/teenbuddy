"use client";

/**
 * Help Now.
 *
 * The routing rule this screen exists to honour: eight topics get a coping
 * exercise, and "I don't feel safe" gets a person. `helpRouteFor` decides, not
 * this component, so the emergency path cannot be broken by a UI edit.
 *
 * Motion note: the crisis branch is the *least* animated screen in the app.
 * It fades, slowly, and holds still. A screen that slides and springs while
 * someone is telling you they are in danger reads as software being pleased
 * with itself.
 */

import { useState } from "react";
import Link from "next/link";
import { HELP_TOPICS, HELP_TOPIC_LABELS, type HelpTopic, type Intervention } from "@teenbuddy/contracts";
import { helpRouteFor, lessonsForTopic } from "@teenbuddy/content";
import { assessSync } from "@teenbuddy/safety";
import { useStore } from "../../lib/store.tsx";
import { ErrorNote } from "../../components/ui.tsx";
import { BreathingOrb } from "../../components/BreathingOrb.tsx";
import { AnimatePresence, Item, Page, Stagger, motion } from "../../components/motion.tsx";
import { Pressable } from "../../components/Pressable.tsx";
import { topicHue, hue } from "../../lib/palette.ts";

export default function HelpPage() {
  const { profile, recordHelp, error } = useStore();
  const [topic, setTopic] = useState<HelpTopic | null>(null);

  if (!topic) {
    return (
      <Page>
        <header>
          <h1><span aria-hidden="true">🆘</span> What are you dealing with?</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Pick whatever is closest. You can change your mind.
          </p>
        </header>

        <ErrorNote message={error} />

        <Stagger>
          {HELP_TOPICS.map((t) => (
            <Item key={t}>
              {/* topicHue returns null for the emergency option, which keeps it
                  in the reserved urgent colour and out of the cheerful set. */}
              <Pressable
                className={t === "not_safe" ? "btn btn-urgent" : "btn btn-option tinted"}
                style={hue(topicHue(t) ?? 0)}
                haptic={t === "not_safe" ? "warn" : "select"}
                onClick={() => setTopic(t)}
              >
                <span className="glyph" aria-hidden="true">{HELP_TOPIC_LABELS[t].emoji}</span>
                {HELP_TOPIC_LABELS[t].label}
              </Pressable>
            </Item>
          ))}
        </Stagger>
      </Page>
    );
  }

  const route = helpRouteFor(topic);

  if (route.route === "safety") {
    // The declared emergency. No breathing exercise, no coach, no delay.
    const assessment = assessSync("", topic, profile?.regionCode ?? null);
    return (
      <Page calm>
        <header>
          <h1>You said you don&apos;t feel safe</h1>
        </header>

        <div className="card urgent">
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "var(--step-1)" }}>
            {assessment.escalation?.message}
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>People who can help right now</h3>
          <div className="stack-sm">
            {assessment.escalation?.resources.map((r) => (
              <div key={`${r.name}-${r.contact}`} style={{ paddingBlock: 6 }}>
                <strong>{r.name}</strong>
                <div style={{ fontSize: "var(--step-1)" }}>{r.contact}</div>
                {r.note && <div className="muted">{r.note}</div>}
              </div>
            ))}
          </div>
        </div>

        <Pressable className="btn btn-primary btn-block" href="/profile#trusted">
          Tell someone I trust
        </Pressable>
        <Pressable className="btn btn-ghost" onClick={() => setTopic(null)}>Back</Pressable>
      </Page>
    );
  }

  return (
    <InterventionView
      intervention={route.intervention}
      onDone={(outcome) => {
        void recordHelp({ topic, interventionId: route.intervention.id, outcome });
      }}
      onBack={() => setTopic(null)}
    />
  );
}

function InterventionView({
  intervention,
  onDone,
  onBack,
}: {
  intervention: Intervention;
  onDone: (outcome: "completed" | "abandoned" | "escalated") => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const lessons = lessonsForTopic(intervention.topic).slice(0, 2);
  const isBreathing = intervention.kind === "breathing";

  if (finished) {
    return (
      <Page>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {intervention.closing}
        </motion.h1>

        <h2 style={{ marginTop: "var(--sp-5)" }}>What would help right now?</h2>
        <Stagger>
          {intervention.nextSteps.map((s) => (
            <Item key={s}>
              <Pressable className="btn btn-option" haptic="select" onClick={() => onDone("completed")}>
                {s}
              </Pressable>
            </Item>
          ))}
          <Item>
            <Pressable className="btn btn-option" href="/profile#trusted" onClick={() => onDone("escalated")}>
              <span className="glyph" aria-hidden="true">👤</span>
              Tell someone I trust
            </Pressable>
          </Item>
        </Stagger>

        {lessons.length > 0 && (
          <div className="card quiet">
            <h3 style={{ marginBottom: 10 }}>If you want to understand it better</h3>
            <div className="stack-sm">
              {lessons.map((l) => (
                <Link key={l.slug} href={`/learn/${l.slug}`}>
                  {l.title} · {l.minutes} min
                </Link>
              ))}
            </div>
          </div>
        )}

        <Pressable className="btn btn-ghost" onClick={onBack}>Something else</Pressable>
      </Page>
    );
  }

  const last = step >= intervention.script.length - 1;
  const progress = (step + 1) / intervention.script.length;

  return (
    <Page>
      <div style={hue(topicHue(intervention.topic) ?? 288)} className="stack intervention">
      <header>
        <h1>{intervention.title}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          About {Math.round(intervention.durationSeconds / 30) * 30} seconds
        </p>
      </header>

      {isBreathing && <BreathingOrb />}

      <div className="spread">
        <div className="meter" style={{ flex: 1 }} aria-hidden="true">
          <motion.span
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
          />
        </div>
        <span className="muted tabular" aria-live="polite">
          {step + 1} of {intervention.script.length}
        </span>
      </div>

      {/* One line at a time. Earlier lines are done with; showing the whole
          accumulated script asks someone mid-panic to work out which line they
          are on, and it grew the page under them as they tapped. The card holds
          a minimum height so the layout does not jump between short and long
          lines. */}
      <div
        className="card"
        style={{
          display: "grid",
          minHeight: "clamp(84px, 12dvh, 132px)",
          alignContent: "center",
          justifyItems: "center",
          textAlign: "center",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={step}
            className="script-line"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            /* A measure cap keeps a long instruction from running the full
               width, which is what makes centred text hard to read. */
            style={{ margin: 0, borderBottom: "none", maxWidth: "26ch" }}
          >
            {intervention.script[step]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Pinned: the script grows a line per tap, and this must stay reachable
          however long it gets. See .action-bar in globals.css. */}
      <div className="action-bar">
        <Pressable
          className="btn tinted-grad block"
          style={hue(topicHue(intervention.topic) ?? 288)}
          haptic={last ? "success" : "tap"}
          onClick={() => (last ? setFinished(true) : setStep(step + 1))}
        >
          {last ? "Done" : "Next"}
        </Pressable>
        <Pressable className="btn btn-ghost" onClick={() => { onDone("abandoned"); onBack(); }}>
          This isn&apos;t helping
        </Pressable>
      </div>
      </div>
    </Page>
  );
}
