/**
 * mist-state.test.ts
 *
 * Tests for GateLabScreen's mist reduction (statevector → signed ball configurations).
 * See src/gate-lab-screen/model/MistState.ts.
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../src/circuit-screen/model/QuantumSimulator.js";
import { computeMistRows } from "../src/gate-lab-screen/model/MistState.js";
import { CTRL, grid, H, TARGET_X } from "./helpers.js";

describe("computeMistRows", () => {
  it("a single PETE (Hadamard) box splits a white ball into an even, all-positive mist", () => {
    const state = simulate(grid({ "0,0": H }), 1);
    expect(computeMistRows(state)).toEqual([
      { bits: 0, sign: 1 },
      { bits: 1, sign: 1 },
    ]);
  });

  it("two stacked PETE boxes collapse back to the deterministic starting ball color", () => {
    const c = grid({ "0,0": H, "0,1": H });
    // White (|0⟩) input.
    expect(computeMistRows(simulate(c, 1, 8, 0b0))).toEqual([{ bits: 0, sign: 1 }]);
    // Black (|1⟩) input.
    expect(computeMistRows(simulate(c, 1, 8, 0b1))).toEqual([{ bits: 1, sign: 1 }]);
  });

  it("a CNOT with a misty control produces an entangled 2-row mist", () => {
    const c = grid({ "0,0": H, "0,1": CTRL, "1,1": TARGET_X });
    // Bell state (|00⟩+|11⟩)/√2 — bits 0 (wires 0,1 both 0) and 3 (both 1).
    expect(computeMistRows(simulate(c, 2))).toEqual([
      { bits: 0, sign: 1 },
      { bits: 3, sign: 1 },
    ]);
  });

  it("reports a negative sign (the book's minus label) for a negative real amplitude", () => {
    // PETE then Z: (|0⟩+|1⟩)/√2 → (|0⟩−|1⟩)/√2 — the |1⟩ row now carries a "−" label.
    const c = grid({ "0,0": H, "0,1": { kind: "gate", gate: "Z" } });
    expect(computeMistRows(simulate(c, 1))).toEqual([
      { bits: 0, sign: 1 },
      { bits: 1, sign: -1 },
    ]);
  });
});
