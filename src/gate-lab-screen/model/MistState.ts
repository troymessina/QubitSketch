/**
 * MistState.ts
 *
 * Reduces a statevector to the book's "mist" — the list of surviving ball-color
 * configurations, each carrying a sign (the book's "−" label; see doc/model.md).
 * Gate Lab's palette (NOT, PETE/Hadamard, control, SWAP — see GATE_LAB_TOOL_VALUES in
 * GateType.ts) only ever produces real matrix entries, so starting from a real
 * computational-basis input (see CircuitEditingModel's inputBitsProperty) keeps every
 * amplitude exactly real: no magnitude/phase reading is needed, only a sign. Real
 * destructive interference (two configurations differing only in sign) already zeroes
 * the amplitude in `simulate`, so no separate cancellation step is needed here.
 */
import type { Complex } from "scenerystack/dot";

/** One surviving ball configuration in the mist: which basis state, and its sign. */
export type MistRow = { readonly bits: number; readonly sign: 1 | -1 };

/** Amplitudes with |α|² below this are treated as absent from the mist. */
const ZERO_PROBABILITY_TOLERANCE = 1e-9;

/** An amplitude's imaginary part must stay within this of zero for the book-faithful gate set. */
const REAL_TOLERANCE = 1e-9;

/**
 * Reduces a statevector to its mist rows, in basis-index order. Throws if an amplitude has a
 * non-negligible imaginary part — which would mean a non-book gate slipped into the circuit,
 * since Gate Lab's whole display model assumes real ±1 amplitudes.
 */
export function computeMistRows(state: readonly Complex[]): MistRow[] {
  const rows: MistRow[] = [];
  for (let bits = 0; bits < state.length; bits++) {
    const amp = state[bits];
    if (amp === undefined || amp.magnitudeSquared < ZERO_PROBABILITY_TOLERANCE) {
      continue;
    }
    if (Math.abs(amp.imaginary) > REAL_TOLERANCE) {
      throw new Error(`computeMistRows: amplitude at |${bits}⟩ is not real (${amp.real}+${amp.imaginary}i)`);
    }
    rows.push({ bits, sign: amp.real >= 0 ? 1 : -1 });
  }
  return rows;
}
