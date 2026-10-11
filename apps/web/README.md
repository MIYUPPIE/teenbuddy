# @teenbuddy/web

Next.js 15 App Router. Six screens, exactly the six in `das.md`.

## Run it

```bash
npm run dev --workspace @teenbuddy/web    # http://localhost:3000
```

No configuration needed. No account, no Firebase project, no API key.

## Storage: local by default, Firebase by choice

`src/data/adapter.ts` is the contract; two implementations satisfy it.

The local adapter is **not** a stub. It is the honest default: a teenager can
use every screen with no account and no server, and their journal never leaves
the device. Firebase is what they opt into when they want it on their phone as
well as their laptop, and it switches on only when every
`NEXT_PUBLIC_FIREBASE_*` variable is present — a half-filled `.env.local` falls
back rather than half-initialising.

The Journal screen's privacy line is generated from the adapter actually in use,
so it can never claim something untrue about where the text is going.

Local reads are defensive: a corrupt blob, a disabled storage API, or a record
written by an older schema each degrade to an empty list rather than a white
screen, and a record that fails validation is **skipped, not deleted**, so a
schema fix can recover it. A full disk raises a readable error, because a teen
who pressed Save must not be told it worked.

### Firestore rules

Everything lives under `users/{userId}/…`, which makes ownership one condition
at the top of `firestore.rules` instead of a check repeated per collection where
one omission exposes a journal. There is no admin path, no parent path and no
support path. Anyone who needs a teen's data has to be given it by the teen,
through the app, as a `SupportRequest` carrying only the message they wrote.

Check-ins and completions are immutable after creation — nothing in the product
edits them, and an update path is attack surface for no feature. Unmatched
documents are denied, so a collection added later is closed until someone writes
a rule.

```bash
npx firebase emulators:start        # uses firebase.json
```

## The coach endpoint

`/api/coach` is server-side for two non-negotiable reasons: `@teenbuddy/llm`
spawns the local CLI (which cannot and must not happen in a browser), and the
safety gate must run where a client cannot skip it. A browser can POST anything;
the gate lives behind the route.

With no model available it still answers — templates only, deterministic safety
tier intact. Degraded, never unsafe.

## Design system

