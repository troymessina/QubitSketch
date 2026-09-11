/**
 * column-rules.test.ts
 *
 * Regression tests for the shared column-shape predicate (ColumnRules) and for the three
 * entry points that must agree on it: interactive placement, `#circuit=` links, and QASM
 * import. Each case here is a route by which a grid could once render a gate the simulator
 * silently ignored.
 */
import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "../src/circuit-screen/model/CircuitSerializer.js";
import { censusColumn, isApplicableCircuit, isApplicableColumn } from "../src/circuit-screen/model/ColumnRules.js";
import type { CircuitCell, SelectedTool } from "../src/circuit-screen/model/GateType.js";
import { simulate } from "../src/circuit-screen/model/QuantumSimulator.js";
import { QubitSketchModel } from "../src/circuit-screen/model/QubitSketchModel.js";
import { ANTI, CTRL, grid, H, SWAP, TARGET_X } from "./helpers.js";

function place(model: QubitSketchModel, tool: SelectedTool, qubit: number, step: number): void {
  model.selectedToolProperty.value = tool;
  model.placeCell(qubit, step);
}

function cellAt(model: QubitSketchModel, qubit: number, step: number): CircuitCell {
  return model.circuitProperty.value[qubit]![step]!;
}

describe("isApplicableColumn", () => {
  it("accepts the three supported shapes", () => {
    expect(isApplicableColumn({ controls: 0, swaps: 0, gates: 0 })).toBe(true); // empty
    expect(isApplicableColumn({ controls: 0, swaps: 0, gates: 4 })).toBe(true); // independent gates
    expect(isApplicableColumn({ controls: 1, swaps: 0, gates: 1 })).toBe(true); // CNOT
    expect(isApplicableColumn({ controls: 2, swaps: 0, gates: 1 })).toBe(true); // Toffoli
    expect(isApplicableColumn({ controls: 0, swaps: 2, gates: 0 })).toBe(true); // SWAP pair
    expect(isApplicableColumn({ controls: 1, swaps: 2, gates: 0 })).toBe(true); // CSWAP / Fredkin
    expect(isApplicableColumn({ controls: 2, swaps: 2, gates: 0 })).toBe(true); // controlled-controlled-SWAP
  });

  it("permits a lone swap endpoint, with or without a control already placed (in-progress CSWAP)", () => {
    expect(isApplicableColumn({ controls: 0, swaps: 1, gates: 0 })).toBe(true);
    expect(isApplicableColumn({ controls: 1, swaps: 1, gates: 0 })).toBe(true);
  });

  it("rejects shapes whose extra cells the simulator would drop", () => {
    expect(isApplicableColumn({ controls: 1, swaps: 0, gates: 2 })).toBe(false); // 2nd target ignored
    expect(isApplicableColumn({ controls: 0, swaps: 2, gates: 1 })).toBe(false); // gate beside a swap
    expect(isApplicableColumn({ controls: 1, swaps: 1, gates: 1 })).toBe(false); // gate beside a lone endpoint
    expect(isApplicableColumn({ controls: 0, swaps: 3, gates: 0 })).toBe(false); // 3 endpoints
  });

  it("counts anti-controls as controls", () => {
    expect(censusColumn([ANTI, H, H])).toEqual({ controls: 1, swaps: 0, gates: 2 });
    expect(isApplicableColumn(censusColumn([ANTI, H, H]))).toBe(false);
  });
});

