/**
 * A tiny, zero-dependency validation kernel.
 *
 * Why not zod: contracts sit at the boundary of every service, so they must be
 * importable from a Next.js server component, a browser bundle, and a bare
 * `node --test` run with no install step. ~200 lines buys us that.
 *
 * Every validator is a pure function: same input, same result, no throwing on
 * invalid data. Callers get a Result they must destructure, so a missing check
 * is a type error rather than a runtime surprise.
 */

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; errors: Issue[] };
export type Result<T> = Ok<T> | Err;

export type Issue = { path: string; message: string };

export type Validator<T> = {
  readonly name: string;
  parse(input: unknown, path?: string): Result<T>;
};

export type Infer<V> = V extends Validator<infer T> ? T : never;

const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
const err = (path: string, message: string): Err => ({
  ok: false,
  errors: [{ path, message }],
});

const join = (path: string, key: string | number): string =>
  typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key;

/** Throwing variant, for trusted internal data and tests. */
export function expect<T>(v: Validator<T>, input: unknown): T {
  const r = v.parse(input);
  if (r.ok) return r.value;
  throw new TypeError(
    `${v.name} validation failed:\n` +
      r.errors.map((e) => `  ${e.path || "<root>"}: ${e.message}`).join("\n"),
  );
}

export function formatIssues(errors: Issue[]): string {
  return errors.map((e) => `${e.path || "<root>"}: ${e.message}`).join("; ");
}

// --- primitives -------------------------------------------------------------

export const string = (opts: { min?: number; max?: number } = {}): Validator<string> => ({
  name: "string",
  parse(input, path = "") {
    if (typeof input !== "string") return err(path, `expected string, got ${typeName(input)}`);
    if (opts.min !== undefined && input.length < opts.min)
      return err(path, `expected at least ${opts.min} characters, got ${input.length}`);
    if (opts.max !== undefined && input.length > opts.max)
      return err(path, `expected at most ${opts.max} characters, got ${input.length}`);
    return ok(input);
  },
});

export const integer = (opts: { min?: number; max?: number } = {}): Validator<number> => ({
  name: "integer",
  parse(input, path = "") {
    if (typeof input !== "number" || !Number.isInteger(input))
      return err(path, `expected integer, got ${typeName(input)}`);
    if (opts.min !== undefined && input < opts.min)
      return err(path, `expected >= ${opts.min}, got ${input}`);
    if (opts.max !== undefined && input > opts.max)
      return err(path, `expected <= ${opts.max}, got ${input}`);
    return ok(input);
  },
});

export const boolean = (): Validator<boolean> => ({
  name: "boolean",
  parse(input, path = "") {
    if (typeof input !== "boolean") return err(path, `expected boolean, got ${typeName(input)}`);
    return ok(input);
  },
});