Built on shadcn/ui conventions as showcased on [21st.dev](https://21st.dev): a
neutral OKLCH palette, generous radii, subtle layered elevation rather than
heavy shadow, transform-based hover, and spring motion.

One rule overrides the aesthetic wherever they conflict: **this app is opened by
someone having a bad night.** Surfaces stay quiet, contrast stays high, and
nothing draws attention it has not earned. Red is reserved — nothing uses
`--urgent` except a genuine emergency.

Tokens live in `src/app/globals.css`. The ground is a warm neutral rather than
pure grey (less clinical), the accent is periwinkle (calm, not corporate blue,
not alarming), and dark mode is a full re-tint rather than an inversion because
this app gets opened at 1am more often than at 1pm.

44px minimum tap targets, `font-variant-numeric: tabular-nums` on every changing
number, and `robots: noindex` — a teenager's app should not appear in someone
else's search results.

## Colour

Every mood, cause, pillar and lesson category carries its own hue. Colour is
**information**: a teen learns violet means Mind and amber means Habits long
before they read either label, and the journal shows the shape of a month
because each entry is tinted by that day's mood.

`src/lib/palette.ts` stores **only the hue angle**. Lightness and chroma come
from the theme, which is what lets one number per concept drive a solid fill, a
soft background, a border and readable text, in both themes, with no second
palette to drift out of sync:

```css
[style*="--h"] {
  --tint-bg:    oklch(96% 0.05 var(--h));
  --tint-fg:    oklch(42% 0.17 var(--h));   /* body text, clears AA at every hue */
  --tint-fg-lg: oklch(56% 0.21 var(--h));   /* >=24px bold only, WCAG 3:1        */
  --tint-solid: oklch(60% 0.20 var(--h));
  --tint-grad:  linear-gradient(135deg, oklch(58% 0.19 var(--h)), oklch(66% 0.18 calc(var(--h) + 16)));
}
```

Contrast is baked into the lightness values rather than left to the hue. The
separate `--tint-fg-lg` exists because amber at AA body contrast is brown — the
brighter value is only safe on large bold text, and the class name says so.

The hue maps are `Record<Enum, number>`, so adding a mood to
`@teenbuddy/contracts` **fails to compile** until it has a colour. A test
asserts the same at runtime, that no two pillars collide, and that opposite
feelings sit far apart on the wheel.

**Two colours are deliberately withheld.** `topicHue("not_safe")` returns
`null`, so the emergency option cannot pick up a cheerful tint and stays in the
reserved urgent red. And nothing but a genuine emergency uses `--urgent`.

### Contrast is measured, not eyeballed

The fill lightness in `--tint-grad` and `--tint-solid` is set by measurement.
White text on a tinted fill at L=0.58 gives only **3.47:1** at the worst hue on
the wheel; the day ramp therefore runs 0.44 → 0.50, where the worst case is
4.81:1. The gradient's *lighter* end is the one that has to pass.

In night mode the fill is bright and the label is dark (`--tint-on` flips with
the theme), because a saturated colour at 70% lightness cannot carry white body
text.

A **disabled control is never a faded colour fill.** `opacity: 0.45` over a pale
gradient made "Save check-in" invisible in day mode — the bug that prompted this.
Disabled buttons now revert to a flat neutral surface with `--text-2` text.
WCAG exempts disabled controls from contrast, but a teen still has to read what
the button will do once the form is complete.

`src/lib/oklch.ts` converts OKLCH → sRGB → WCAG luminance so this is a free
deterministic gate test rather than a screenshot review. `test/contrast.test.ts`
**parses the lightness values out of `globals.css`**, so it cannot pass while the
stylesheet says something else, and checks every hue the app can render in both
themes. It also asserts the original failing case still fails, so the test can
never quietly become vacuous.

The trade-off worth knowing: at AA-safe lightness, amber in day mode reads closer
to rust than to gold. Readability won.

## Interaction

Every control responds the moment it is touched. `Pressable` fires three layers
together, which is the difference between "a link" and "a control that felt good
to tap":

- a **spring scale**, so the surface yields;
- a **ripple originating at the finger**, so the feedback is about *that* tap
  rather than a generic flash;
- a **haptic buzz** (`navigator.vibrate`, 8–22ms) on hardware that has one.

It renders a real `<button>` or `<a>`, so keyboard, focus ring, disabled state
and screen-reader semantics are the platform's rather than a reimplementation.

Other responses: growth pillars are **animated rings** (four in a row are
comparable at a glance in a way four bars are not), numbers **count up**,
selecting a mood **tints the surrounding card**, chips reflow with a layout
spring, and journal entries animate *out* on delete so a mis-tap is legible.

**Confetti is earned, never ambient.** A zero-dependency canvas burst in the
product's own hues fires on a completed challenge, a finished lesson and an
unlocked achievement — and nowhere else. An app that celebrates constantly is an
app whose celebrations mean nothing, and teenagers can tell when they are being
managed. `fire` is a counter rather than a boolean, so re-earning re-triggers.

## Day and night

Three options — **Day**, **Night**, **Auto** — in Profile. Auto is the default,
because a teenager who has set their whole phone to dark should not have to set
this app separately.

The entire theme is **one CSS property**. Every colour token is declared once as
`light-dark(day, night)` and resolves off `color-scheme` on `:root`:

```css
:root                    { color-scheme: light dark; }  /* follows the device */
:root[data-theme="light"]{ color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
```

That replaced two parallel `@media (prefers-color-scheme: dark)` blocks. The old
shape worked but let the palettes drift: a token added to one block and
forgotten in the other is invisible until someone switches theme. There are now
zero `prefers-color-scheme` rules in the stylesheet, and a token physically
cannot exist in one theme only.

`auto` **removes** the attribute rather than writing `"auto"`, so the device
decides — including when the phone flips at sunset while the app is open, which
a `matchMedia` listener picks up live.

### No white flash at 1am

The server sends no `data-theme`, so without intervention a teen who chose Night
gets a full-brightness white flash before hydration corrects it — at exactly the
hour this app gets opened. A small inline script in `<head>` sets the attribute
before first paint. It is wrapped in try/catch (a throw there would block the
page), and it sets the `theme-color` meta as well as the attribute, or the
status bar stays on the previous theme until the control is next touched.

Gate tests cover it, because an inline string is easy to break silently: that it
parses, that it stays wrapped in try/catch, that it reads the same storage key
the app writes, that it contains no `</script>`, that it sets the meta tag, and
that the theme colours are real sRGB values whose luma actually matches their
names.

### Hover is an overlay, never a background swap

`button:hover:not(:disabled)` has specificity (0,2,1) and beat **every** fill
class — `.tinted-grad`, `.chip[aria-pressed]`, `.btn-primary`, `.btn-urgent`.
Setting `background` there replaced the fill and, being the shorthand, wiped the
gradient with it. The label colour did not change, so six controls became white
text on pale grey the instant a cursor touched them: 6.4:1 at rest, **1.07:1**
hovered.

Hover is now a `currentColor` veil on `::after`. It composites over whatever
fill is already there, so it works on every variant automatically — including
ones added later — instead of competing with them.

The veil costs contrast, so the day fill was darkened to compensate: at L=0.50
the worst hue lands on 4.17:1 while hovered, so the ramp runs 0.40 → 0.46, where
the same case is 4.82:1. Gate tests check the veiled contrast at every hue in
both themes, and assert no hover rule sets a background.

**Note on verifying hover:** headless Chrome reports `hover: none` and CDP's
`setEmulatedMedia` will not change it, so `@media (hover: hover)` never applies
and a hover audit silently passes without testing anything. Launch Chrome with
`--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4`.
The first version of this audit reported "no control loses contrast on hover"
while all six were broken.

### The primary action is pinned in stepped flows

The Help Now intervention gains a script line per tap. By the fourth tap the
Next button had slid behind the fixed tab bar, and by the fifth it was off the
bottom of the screen with nothing scrolling it back — someone mid-panic left on
a screen with no visible way forward. It was never a colour problem, which is
why a contrast audit missed it entirely: the audit only ever loaded the topic
list, never the view behind a click.

`.action-bar` pins the action with `position: sticky` at `--tab-h`. That holds
for any content length on any device height, which `scrollIntoView` would not —
that treats the symptom one step at a time and jerks the page under someone who
is trying to breathe.

The script also shows **one line at a time** rather than accumulating. Showing
the whole script asks someone mid-panic to work out which line they are on, and
it was what grew the page underneath them in the first place. A step counter
beside the progress bar carries position instead, and the card holds a minimum
height so the layout does not jump between short and long lines.

**The real fix, in the end, was not to need the pinning.** The exercise is now
sized to fit a 640px phone outright: the orb scales with `dvh`, the round count
and pause control share a row, and the bottom gutter tightens under
`max-height: 720px`. If nothing scrolls, nothing can scroll away — and the
button stays reachable even where `position: sticky` does nothing, which is the
case on some mobile browsers when the sticky element sits inside a flex column.
A test asserts the button is visible *with sticky forcibly disabled* at 360×640,
375×667, 393×852 and 412×915.

Two further things had to change for the pinning to survive a real phone:
`body` uses `overflow-x: clip` rather than `hidden` (`hidden` forces
`overflow-y: auto`, turning `<body>` into a scroll container so every
descendant's `position: sticky` resolves against a box that never scrolls —
desktop Chrome tolerates this, mobile browsers do not), and the viewport
declares `viewport-fit=cover` so `env(safe-area-inset-bottom)` resolves on iOS
instead of collapsing to zero under the home indicator. Both are gate-tested.

Every other screen's primary action was checked at 375×667 (the smallest phone
worth supporting) and is reachable by ordinary scrolling, so nothing else needed
pinning.

