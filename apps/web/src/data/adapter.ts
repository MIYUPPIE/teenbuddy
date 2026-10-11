/**
 * The storage contract.
 *
 * Two implementations satisfy it: Firestore, and a local one backed by the
 * browser's own storage. The local one is not a stub - it is the app's honest
 * default. A teenager can use TeenBuddy with no account and no server, and
 * their journal never leaves the device. Firebase is what they opt into when
 * they want it on their phone as well as their laptop.
 *
 * Every method is scoped to one `userId`. There is no method on this interface
 * that reads another person's data, which is the first line of the privacy
 * design rather than a rule someone has to remember.
 */

import type {
  ChallengeCompletion, HelpSession, JournalEntry, LessonCompletion,
  MoodEntry, Profile, SupportRequest, TrustedPerson,
} from "@teenbuddy/contracts";

export type DataAdapter = {
  /** Which implementation is live. Surfaced in Profile so it is never a mystery. */
  readonly kind: "local" | "firebase";

  getProfile(userId: string): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;

  listMoodEntries(userId: string): Promise<MoodEntry[]>;
  addMoodEntry(entry: MoodEntry): Promise<void>;

  listJournalEntries(userId: string): Promise<JournalEntry[]>;
  addJournalEntry(entry: JournalEntry): Promise<void>;
  deleteJournalEntry(userId: string, id: string): Promise<void>;

  listLessonCompletions(userId: string): Promise<LessonCompletion[]>;
  addLessonCompletion(entry: LessonCompletion): Promise<void>;

  listChallengeCompletions(userId: string): Promise<ChallengeCompletion[]>;
  addChallengeCompletion(entry: ChallengeCompletion): Promise<void>;

  listHelpSessions(userId: string): Promise<HelpSession[]>;
  addHelpSession(entry: HelpSession): Promise<void>;

  listTrustedPeople(userId: string): Promise<TrustedPerson[]>;
  addTrustedPerson(person: TrustedPerson): Promise<void>;
  removeTrustedPerson(userId: string, id: string): Promise<void>;

  listSupportRequests(userId: string): Promise<SupportRequest[]>;
  addSupportRequest(request: SupportRequest): Promise<void>;

  /** Deletes everything for this user. Wired to a real button in Profile. */
  eraseAll(userId: string): Promise<void>;
};

/** Collision-resistant enough for per-device records, with no dependency. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
