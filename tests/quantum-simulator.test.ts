/**
 * quantum-simulator.test.ts
 *
 * Physics unit tests for the statevector engine: gate matrices, controlled and
 * anti-controlled application, SWAP, rotations, Bloch vectors, norm preservation,
 * and the inspect-mode column prefix.
 */
import { describe, expect, it } from "vitest";
import type { CircuitCell } from "../src/circuit-screen/model/GateType.js";
import { NUM_STEPS } from "../src/circuit-screen/model/GateType.js";
import { computeBlochVectors, simulate } from "../src/circuit-screen/model/QuantumSimulator.js";
import { ANTI, CTRL, grid, H, probs, SWAP, TARGET_X, X } from "./helpers.js";

describe("simulate", () => {
  it("starts in |0…0⟩ when the circuit is empty", () => {
    const p = probs(simulate(grid({}), 3));
    expect(p[0]).toBeCloseTo(1, 12);
    expect(p.length).toBe(8);
  });

  it("H then CNOT produces the Bell state (|00⟩ + |11⟩)/√2", () => {
    const c = grid({ "0,0": H, "0,1": CTRL, "1,1": TARGET_X });
    const s = simulate(c, 2);
    const p = probs(s);
    expect(p[0]).toBeCloseTo(0.5, 12);
    expect(p[1]).toBeCloseTo(0, 12);
    expect(p[2]).toBeCloseTo(0, 12);
    expect(p[3]).toBeCloseTo(0.5, 12);
    // Equal phases: both nonzero amplitudes are +1/√2.
    expect(s[0]!.real).toBeCloseTo(Math.SQRT1_2, 12);
    expect(s[3]!.real).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it("chained CNOTs produce the 3-qubit GHZ state", () => {
    const c = grid({
      "0,0": H,
      "0,1": CTRL,
      "1,1": TARGET_X,
      "1,2": CTRL,
      "2,2": TARGET_X,
    });
    const p = probs(simulate(c, 3));
    expect(p[0]).toBeCloseTo(0.5, 12);
    expect(p[7]).toBeCloseTo(0.5, 12);
  });

  it("Toffoli (two controls) fires only when both controls are |1⟩", () => {
    const both = grid({ "0,0": X, "1,0": X, "0,1": CTRL, "1,1": CTRL, "2,1": TARGET_X });
    expect(probs(simulate(both, 3))[7]).toBeCloseTo(1, 12);

    const oneOnly = grid({ "0,0": X, "0,1": CTRL, "1,1": CTRL, "2,1": TARGET_X });
    expect(probs(simulate(oneOnly, 3))[1]).toBeCloseTo(1, 12);
  });

  it("an anti-control (◦) fires on |0⟩ and not on |1⟩", () => {
    const onZero = grid({ "0,0": ANTI, "1,0": TARGET_X });
    expect(probs(simulate(onZero, 2))[2]).toBeCloseTo(1, 12); // |10⟩

    const onOne = grid({ "0,0": X, "0,1": ANTI, "1,1": TARGET_X });
    expect(probs(simulate(onOne, 2))[1]).toBeCloseTo(1, 12); // |01⟩ — target untouched
  });

  it("a SWAP pair exchanges two wires", () => {
    const c = grid({ "0,0": X, "0,1": SWAP, "2,1": SWAP });
    expect(probs(simulate(c, 3))[4]).toBeCloseTo(1, 12); // |100⟩
  });

  it("CSWAP (controlled SWAP / Fredkin) swaps only when the control is |1⟩", () => {
    // Control (wire 0) on, wires 1 and 2 start at 1 and 0: swap fires, wire1↔wire2.
    const on = grid({ "0,0": X, "1,0": X, "0,1": CTRL, "1,1": SWAP, "2,1": SWAP });
    expect(probs(simulate(on, 3))[5]).toBeCloseTo(1, 12); // wire0=1,wire1=0,wire2=1 → index 5

    // Control (wire 0) off: no swap, wire1/wire2 stay as prepared.
    const off = grid({ "1,0": X, "0,1": CTRL, "1,1": SWAP, "2,1": SWAP });
    expect(probs(simulate(off, 3))[2]).toBeCloseTo(1, 12); // wire0=0,wire1=1,wire2=0 → index 2
  });

  it("a plain gate sharing a column with a control is treated as the controlled target", () => {
    // The model normally tags such cells "controlledTarget", but kind "gate" must behave identically.
    const c = grid({ "0,0": X, "0,1": CTRL, "1,1": X });
    expect(probs(simulate(c, 2))[3]).toBeCloseTo(1, 12);
  });

  it("Rx(π) equals X up to global phase; Rz changes no probabilities", () => {
    const rx = grid({ "0,0": { kind: "paramGate", axis: "X", theta: Math.PI } });
    expect(probs(simulate(rx, 1))[1]).toBeCloseTo(1, 12);

    const rz = grid({ "0,0": H, "0,1": { kind: "paramGate", axis: "Z", theta: 1.234 } });
    const p = probs(simulate(rz, 1));
    expect(p[0]).toBeCloseTo(0.5, 12);
    expect(p[1]).toBeCloseTo(0.5, 12);
  });

  it("Ry(θ) rotates |0⟩ to cos(θ/2)|0⟩ + sin(θ/2)|1⟩", () => {
    const theta = 0.7;
    const c = grid({ "0,0": { kind: "paramGate", axis: "Y", theta } });
    const s = simulate(c, 1);
    expect(s[0]!.real).toBeCloseTo(Math.cos(theta / 2), 12);
    expect(s[1]!.real).toBeCloseTo(Math.sin(theta / 2), 12);
  });

  it("S·S = Z and T·T = S on |+⟩ (phase-gate composition)", () => {
    const viaS = grid({ "0,0": H, "0,1": { kind: "gate", gate: "S" }, "0,2": { kind: "gate", gate: "S" } });
    const viaZ = grid({ "0,0": H, "0,1": { kind: "gate", gate: "Z" } });
    const s1 = simulate(viaS, 1);
    const s2 = simulate(viaZ, 1);
    for (let i = 0; i < s1.length; i++) {
      expect(s1[i]!.real).toBeCloseTo(s2[i]!.real, 12);
      expect(s1[i]!.imaginary).toBeCloseTo(s2[i]!.imaginary, 12);
    }
  });

  it("√X·√X = X", () => {
    const c = grid({ "0,0": { kind: "gate", gate: "Vx" }, "0,1": { kind: "gate", gate: "Vx" } });
    expect(probs(simulate(c, 1))[1]).toBeCloseTo(1, 12);
  });

  it("preserves the norm across a deep mixed circuit", () => {
    const c = grid({
      "0,0": H,
      "1,0": { kind: "gate", gate: "Y" },
      "2,0": { kind: "gate", gate: "T" },
      "0,1": CTRL,
      "1,1": { kind: "controlledTarget", gate: "Z" },
      "2,2": { kind: "gate", gate: "Vx" },
      "0,3": SWAP,
      "2,3": SWAP,
      "1,4": { kind: "paramGate", axis: "Y", theta: 0.7 },
      "0,5": ANTI,
      "2,5": { kind: "controlledTarget", gate: "H" },
    });
    const norm = probs(simulate(c, 3)).reduce((a, b) => a + b, 0);
    expect(norm).toBeCloseTo(1, 12);
  });

  it("maxColumns applies only the first k columns (inspect mode)", () => {
    const c = grid({ "0,0": X, "0,1": X });
    expect(probs(simulate(c, 1, 0))[0]).toBeCloseTo(1, 12);
    expect(probs(simulate(c, 1, 1))[1]).toBeCloseTo(1, 12);
    expect(probs(simulate(c, 1, 2))[0]).toBeCloseTo(1, 12);
  });

  it("inputBits sets the starting computational-basis state instead of |0…0⟩", () => {
    // No gates: the circuit is the identity, so the output equals the chosen input.
    expect(probs(simulate(grid({}), 2, NUM_STEPS, 0b10))[0b10]).toBeCloseTo(1, 12);

    // Two stacked PETE (Hadamard) boxes on a black (|1⟩) input ball still emerge black.
    const c = grid({ "0,0": H, "0,1": H });
    expect(probs(simulate(c, 1, NUM_STEPS, 0b1))[1]).toBeCloseTo(1, 12);
  });
});

describe("computeBlochVectors", () => {
  it("|0⟩ points to +z; X|0⟩ to −z; H|0⟩ to +x; SH|0⟩ to +y", () => {
    const cases: Array<[CircuitCell[][], [number, number, number]]> = [
      [grid({}), [0, 0, 1]],
      [grid({ "0,0": X }), [0, 0, -1]],
      [grid({ "0,0": H }), [1, 0, 0]],
      [grid({ "0,0": H, "0,1": { kind: "gate", gate: "S" } }), [0, 1, 0]],
    ];
    for (const [c, [x, y, z]] of cases) {
      const b = computeBlochVectors(simulate(c, 1), 1)[0]!;
      expect(b.x).toBeCloseTo(x, 12);
      expect(b.y).toBeCloseTo(y, 12);
      expect(b.z).toBeCloseTo(z, 12);
    }
  });

  it("both qubits of a Bell state have zero-length Bloch vectors (maximal entanglement)", () => {
    const c = grid({ "0,0": H, "0,1": CTRL, "1,1": TARGET_X });
    const bloch = computeBlochVectors(simulate(c, 2), 2);
    expect(bloch[0]!.magnitude).toBeLessThan(1e-12);
    expect(bloch[1]!.magnitude).toBeLessThan(1e-12);
  });

  it("a product state keeps unit-length Bloch vectors", () => {
    const c = grid({ "0,0": H, "1,0": X });
    const bloch = computeBlochVectors(simulate(c, 2), 2);
    expect(bloch[0]!.magnitude).toBeCloseTo(1, 12);
    expect(bloch[1]!.magnitude).toBeCloseTo(1, 12);
  });
});