describe("placement guards see hidden rows", () => {
  it("refuses a control that would strand a gate parked on a hidden wire", () => {
    const model = new QubitSketchModel();
    model.setQubitCount(5);
    place(model, "H", 4, 0); // gate on the bottom wire
    model.setQubitCount(2); // q4 is now hidden
    place(model, "H", 0, 0);
    expect(cellAt(model, 0, 0).kind).toBe("gate");

    // Adding a control here would make column 0 = control + 2 gates. The simulator applies only
    // one target, so q4's H would become a cell that renders but never acts.
    place(model, "control", 1, 0);
    expect(cellAt(model, 1, 0).kind).toBe("empty");

    // Growing back must therefore still leave an applicable grid.
    model.setQubitCount(5);
    expect(isApplicableCircuit(model.circuitProperty.value)).toBe(true);
  });

  it("refuses a gate that a hidden control would strand", () => {
    const model = new QubitSketchModel();
    model.setQubitCount(5);
    place(model, "control", 4, 0);
    place(model, "X", 3, 0); // the controlled target
    model.setQubitCount(2); // both are hidden now
    // Column 0 already has its single target; a visible gate would be the second one.
    place(model, "H", 0, 0);
    expect(cellAt(model, 0, 0).kind).toBe("empty");
  });

  it("refuses a gate beside a hidden swap pair", () => {
    const model = new QubitSketchModel();
    model.setQubitCount(5);
    place(model, "swap", 3, 0);
    place(model, "swap", 4, 0);
    model.setQubitCount(2);
    place(model, "H", 0, 0);
    expect(cellAt(model, 0, 0).kind).toBe("empty");
  });

  it("still tags a gate by the VISIBLE controls only (cosmetic kind, not legality)", () => {
    const model = new QubitSketchModel();
    model.setQubitCount(5);
    place(model, "control", 4, 0);
    model.setQubitCount(3); // the control is hidden
    place(model, "X", 0, 0);
    // Legal (one control, one gate) and rendered as a plain gate, since nothing visible controls it.
    expect(cellAt(model, 0, 0)).toEqual({ kind: "gate", gate: "X" });
  });

  it("every reachable placement sequence leaves an applicable grid", () => {
    // Fuzz the editor itself: random tools at random positions, with random wire-count changes.
    let s = 987654321;
    const rnd = (): number => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const tools: SelectedTool[] = ["H", "X", "Z", "Rx", "control", "antiControl", "swap", "eraser"];
    const model = new QubitSketchModel();
    for (let i = 0; i < 4000; i++) {
      if (rnd() < 0.06) {
        model.setQubitCount(1 + Math.floor(rnd() * 5));
      }
      const tool = tools[Math.floor(rnd() * tools.length)]!;
      place(model, tool, Math.floor(rnd() * model.qubitCountProperty.value), Math.floor(rnd() * 8));
      // The invariant must hold over the WHOLE grid, at any future wire count.
      expect(isApplicableCircuit(model.circuitProperty.value), `after ${i} edits with ${tool}`).toBe(true);
    }
  });
});

describe("shared links are shape-validated", () => {
  it("rejects a payload with a control and two gates in one column", () => {
    const payload = JSON.stringify({
      v: 1,
      q: 3,
      c: ["gH,.,.,.,.,.,.,.", "c,.,.,.,.,.,.,.", "gX,.,.,.,.,.,.,.", ".,.,.,.,.,.,.,.", ".,.,.,.,.,.,.,."],
    });
    expect(deserialize(payload)).toBeNull();
  });

  it("round-trips a controlled-SWAP (CSWAP/Fredkin) payload", () => {
    const payload = JSON.stringify({
      v: 1,
      q: 3,
      c: ["c,.,.,.,.,.,.,.", "s,.,.,.,.,.,.,.", "s,.,.,.,.,.,.,.", ".,.,.,.,.,.,.,.", ".,.,.,.,.,.,.,."],
    });
    const out = deserialize(payload);
    expect(out).not.toBeNull();
    expect(isApplicableCircuit(out!.circuit)).toBe(true);
  });

  it("rejects a payload whose illegal column is on a hidden wire", () => {
    // q=2, but rows 3 and 4 carry a stray swap pair alongside the controlled column.
    const payload = JSON.stringify({
      v: 1,
      q: 2,
      c: ["c,.,.,.,.,.,.,.", "tX,.,.,.,.,.,.,.", ".,.,.,.,.,.,.,.", "s,.,.,.,.,.,.,.", "s,.,.,.,.,.,.,."],
    });
    expect(deserialize(payload)).toBeNull();
  });

  it("still round-trips every legal cell kind", () => {
    const c = grid({
      "0,0": H,
      "0,1": CTRL,
      "1,1": TARGET_X,
      "2,2": { kind: "paramGate", axis: "Y", theta: Math.PI / 2 },
      "3,3": ANTI,
      "0,4": SWAP,
      "1,4": SWAP,
    });
    const out = deserialize(serialize(c, 4));
    expect(out).not.toBeNull();
    expect(out!.circuit).toEqual(c);
    expect(isApplicableCircuit(out!.circuit)).toBe(true);
  });

  it("accepts a lone swap endpoint (a legal in-progress circuit)", () => {
    const c = grid({ "0,0": SWAP });
    expect(deserialize(serialize(c, 2))).not.toBeNull();
  });
});

