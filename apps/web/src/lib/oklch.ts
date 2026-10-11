/**
 * OKLCH -> sRGB -> WCAG relative luminance.
 *
 * Exists so contrast can be checked in a free, deterministic gate test instead
 * of by looking at screenshots. The whole palette is expressed in OKLCH, so
 * without this the only way to know whether a label is readable is to render
 * the page and measure pixels - which is how the "buttons don't show in day
 * mode" bug got in.
 *
 * Conversion follows Björn Ottosson's published OKLab matrices.
 */

export type RGB = { r: number; g: number; b: number };

/** OKLCH to linear-light sRGB, unclamped so out-of-gamut colours stay visible. */
export function oklchToLinearSrgb(L: number, C: number, hDeg: number): RGB {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * WCAG relative luminance.
 *
 * Clamped to gamut first: a display cannot show an out-of-gamut colour, so the
 * contrast a person actually sees is the contrast of the clipped colour.
 */
export function luminance(L: number, C: number, h: number): number {
  const { r, g, b } = oklchToLinearSrgb(L, C, h);
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

/** WCAG contrast ratio between two OKLCH colours. */
export function contrast(
  a: [L: number, C: number, h: number],
  b: [L: number, C: number, h: number],
): number {
  const [hi, lo] = [luminance(...a), luminance(...b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Gamma-encoded sRGB hex, for comparing against a browser-measured value. */
export function toHex(L: number, C: number, h: number): string {
  const lin = oklchToLinearSrgb(L, C, h);
  const encode = (v: number): string => {
    const c = clamp01(v);
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255).toString(16).padStart(2, "0");
  };
  return `#${encode(lin.r)}${encode(lin.g)}${encode(lin.b)}`;
}

/** Gamma-encoded sRGB channels, 0-255. */
export function toSrgb255(L: number, C: number, h: number): [number, number, number] {
  const lin = oklchToLinearSrgb(L, C, h);
  const encode = (v: number): number => {
    const c = Math.min(1, Math.max(0, v));
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return srgb * 255;
  };
  return [encode(lin.r), encode(lin.g), encode(lin.b)];
}

/** WCAG luminance of an sRGB triple. */
export function luminance255([r, g, b]: [number, number, number]): number {
  const f = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast255(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance255(a), luminance255(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Composites `over` onto `base` at `alpha`, the way a CSS overlay does.
 * Browsers blend opacity in gamma-encoded sRGB, so this mixes 0-255 values
 * directly rather than linearising first.
 */
export function composite(
  base: [number, number, number],
  over: [number, number, number],
  alpha: number,
): [number, number, number] {
  return [0, 1, 2].map((i) => base[i]! * (1 - alpha) + over[i]! * alpha) as [number, number, number];
}
