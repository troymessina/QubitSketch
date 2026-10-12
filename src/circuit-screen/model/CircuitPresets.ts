/**
 * CircuitPresets.ts
 *
 * A curated set of named example circuits for the "Example Circuits" dropdown. Each preset is
 * built only from supported gates and fits inside MAX_QUBITS × NUM_STEPS, so it round-trips
 * through `QubitSketchModel.loadCircuit`. Algorithm demos use teaching-scale instances and the
 * deferred-measurement form (this tool has no mid-circuit measurement) — see AGENTS.md scope.
 *
 * Endianness (per GateType.ts): qubit 0 is the LEAST-significant bit; a controlled gate is a
 * `control`/`antiControl` cell sharing a column with a `controlledTarget`, and two `swap` cells
 * in one column exchange those wires.
 */
import type { MutableGrid } from "./CircuitGrid.js";
import { emptyGrid } from "./CircuitGrid.js";
import type { CircuitCell, GateType, RotationAxis } from "./GateType.js";

type Grid = MutableGrid;

/** A named, ready-to-load example circuit. `id` keys the localized name in StringManager. */
export type CircuitPreset = {
  readonly id: string;
  readonly qubitCount: number;
  readonly build: () => Grid;
};

// ── Cell-placement helpers (mutate `g` at [qubit][col]) ──────────────────────────────────────
const set = (g: Grid, q: number, col: number, cell: CircuitCell): void => {
  const row = g[q];
  if (row) {
    row[col] = cell;
  }
};
const gate = (g: Grid, q: number, col: number, name: GateType): void => set(g, q, col, { kind: "gate", gate: name });
const ctrl = (g: Grid, q: number, col: number): void => set(g, q, col, { kind: "control" });
const target = (g: Grid, q: number, col: number, name: GateType): void =>
  set(g, q, col, { kind: "controlledTarget", gate: name });
const swap = (g: Grid, q: number, col: number): void => set(g, q, col, { kind: "swap" });
const param = (g: Grid, q: number, col: number, axis: RotationAxis, theta: number): void =>
  set(g, q, col, { kind: "paramGate", axis, theta });

/** Bell state (|00⟩+|11⟩)/√2: H then CNOT. */
function bell(): Grid {
  const g = emptyGrid();
  gate(g, 0, 0, "H");
  ctrl(g, 0, 1);
  target(g, 1, 1, "X");
  return g;
}

/** GHZ state (|000⟩+|111⟩)/√2: H then a CNOT ladder. */
function ghz(): Grid {
  const g = emptyGrid();
  gate(g, 0, 0, "H");
  ctrl(g, 0, 1);
  target(g, 1, 1, "X");
  ctrl(g, 1, 2);
  target(g, 2, 2, "X");
  return g;
}

/** CHSH / Bell-inequality demo: an entangled pair viewed through two measurement-angle rotations. */
function chsh(): Grid {
  const g = emptyGrid();
  gate(g, 0, 0, "H");
  ctrl(g, 0, 1);
  target(g, 1, 1, "X");
  param(g, 0, 2, "Y", Math.PI / 4);
  param(g, 1, 2, "Y", -Math.PI / 4);
  return g;
}

/**
 * Quantum teleportation (deferred-measurement form). q0 carries the state to send (prepared with
 * an Ry so its Bloch vector is distinctive); q1,q2 are a Bell pair. The Bell-measurement is
 * deferred into CX/CZ corrections, so after the circuit q2 holds q0's original state.
 */
function teleport(): Grid {
  const g = emptyGrid();
  param(g, 0, 0, "Y", Math.PI / 3); // prepare the unknown state on q0
  gate(g, 1, 0, "H"); // start the q1,q2 Bell pair
  ctrl(g, 1, 1);
  target(g, 2, 1, "X"); // finish the Bell pair
  ctrl(g, 0, 2);
  target(g, 1, 2, "X"); // entangle the message into the pair
  gate(g, 0, 3, "H");
  ctrl(g, 1, 4);
  target(g, 2, 4, "X"); // X correction (deferred)
  ctrl(g, 0, 5);
  target(g, 2, 5, "Z"); // Z correction (deferred)
  return g;
}

/** Superdense coding: a Bell pair, a 2-bit Pauli encoding on q0, then a Bell-basis decode. */
function superdense(): Grid {
  const g = emptyGrid();
  gate(g, 0, 0, "H");
  ctrl(g, 0, 1);
  target(g, 1, 1, "X"); // shared Bell pair
  gate(g, 0, 2, "Z");
  gate(g, 0, 3, "X"); // encode the message "11" (Z then X)
  ctrl(g, 0, 4);
  target(g, 1, 4, "X");
  gate(g, 0, 5, "H"); // decode → a deterministic basis state
  return g;
}