describe("inspect depth ignores hidden wires", () => {
  it("does not count a gate parked on a hidden wire", () => {
    const model = new QubitSketchModel();
    model.setQubitCount(5);
    place(model, "H", 4, 6);
    expect(model.circuitDepthProperty.value).toBe(7);
    model.setQubitCount(1); // the gate is hidden and no longer simulated
    expect(model.circuitDepthProperty.value).toBe(0);
    model.setQubitCount(5);
    expect(model.circuitDepthProperty.value).toBe(7);
  });

  it("tracks the deepest VISIBLE column", () => {
    const model = new QubitSketchModel();
    model.setQubitCount(3);
    place(model, "H", 0, 0);
    place(model, "X", 2, 4);
    expect(model.circuitDepthProperty.value).toBe(5);
    model.setQubitCount(2);
    expect(model.circuitDepthProperty.value).toBe(1);
  });
});

describe("what the predicate is protecting against", () => {
  /**
   * Characterization test for the failure mode itself, built by hand because the guards and both
   * deserializers now refuse to produce it. A controlled column with two gate-bearing cells keeps
   * only the first target; the second renders but never acts. If applyColumn is ever made total,
   * this expectation flips and the predicate can be relaxed to match.
   */
  it("a controlled column with two gates silently drops the second", () => {
    const bad = grid({ "0,0": CTRL, "1,0": TARGET_X, "2,0": H });
    expect(isApplicableCircuit(bad)).toBe(false);

    const withH = simulate(bad, 3);
    const withoutH = simulate(grid({ "0,0": CTRL, "1,0": TARGET_X }), 3);
    const identical = withH.every(
      (amp, i) =>
        Math.abs(amp.real - withoutH[i]!.real) < 1e-12 && Math.abs(amp.imaginary - withoutH[i]!.imaginary) < 1e-12,
    );
    expect(identical, "the stray H should have been ignored").toBe(true);
  });

  it("a gate sharing a column with a SWAP pair is silently dropped", () => {
    const bad = grid({ "0,0": SWAP, "1,0": SWAP, "2,0": { kind: "gate", gate: "X" } });
    expect(isApplicableCircuit(bad)).toBe(false);
    // q2's X never fires, so q2 stays |0⟩ and the state is exactly |000⟩.
    const p = simulate(bad, 3).map((a) => a.magnitudeSquared);
    expect(p[0]).toBeCloseTo(1, 12);
  });

  it("by contrast, an uncontrolled column applies every gate it holds", () => {
    const good = grid({ "0,0": { kind: "gate", gate: "X" }, "1,0": { kind: "gate", gate: "X" } });
    expect(isApplicableCircuit(good)).toBe(true);
    const p = simulate(good, 2).map((a) => a.magnitudeSquared);
    expect(p[0b11]).toBeCloseTo(1, 12); // both X gates fired
  });
});
