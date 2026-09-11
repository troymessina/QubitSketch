/**
 * QasmExport.ts
 *
 * Circuit grid → OpenQASM 2.0 (a teaching subset, for copy-into-Qiskit interop).
 *
 *   - Exports the gates QubitSketch supports (h, x, y, z, s, t, sdg, tdg, sx, rx/ry/rz)
 *     plus the common controlled forms in qelib1 (cx, cy, cz, ch, ccx, crx, cry, crz),
 *     swap, and single-control cswap (Fredkin). Anti-controls (◦) are emitted by
 *     conjugating the control wire with x.
 *   - Anything OpenQASM 2.0 can't express directly (e.g. a controlled-S, or 3+ controls)
 *     is emitted as a clear `// unsupported` comment rather than incorrect output.
 *
 * Endianness note: circuit row k maps to qubit `q[k]` (qubit 0 = least-significant bit).
 */
import type { Grid } from "./CircuitGrid.js";
import { cellAt, classifyColumn, columnHasControl } from "./CircuitGrid.js";
import type { CircuitCell, GateType, RotationAxis } from "./GateType.js";
import { cellGate, NUM_STEPS } from "./GateType.js";
import { formatAngle } from "./QasmAngle.js";
import { GATE_TO_QASM, ROT_TO_QASM, SINGLE_CONTROL_QASM } from "./QasmMappings.js";

/** A gate-bearing cell reduced to what export needs. */
type GateTarget = { wire: number } & (
  | { kind: "gate"; gate: GateType }
  | { kind: "rot"; axis: RotationAxis; theta: number }
);

/** Builds the controlled-operation statement for `controls` → `target`, or null if 2.0 can't express it. */
function controlledStatement(controls: readonly number[], target: GateTarget): string | null {
  const targets = `q[${target.wire}]`;
  if (controls.length === 1) {
    const c = `q[${controls[0]}]`;
    if (target.kind === "gate") {
      const name = SINGLE_CONTROL_QASM[target.gate];
      return name ? `${name} ${c},${targets};` : null;
    }
    return `${ROT_TO_QASM[target.axis].controlled}(${formatAngle(target.theta)}) ${c},${targets};`;
  }
  if (controls.length === 2 && target.kind === "gate" && target.gate === "X") {
    return `ccx q[${controls[0]}],q[${controls[1]}],${targets};`;
  }
  return null;
}

/** Builds the single-qubit statement for a gate-bearing cell. */
function singleStatement(target: GateTarget): string {
  if (target.kind === "rot") {
    return `${ROT_TO_QASM[target.axis].single}(${formatAngle(target.theta)}) q[${target.wire}];`;
  }
  return `${GATE_TO_QASM[target.gate]} q[${target.wire}];`;
}

/** Reduces a cell to a {@link GateTarget}, or null if it bears no gate. */
function gateTarget(cell: CircuitCell, wire: number): GateTarget | null {
  if (cell.kind === "paramGate") {
    return { wire, kind: "rot", axis: cell.axis, theta: cell.theta };
  }
  const gate = cellGate(cell);
  return gate === null ? null : { wire, kind: "gate", gate };
}

/**
 * Emits the statements for one controlled column: the controlled operation itself, with
 * anti-controls (◦) conjugated into positive controls by an x on each side. A gate OpenQASM 2.0
 * cannot express becomes a single `// unsupported` comment with no stray conjugation around it.
 */
function emitControlledColumn(
  lines: string[],
  onControls: readonly number[],
  offControls: readonly number[],
  target: GateTarget,
): void {
  const stmt = controlledStatement([...onControls, ...offControls], target);
  if (stmt === null) {
    const label = target.kind === "rot" ? `controlled-${ROT_TO_QASM[target.axis].single}` : `controlled-${target.gate}`;
    lines.push(`// unsupported in OpenQASM 2.0: ${label} with ${onControls.length + offControls.length} control(s)`);
    return;
  }
  for (const a of offControls) {
    lines.push(`x q[${a}];`);
  }
  lines.push(stmt);
  for (const a of offControls) {
    lines.push(`x q[${a}];`);
  }
}

/**
 * Builds the CSWAP (Fredkin) statement for `controls` → wires `a`,`b`, or null if 2.0 can't
 * express it — qelib1.inc's `cswap` takes exactly one control.
 */
function controlledSwapStatement(controls: readonly number[], a: number, b: number): string | null {
  return controls.length === 1 ? `cswap q[${controls[0]}],q[${a}],q[${b}];` : null;
}

/** Emits the statements for one controlled-SWAP column, mirroring {@link emitControlledColumn}. */
function emitControlledSwapColumn(
  lines: string[],
  onControls: readonly number[],
  offControls: readonly number[],
  a: number,
  b: number,
): void {
  const stmt = controlledSwapStatement([...onControls, ...offControls], a, b);
  if (stmt === null) {
    lines.push(
      `// unsupported in OpenQASM 2.0: controlled-SWAP with ${onControls.length + offControls.length} control(s)`,
    );
    return;
  }
  for (const c of offControls) {
    lines.push(`x q[${c}];`);
  }
  lines.push(stmt);
  for (const c of offControls) {
    lines.push(`x q[${c}];`);
  }
}

/** Emits the statements for one circuit column into `lines`. */
function columnToQasm(circuit: Grid, n: number, step: number, lines: string[]): void {
  const { onControls, offControls, swapWires, gateWires } = classifyColumn(circuit, step, n);
  const gateTargets = gateWires
    .map((wire) => gateTarget(cellAt(circuit, wire, step), wire))
    .filter((t): t is GateTarget => t !== null);

  const hasControl = columnHasControl({ onControls, offControls, swapWires, gateWires });

  if (swapWires.length === 2) {
    const [wireA, wireB] = swapWires;
    if (wireA === undefined || wireB === undefined) {
      return;
    }
    if (hasControl) {
      emitControlledSwapColumn(lines, onControls, offControls, wireA, wireB);
    } else {
      lines.push(`swap q[${wireA}],q[${wireB}];`);
    }
    return;
  }

  if (hasControl) {
    const target = gateTargets[0];
    if (target !== undefined) {
      emitControlledColumn(lines, onControls, offControls, target);
    }
    // Stray controls with no target — a no-op, like the simulator.
    return;
  }

  for (const target of gateTargets) {
    lines.push(singleStatement(target));
  }
}

/** Encodes the circuit (first `qubitCount` wires) as an OpenQASM 2.0 program. */
export function circuitToQasm(circuit: Grid, qubitCount: number): string {
  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${qubitCount}];`,
    `creg c[${qubitCount}];`,
  ];
  for (let step = 0; step < NUM_STEPS; step++) {
    columnToQasm(circuit, qubitCount, step, lines);
  }
  return `${lines.join("\n")}\n`;
}
