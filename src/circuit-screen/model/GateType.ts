/**
 * GateType.ts
 *
 * Defines the set of supported single-qubit quantum gates and the data types
 * used to describe a circuit grid.
 *
 * Endianness convention (used everywhere — simulator and displays):
 *   qubit 0 is the LEAST-significant bit. A basis-state index `i` has qubit `q`
 *   set iff `(i >> q) & 1`. The model row `circuit[q]` therefore maps directly to
 *   bit `q`. Kets are displayed big-endian as |q_{n-1} … q_1 q_0⟩.
 */

export const GateType = {
  H: "H", // Hadamard — creates equal superposition: |0⟩→(|0⟩+|1⟩)/√2
  X: "X", // Pauli-X — quantum NOT gate: |0⟩↔|1⟩
  Y: "Y", // Pauli-Y — combined bit and phase flip
  Z: "Z", // Pauli-Z — phase flip: |1⟩→-|1⟩
  S: "S", // Phase (S) gate — adds π/2 phase to |1⟩
  T: "T", // T gate — adds π/4 phase to |1⟩
  Sdg: "Sdg", // S† (S-dagger) — inverse phase: adds −π/2 phase to |1⟩
  Tdg: "Tdg", // T† (T-dagger) — inverse T: adds −π/4 phase to |1⟩
  Vx: "Vx", // √X — square root of NOT (X = Vx·Vx)
} as const;

export type GateType = (typeof GateType)[keyof typeof GateType];

/** Axis of a parametrized single-qubit rotation gate (Rx, Ry, Rz). */
export type RotationAxis = "X" | "Y" | "Z";

/**
 * A single cell in the circuit grid — a discriminated union.
 *   empty            — nothing placed
 *   gate             — a plain single-qubit gate
 *   control          — a control dot (•); makes gates in the SAME column controlled (on |1⟩)
 *   antiControl      — an open control dot (◦); conditions on the qubit being |0⟩
 *   controlledTarget — the target of a controlled operation (defaults to X = CNOT);
 *                      semantically identical to a gate sharing a column with a control,
 *                      but tagged so the view can draw it differently.
 *   swap             — one endpoint of a SWAP (✕); a column with exactly two swaps exchanges
 *                      those two wires.
 *   paramGate        — a parametrized rotation R_axis(theta) about the X, Y, or Z axis.
 */
export type CircuitCell =
  | { readonly kind: "empty" }
  | { readonly kind: "gate"; readonly gate: GateType }
  | { readonly kind: "control" }
  | { readonly kind: "antiControl" }
  | { readonly kind: "controlledTarget"; readonly gate: GateType }
  | { readonly kind: "swap" }
  | { readonly kind: "paramGate"; readonly axis: RotationAxis; readonly theta: number };

export const EMPTY_CELL: CircuitCell = { kind: "empty" };

/** True if the cell is a filled control dot (conditions on |1⟩). */
export function isControl(cell: CircuitCell): boolean {
  return cell.kind === "control";
}

/** True if the cell is a control of either polarity (• on |1⟩ or ◦ on |0⟩). */
export function isAnyControl(cell: CircuitCell): boolean {
  return cell.kind === "control" || cell.kind === "antiControl";
}

/** Returns the (named) gate this cell applies, or null if it bears no such gate. */
export function cellGate(cell: CircuitCell): GateType | null {
  return cell.kind === "gate" || cell.kind === "controlledTarget" ? cell.gate : null;
}

/** True if the cell applies a 2×2 unitary (a fixed gate, a controlled target, or a rotation). */
export function isGateBearing(cell: CircuitCell): boolean {
  return cell.kind === "gate" || cell.kind === "controlledTarget" || cell.kind === "paramGate";
}

/** Structural equality of two cells (same kind and, where applicable, same gate/axis/angle). */
export function cellsEqual(a: CircuitCell, b: CircuitCell): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if ((a.kind === "gate" || a.kind === "controlledTarget") && (b.kind === "gate" || b.kind === "controlledTarget")) {
    return a.gate === b.gate;
  }
  if (a.kind === "paramGate" && b.kind === "paramGate") {
    return a.axis === b.axis && a.theta === b.theta;
  }
  return true;
}

/** A parametrized-rotation placement tool. Maps to a {@link RotationAxis} (Rx→X, Ry→Y, Rz→Z). */
export type RotationTool = "Rx" | "Ry" | "Rz";

/** The axis each rotation tool places. */
export const ROTATION_TOOL_AXIS: Record<RotationTool, RotationAxis> = { Rx: "X", Ry: "Y", Rz: "Z" };

/** The currently active placement tool (a gate, a control/swap marker, a rotation, or the eraser). */
export type SelectedTool = GateType | "control" | "antiControl" | "swap" | RotationTool | "eraser";

/** Every selectable placement tool, in palette order. Drives the tool Property's valid values. */
export const SELECTED_TOOL_VALUES: SelectedTool[] = [
  ...Object.values(GateType),
  "control",
  "antiControl",
  "swap",
  "Rx",
  "Ry",
  "Rz",
  "eraser",
];

export const NUM_STEPS = 8;
export const MAX_QUBITS = 5;
export const MIN_QUBITS = 1;
/** Default number of visible qubit wires when no preference/query-parameter overrides it. */
export const DEFAULT_QUBITS = 3;

// ── GateLabScreen ("Q is for Quantum" companion) constants ─────────────────────────
// Gate Lab's own, smaller wire-count range and restricted tool palette. It shares the same
// underlying grid (allocated at the global MAX_QUBITS × NUM_STEPS above) and simulator as
// CircuitScreen — see CircuitEditingModel.ts — just with a tighter UI-visible range and vocabulary
// matching the book: NOT (X), PETE (H), control, swap, eraser. CNOT/Toffoli/CSWAP are built the
// same compositional way CircuitScreen already supports (control(s) sharing a column with a
// target gate or a SWAP pair) — no separate tool is needed for them.
export const GATE_LAB_MIN_QUBITS = 1;
export const GATE_LAB_MAX_QUBITS = 3;
export const GATE_LAB_DEFAULT_QUBITS = 2;

/** Gate Lab's palette tools, in the book's introduction order. No anti-control (◦) or rotation
 * gates (Rx/Ry/Rz) — the book never uses them, and rotations would leave the real-±1 amplitude
 * world the mist display assumes. The `satisfies` (rather than a `SelectedTool[]` annotation)
 * keeps the literal tuple type, so callers iterating this array get a fully narrowed
 * `"X" | "H" | "control" | "swap" | "eraser"` element type instead of the full `SelectedTool` union. */
export const GATE_LAB_TOOL_VALUES = [
  GateType.X,
  GateType.H,
  "control",
  "swap",
  "eraser",
] as const satisfies readonly SelectedTool[];