/** Grover search over 2 qubits (1 marked item, |11⟩): one oracle + diffusion iteration → certainty. */
function grover(): Grid {
  const g = emptyGrid();
  gate(g, 0, 0, "H");
  gate(g, 1, 0, "H");
  ctrl(g, 0, 1);
  target(g, 1, 1, "Z"); // oracle: phase-flip |11⟩ (CZ)
  gate(g, 0, 2, "H");
  gate(g, 1, 2, "H");
  gate(g, 0, 3, "X");
  gate(g, 1, 3, "X");
  ctrl(g, 0, 4);
  target(g, 1, 4, "Z"); // diffusion reflection (CZ)
  gate(g, 0, 5, "X");
  gate(g, 1, 5, "X");
  gate(g, 0, 6, "H");
  gate(g, 1, 6, "H");
  return g;
}

/** 3-qubit Quantum Fourier Transform: H + controlled-phase ladder + a final SWAP. */
function qft(): Grid {
  const g = emptyGrid();
  gate(g, 2, 0, "H");
  ctrl(g, 1, 1);
  target(g, 2, 1, "S"); // controlled-S (q1→q2)
  ctrl(g, 0, 2);
  target(g, 2, 2, "T"); // controlled-T (q0→q2)
  gate(g, 1, 3, "H");
  ctrl(g, 0, 4);
  target(g, 1, 4, "S"); // controlled-S (q0→q1)
  gate(g, 0, 5, "H");
  swap(g, 0, 6);
  swap(g, 2, 6); // bit-reversal SWAP
  return g;
}

/** Reversible half-adder of a=1, b=1: Toffoli computes the carry, then a CNOT computes the sum. */
function adder(): Grid {
  const g = emptyGrid();
  gate(g, 0, 0, "X");
  gate(g, 1, 0, "X"); // inputs a=1, b=1
  ctrl(g, 0, 1);
  ctrl(g, 1, 1);
  target(g, 2, 1, "X"); // carry = a AND b → q2
  ctrl(g, 0, 2);
  target(g, 1, 2, "X"); // sum = a XOR b → q1
  return g;
}

/**
 * Delayed-choice quantum eraser: which-path info is written into a marker qubit, then erased.
 *
 * Reading the display: the final state is (|00⟩+|11⟩)/√2, so q0 on its own is still 50/50 — the
 * restored interference shows up as the perfect CORRELATION between q0 and the marker, not as a
 * change in q0's probability bar. Recovering a single-qubit fringe pattern would require
 * conditioning on the marker's outcome, and this tool has no mid-circuit measurement (see
 * doc/model.md). The joint distribution is where the erasure is visible.
 */
function eraser(): Grid {
  const g = emptyGrid();
  gate(g, 0, 0, "H"); // path superposition
  ctrl(g, 0, 1);
  target(g, 1, 1, "X"); // copy which-path info into the marker
  gate(g, 1, 2, "H"); // the "eraser" on the marker
  gate(g, 0, 3, "H"); // recombine the paths
  return g;
}

/** Symmetry breaking: a symmetric product superposition turned into an entangled state by a CZ. */
function symmetry(): Grid {
  const g = emptyGrid();
  gate(g, 0, 0, "H");
  gate(g, 1, 0, "H"); // symmetric uniform product state
  ctrl(g, 0, 1);
  target(g, 1, 1, "Z"); // CZ breaks the product symmetry → entanglement
  return g;
}

/** The curated lineup, in a rough teaching order. `id` matches the localized names in StringManager. */
export const CIRCUIT_PRESETS: readonly CircuitPreset[] = [
  { id: "bell", qubitCount: 2, build: bell },
  { id: "ghz", qubitCount: 3, build: ghz },
  { id: "chsh", qubitCount: 2, build: chsh },
  { id: "teleport", qubitCount: 3, build: teleport },
  { id: "superdense", qubitCount: 2, build: superdense },
  { id: "eraser", qubitCount: 2, build: eraser },
  { id: "symmetry", qubitCount: 2, build: symmetry },
  { id: "grover", qubitCount: 2, build: grover },
  { id: "qft", qubitCount: 3, build: qft },
  { id: "adder", qubitCount: 3, build: adder },
];