/** A calendar day in the user's own timezone, "YYYY-MM-DD". Never a timestamp. */
export const localDate = (): Validator<string> => ({
  name: "localDate",
  parse(input, path = "") {
    if (typeof input !== "string") return err(path, `expected string, got ${typeName(input)}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return err(path, `expected YYYY-MM-DD, got "${input}"`);
    const [y, m, d] = input.split("-").map(Number) as [number, number, number];
    if (m < 1 || m > 12) return err(path, `month out of range in "${input}"`);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d < 1 || d > daysInMonth) return err(path, `day out of range in "${input}"`);
    return ok(input);
  },
});

/** An absolute instant, ISO-8601 UTC. Used for ordering, never for "what day is it". */
export const isoInstant = (): Validator<string> => ({
  name: "isoInstant",
  parse(input, path = "") {
    if (typeof input !== "string") return err(path, `expected string, got ${typeName(input)}`);
    const t = Date.parse(input);
    if (Number.isNaN(t)) return err(path, `expected ISO-8601 instant, got "${input}"`);
    return ok(input);
  },
});

/** An IANA timezone the host runtime actually knows about. */
export const timezone = (): Validator<string> => ({
  name: "timezone",
  parse(input, path = "") {
    if (typeof input !== "string") return err(path, `expected string, got ${typeName(input)}`);
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: input });
    } catch {
      return err(path, `unknown IANA timezone "${input}"`);
    }
    return ok(input);
  },
});

export const oneOf = <const T extends readonly string[]>(
  values: T,
): Validator<T[number]> => ({
  name: `oneOf(${values.join("|")})`,
  parse(input, path = "") {
    if (typeof input !== "string" || !values.includes(input))
      return err(path, `expected one of ${values.join(", ")}; got ${JSON.stringify(input)}`);
    return ok(input as T[number]);
  },
});

export const literal = <const T extends string | number | boolean>(value: T): Validator<T> => ({
  name: `literal(${String(value)})`,
  parse(input, path = "") {
    if (input !== value) return err(path, `expected ${JSON.stringify(value)}`);
    return ok(value);
  },
});

// --- combinators ------------------------------------------------------------

export const optional = <T>(inner: Validator<T>): Validator<T | undefined> => ({
  name: `optional(${inner.name})`,
  parse(input, path = "") {
    if (input === undefined || input === null) return ok(undefined);
    return inner.parse(input, path);
  },
});

export const array = <T>(
  inner: Validator<T>,
  opts: { min?: number; max?: number } = {},
): Validator<T[]> => ({
  name: `array(${inner.name})`,
  parse(input, path = "") {
    if (!Array.isArray(input)) return err(path, `expected array, got ${typeName(input)}`);
    if (opts.min !== undefined && input.length < opts.min)
      return err(path, `expected at least ${opts.min} items, got ${input.length}`);
    if (opts.max !== undefined && input.length > opts.max)
      return err(path, `expected at most ${opts.max} items, got ${input.length}`);
    const out: T[] = [];
    const errors: Issue[] = [];
    input.forEach((item, i) => {
      const r = inner.parse(item, join(path, i));
      if (r.ok) out.push(r.value);
      else errors.push(...r.errors);
    });
    return errors.length ? { ok: false, errors } : ok(out);
  },
});

type Shape = Record<string, Validator<unknown>>;

/**
 * Fields wrapped in `optional()` become genuinely optional keys (`note?: string`)
 * rather than required keys that accept undefined (`note: string | undefined`).
 *
 * The difference is not cosmetic: with the latter, every caller constructing a
 * record has to pass `note: undefined` explicitly, and spreading a conditional
 * `...(x ? {note: x} : {})` fails to type-check. That is a papercut on every
 * screen, so it is fixed once, here.
 */
type ShapeOut<S extends Shape> =
  { [K in keyof S as undefined extends Infer<S[K]> ? never : K]: Infer<S[K]> } &
  { [K in keyof S as undefined extends Infer<S[K]> ? K : never]?: Infer<S[K]> };

/**
 * Strips unknown keys rather than rejecting them. A teen's stored record must
 * survive a schema that has moved on; dropping the extras keeps old clients
 * working instead of locking someone out of their own journal.
 */
export const object = <S extends Shape>(shape: S, name = "object"): Validator<ShapeOut<S>> => ({
  name,
  parse(input, path = "") {
    if (typeof input !== "object" || input === null || Array.isArray(input))
      return err(path, `expected object, got ${typeName(input)}`);
    const src = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const errors: Issue[] = [];
    for (const key of Object.keys(shape)) {
      const validator = shape[key]!;
      const r = validator.parse(src[key], join(path, key));
      if (r.ok) {
        if (r.value !== undefined) out[key] = r.value;
      } else {
        errors.push(...r.errors);
      }
    }
    return errors.length ? { ok: false, errors } : ok(out as ShapeOut<S>);
  },
});

export const record = <T>(inner: Validator<T>): Validator<Record<string, T>> => ({
  name: `record(${inner.name})`,
  parse(input, path = "") {
    if (typeof input !== "object" || input === null || Array.isArray(input))
      return err(path, `expected object, got ${typeName(input)}`);
    const out: Record<string, T> = {};
    const errors: Issue[] = [];
    for (const [k, v] of Object.entries(input)) {
      const r = inner.parse(v, join(path, k));
      if (r.ok) out[k] = r.value;
      else errors.push(...r.errors);
    }
    return errors.length ? { ok: false, errors } : ok(out);
  },
});

/** Narrows on a string discriminant so error messages point at the right variant. */
export const union = <T>(
  discriminant: string,
  variants: Record<string, Validator<T>>,
  name = "union",
): Validator<T> => ({
  name,
  parse(input, path = "") {
    if (typeof input !== "object" || input === null)
      return err(path, `expected object, got ${typeName(input)}`);
    const tag = (input as Record<string, unknown>)[discriminant];
    if (typeof tag !== "string" || !(tag in variants))
      return err(
        join(path, discriminant),
        `expected one of ${Object.keys(variants).join(", ")}; got ${JSON.stringify(tag)}`,
      );
    return variants[tag]!.parse(input, path);
  },
});

/** Adds a cross-field rule that a per-field validator cannot express. */
export const refine = <T>(
  inner: Validator<T>,
  check: (value: T) => string | null,
): Validator<T> => ({
  name: inner.name,
  parse(input, path = "") {
    const r = inner.parse(input, path);
    if (!r.ok) return r;
    const problem = check(r.value);
    return problem === null ? r : err(path, problem);
  },
});

function typeName(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