### The content column is centred on both axes

Horizontally by `margin-inline: auto` against a 640px measure. Vertically by
`margin-block: auto` on the single child — **not** `justify-content: center`.

That distinction matters: centring a flex container whose content overflows
pushes the top of the content above the scroll origin, where it cannot be
scrolled to. Auto margins collapse to zero the moment the content is taller than
the column, so a short screen (the Help topic list, an empty journal) sits
balanced in the middle while a long one (Learn, a lesson) scrolls from the top
as normal. Verified by asserting nothing renders above y=0 on any screen.

The tab bar spans the window so its blur and border reach the edges, but its
links are padded to line up with the same 640px column on desktop.

## Motion

Three rules, in priority order.

**1. Entrances are CSS. JavaScript animates only what CSS cannot.**

The usual framer-motion pattern sets inline `opacity: 0` and animates up from
there, which means content is invisible until a JS animation runs. If the bundle
stalls or hydration throws, a teenager who came here for help gets a blank
screen. This was not hypothetical — an early build of this redesign rendered
exactly that, caught by screenshotting the real page.

So entrances (`.page-enter`, `.stagger > *`) are CSS keyframes with `nth-child`
delays. The only way to see nothing is for the stylesheet itself to fail, in
which case the animation never applies and everything is simply visible.

