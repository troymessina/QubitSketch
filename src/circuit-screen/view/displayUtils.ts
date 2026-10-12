/**
 * displayUtils.ts
 *
 * Small formatting helpers shared by the simulation display nodes.
 */
import type { Complex } from "scenerystack/dot";
import { toFixed } from "scenerystack/dot";
import type { Color } from "scenerystack/scenery";
import { NEUTRAL_PHASE_COLOR } from "../../QubitSketchColors.js";
import { twilightColor } from "./twilightColormap.js";

/**
 * Magnitude² below which an amplitude is treated as zero: its phase is undefined and it
 * renders as "negligible" (neutral color / em-dash). Shared by every amplitude display so
 * they agree on what counts as empty.
 */
export const NEGLIGIBLE_AMPLITUDE = 1e-9;

// Row font auto-sizing for the basis-state list displays (probabilities, amplitudes, shots).
const MIN_ROW_FONT_SIZE = 7;
const MAX_ROW_FONT_SIZE = 11;
/** Vertical padding subtracted from a row's height to leave breathing room around its text. */
const ROW_FONT_PADDING = 3;

/**
 * Monospace font sized to fit one row of a basis-state list, clamped so tall rows stay legible
 * and short rows never overflow. Shared by the probability, amplitude, and histogram displays,
 * which all auto-scale row height to a fixed box.
 */
export function basisRowFont(rowHeight: number): string {
  const size = Math.max(MIN_ROW_FONT_SIZE, Math.min(MAX_ROW_FONT_SIZE, rowHeight - ROW_FONT_PADDING));
  return `${size}px monospace`;
}

/**
 * Maps a phase angle (radians) to a color via matplotlib's cyclic "twilight" colormap, so
 * phase relationships read as color. The full turn (2π) maps onto the colormap and wraps
 * seamlessly: phase 0 ↔ light, ±π ↔ the dark center, with the two signs taking opposite arms.
 */
export function phaseAngleToColor(phaseRadians: number): Color {
  return twilightColor(phaseRadians / (2 * Math.PI));
}

/** Color for an amplitude's phase, or a neutral gray when the amplitude is ≈ 0 (phase undefined). */
export function phaseToColor(amp: Complex, threshold = NEGLIGIBLE_AMPLITUDE): Color {
  return amp.magnitudeSquared < threshold ? NEUTRAL_PHASE_COLOR : phaseAngleToColor(amp.phase());
}

/**
 * Big-endian ket label for basis-state index `i` on `n` qubits, e.g. i=2, n=3 → "|010⟩".
 * (Qubit 0 is the least-significant bit, so it is the rightmost digit — see GateType.ts.)
 */
export function ketLabel(i: number, n: number): string {
  let bits = "";
  for (let q = n - 1; q >= 0; q--) {
    bits += (i >> q) & 1;
  }
  return `|${bits}⟩`;
}

/**
 * True minus sign (U+2212). `toFixed` emits an ASCII hyphen, which is narrower than the "+" it
 * alternates with in an amplitude like "0.71+0.00i" — so every sign this module renders goes
 * through {@link toFixedSigned} or uses this constant, never a bare hyphen.
 */
const MINUS_SIGN = "−";

/**
 * `toFixed` with the ASCII hyphen swapped for a true minus sign. A value that rounds to zero
 * loses its sign entirely, so a tiny negative amplitude reads "0.00" rather than "−0.00".
 */
function toFixedSigned(value: number, digits: number): string {
  const text = toFixed(value, digits);
  if (/^-0(\.0*)?$/.test(text)) {
    return text.slice(1);
  }
  return text.replace("-", MINUS_SIGN);
}

/** Formats a complex amplitude as "a+bi" with fixed precision (e.g. "0.71+0.00i"). */
export function formatComplex(c: Complex, digits = 2): string {
  const re = toFixedSigned(c.real, digits);
  const im = toFixed(Math.abs(c.imaginary), digits);
  // Take the sign from the ROUNDED magnitude, so a vanishing imaginary part never reads "−0.00i".
  const negative = c.imaginary < 0 && Number.parseFloat(im) !== 0;
  return `${re}${negative ? MINUS_SIGN : "+"}${im}i`;
}

/** Formats a phase in radians as a degree string (e.g. "90°"); blank for ~zero amplitude. */
export function formatPhase(c: Complex, threshold = NEGLIGIBLE_AMPLITUDE): string {
  if (c.magnitudeSquared < threshold) {
    return "—";
  }
  const deg = (c.phase() * 180) / Math.PI;
  return `${toFixedSigned(deg, 0)}°`;
}
