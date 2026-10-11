"use client";

/**
 * One React context holding the profile, every record, and the derived
 * progress snapshot.
 *
 * Everything is recomputed from raw records through `@teenbuddy/progress` on
 * each change rather than kept as counters. A cached streak that drifts from
 * the records is a bug a teenager notices and cannot report usefully; the cost
 * of recomputation at these data sizes is nothing.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  SCHEMA_VERSION,
  type ChallengeCompletion, type HelpSession, type JournalEntry,
  type LessonCompletion, type MoodEntry, type Profile,
  type SupportRequest, type TrustedPerson,
} from "@teenbuddy/contracts";
import { computeProgress, type ProgressResult } from "@teenbuddy/progress";
import { lessonBySlug, isProsocial } from "@teenbuddy/content";
import { getAdapter, newId, type DataAdapter } from "../data/index.ts";
import { currentUserId, newProfile } from "./session.ts";

type Records = {
  moods: MoodEntry[];
  journal: JournalEntry[];
  lessons: LessonCompletion[];
  challenges: ChallengeCompletion[];
  help: HelpSession[];
  trusted: TrustedPerson[];
  support: SupportRequest[];
};

const EMPTY: Records = { moods: [], journal: [], lessons: [], challenges: [], help: [], trusted: [], support: [] };

type Store = {
  ready: boolean;
  adapter: DataAdapter;
  userId: string;
  profile: Profile | null;
  records: Records;
  progress: ProgressResult | null;
  error: string | null;
  saveProfile(profile: Profile): Promise<void>;
  addMood(mood: Omit<MoodEntry, "id" | "userId" | "createdAt" | "schemaVersion" | "localDate">): Promise<void>;
  addJournal(body: string): Promise<void>;
  deleteJournal(id: string): Promise<void>;
  completeLesson(slug: string): Promise<void>;
  completeChallenge(challengeId: string): Promise<void>;
  recordHelp(entry: Omit<HelpSession, "id" | "userId" | "createdAt" | "schemaVersion" | "localDate">): Promise<void>;
  addTrusted(person: Omit<TrustedPerson, "id" | "userId" | "addedAt" | "schemaVersion">): Promise<void>;
  removeTrusted(id: string): Promise<void>;
  sendSupportRequest(r: Omit<SupportRequest, "id" | "userId" | "createdAt" | "schemaVersion">): Promise<void>;
  eraseEverything(): Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [adapter] = useState<DataAdapter>(() => getAdapter());
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<Records>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (uid: string) => {
    const [moods, journal, lessons, challenges, help, trusted, support] = await Promise.all([
      adapter.listMoodEntries(uid),
      adapter.listJournalEntries(uid),
      adapter.listLessonCompletions(uid),
      adapter.listChallengeCompletions(uid),
      adapter.listHelpSessions(uid),
      adapter.listTrustedPeople(uid),
      adapter.listSupportRequests(uid),
    ]);
    setRecords({ moods, journal, lessons, challenges, help, trusted, support });
  }, [adapter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const uid = currentUserId();
        if (cancelled) return;
        setUserId(uid);
        let p = await adapter.getProfile(uid);
        if (!p) {
          p = newProfile(uid);
          await adapter.saveProfile(p);
        }
        if (cancelled) return;
        setProfile(p);
        await reload(uid);
      } catch (e) {
        if (!cancelled) setError(describe(e));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [adapter, reload]);

  // Recomputed from raw records, so no counter can drift from the truth.
  const progress = useMemo(() => {
    if (!profile) return null;
    return computeProgress({
      userId: profile.userId,
      timeZone: profile.timezone,
      now: new Date(),
      checkInDates: records.moods.map((m) => m.localDate),
      lessons: records.lessons.flatMap((l) => {
        const lesson = lessonBySlug(l.lessonSlug);
        return lesson ? [{ localDate: l.localDate, category: lesson.category }] : [];
      }),
      challenges: records.challenges.map((c) => ({
        localDate: c.localDate,
        prosocial: isProsocial(c.challengeId),
      })),
      helpSessions: records.help.map((h) => ({ localDate: h.localDate, outcome: h.outcome })),
    });
  }, [profile, records]);

  const today = progress?.today ?? "";

  const guard = useCallback(async (fn: () => Promise<void>) => {
    try {
      setError(null);
      await fn();
      if (userId) await reload(userId);
    } catch (e) {
      setError(describe(e));
    }
  }, [reload, userId]);

  const value: Store = {
    ready, adapter, userId, profile, records, progress, error,

    saveProfile: (p) => guard(async () => {
      await adapter.saveProfile(p);
      setProfile(p);
    }),

    addMood: (mood) => guard(() => adapter.addMoodEntry({
      ...mood, id: newId(), userId, localDate: today,
      createdAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION,
    })),

    addJournal: (body) => guard(() => adapter.addJournalEntry({
      id: newId(), userId, localDate: today, createdAt: new Date().toISOString(),
      body, schemaVersion: SCHEMA_VERSION,
    })),

    deleteJournal: (id) => guard(() => adapter.deleteJournalEntry(userId, id)),

    completeLesson: (lessonSlug) => guard(async () => {
      if (records.lessons.some((l) => l.lessonSlug === lessonSlug && l.localDate === today)) return;
      await adapter.addLessonCompletion({
        id: newId(), userId, localDate: today, lessonSlug,
        completedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION,
      });
    }),

    completeChallenge: (challengeId) => guard(async () => {
      if (records.challenges.some((c) => c.localDate === today)) return; // one a day
      await adapter.addChallengeCompletion({
        id: newId(), userId, localDate: today, challengeId,
        completedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION,
      });
    }),

    recordHelp: (entry) => guard(() => adapter.addHelpSession({
      ...entry, id: newId(), userId, localDate: today,
      createdAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION,
    })),

    addTrusted: (person) => guard(() => adapter.addTrustedPerson({
      ...person, id: newId(), userId,
      addedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION,
    })),

    removeTrusted: (id) => guard(() => adapter.removeTrustedPerson(userId, id)),

    sendSupportRequest: (r) => guard(() => adapter.addSupportRequest({
      ...r, id: newId(), userId,
      createdAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION,
    })),

    eraseEverything: () => guard(async () => {
      await adapter.eraseAll(userId);
      const fresh = newProfile(userId);
      await adapter.saveProfile(fresh);
      setProfile(fresh);
    }),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong saving that.";
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