`motion` is kept for what CSS genuinely cannot do: exit animations
(`AnimatePresence` on journal entries and trusted people), the shared-element
tab indicator (`layoutId`), gesture springs, layout animations, and the
breathing orb.

**2. Reduced motion is a layout, not a degradation.**

Every JS primitive checks `useReducedMotion()` and renders the *finished* state.
CSS entrances use `animation: none` rather than a 0ms duration, so `both` fill
mode cannot strand an element on its `opacity: 0` first frame — the usual way
this gets broken.

**3. Motion carries meaning or it does not ship.**

| Screen | What moves, and why |
| --- | --- |
| Home | Cards arrive in reading order, then hold still. The streak flame breathes slowly; growth bars spring to their value and count up. |
| Check-in | Three steps *swap* rather than stack, so a teen struggling with the first question cannot see the other two. |
| Help Now | Topic list staggers. Script lines accumulate and dim so the current instruction never competes with the previous one. |
| **Help Now → breathing** | The **orb is the exercise**: it expands for 4, holds for 4, contracts for 6. Someone mid-panic cannot reliably count seconds, so the orb counts for them, and the contraction is visibly the longest phase because the long out-breath is what actually calms the nervous system. |
| Learn | Reading-progress bar; lesson paragraphs and the takeaway callout. |
| Journal | Entries animate *out* on delete, so a mis-tap is legible — you can see which one went. |
| Profile | Spring switches, achievements pop once when earned (never looping), and the erase confirmation *expands* so the destructive button is never where the safe button just was. |

**The crisis path is the least animated screen in the product.** It fades,
slowly, and holds still. A screen that slides and springs while someone is
telling you they are in danger reads as software being pleased with itself.

## Dev and production build directories

`next.config.mjs` sets `distDir` to `.next-dev` in development and `.next` in
production. Sharing one directory lets a production build's chunks (including
the pages-router `_document.js`) collide with the dev server's app-router
chunks, which surfaces as `Cannot find module './901.js'` or
`Cannot find module for page: /_not-found`. Both look like source errors and are
not. Separating them makes the collision impossible rather than something you
clear by hand when it bites.

## Where it would break

- **No real authentication.** The local adapter generates a device-scoped random
  id. Wiring Firebase Auth is the next step for multi-device, and it changes the
  privacy story enough to deserve its own decision.
- **Support requests are stored, not delivered.** The trusted-person flow writes
  a `SupportRequest` and tells the teen it is saved. Actually sending the SMS or
  email needs a server-side sender and a verification flow for the adult, which
  is Phase 3 in the spec's own ordering.
- **No offline sync.** Firebase mode assumes connectivity. The local adapter has
  no sync at all, by design.
- **No component tests.** The data layer is tested (18 tests); the screens are
  verified by the production build, by hitting every route, and by driving real
  Chrome over CDP to screenshot and assert on live state (the breathing orb's
  phase, countdown and scale; the check-in step flow). None of that is
  automated into the gate yet — a Playwright suite is the gap.

## Test

```bash
npm test --workspace @teenbuddy/web
npx next build       # from apps/web
```
