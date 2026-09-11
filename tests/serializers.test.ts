/**
 * serializers.test.ts
 *
 * Round-trip and robustness tests for the URL serializer (CircuitSerializer) and
 * the OpenQASM 2.0 import/export (QasmSerializer), including the column-packing
 * rules that keep imported programs faithful to the v1 column semantics.
 */
import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "../src/circuit-screen/model/CircuitSerializer.js";
import { circuitToQasm, qasmToCircuit } from "../src/circuit-screen/model/QasmSerializer.js";
import { simulate } from "../src/circuit-screen/model/QuantumSimulator.js";
import { ANTI, CTRL, grid, H, probs, SWAP, TARGET_X, X } from "./helpers.js";

const QASM_HEADER = 'OPENQASM 2.0;\ninclude "qelib1.inc";\n';

describe("CircuitSerializer (URL hash)", () => {
  it("round-trips a circuit using every cell kind", () => {
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
    expect(out!.qubitCount).toBe(4);
    expect(out!.circuit).toEqual(c);
  });

  it("returns null on malformed input instead of throwing", () => {
    expect(deserialize("not json")).toBeNull();
    expect(deserialize("{}")).toBeNull();
    expect(deserialize('{"v":99,"q":2,"c":[]}')).toBeNull();
  });

  it("ignores unknown gate tokens and clamps the qubit count", () => {
    const out = deserialize('{"v":1,"q":99,"c":["gNope,gH"]}');
    expect(out).not.toBeNull();
    expect(out!.qubitCount).toBe(5);
    expect(out!.circuit[0]![0]).toEqual({ kind: "empty" });
    expect(out!.circuit[0]![1]).toEqual({ kind: "gate", gate: "H" });
  });
});

describe("QasmSerializer", () => {
  /** Asserts the imported circuit reproduces the original's probabilities. */
  function expectSameDistribution(original: ReturnType<typeof grid>, qubitCount: number): void {
    const back = qasmToCircuit(circuitToQasm(original, qubitCount));
    expect(back).not.toBeNull();
    const p1 = probs(simulate(original, qubitCount));
    const p2 = probs(simulate(back!.circuit, back!.qubitCount));
    expect(p2.length).toBe(p1.length);
    for (let i = 0; i < p1.length; i++) {
      expect(p2[i]).toBeCloseTo(p1[i]!, 8);
    }
  }

  it("round-trips a Bell + rotation circuit exactly (amplitudes, not just probabilities)", () => {
    const c = grid({
      "0,0": H,
      "0,1": CTRL,
      "1,1": TARGET_X,
      "1,2": { kind: "paramGate", axis: "Z", theta: Math.PI / 3 },
    });
    const back = qasmToCircuit(circuitToQasm(c, 2));
    expect(back).not.toBeNull();
    const s1 = simulate(c, 2);
    const s2 = simulate(back!.circuit, back!.qubitCount);
    for (let i = 0; i < s1.length; i++) {
      expect(s2[i]!.real).toBeCloseTo(s1[i]!.real, 5);
      expect(s2[i]!.imaginary).toBeCloseTo(s1[i]!.imaginary, 5);
    }
  });

  it("exports anti-controls as x-conjugated positive controls, preserving the distribution", () => {
    const c = grid({ "0,0": ANTI, "1,0": TARGET_X });
    expect(circuitToQasm(c, 2)).toContain("x q[0];");
    expectSameDistribution(c, 2);
  });

  it("round-trips a Toffoli with a mixed anti-control", () => {
    const c = grid({ "1,0": X, "0,1": ANTI, "1,1": CTRL, "2,1": TARGET_X });
    expectSameDistribution(c, 3);
  });

  it("round-trips SWAP", () => {
    const c = grid({ "0,0": X, "0,1": SWAP, "2,1": SWAP });
    expectSameDistribution(c, 3);
  });

  it("exports single-control CSWAP as qelib1's cswap (Fredkin)", () => {
    const c = grid({ "0,0": CTRL, "1,0": SWAP, "2,0": SWAP });
    expect(circuitToQasm(c, 3)).toContain("cswap q[0],q[1],q[2];");
  });

  it("emits only a comment for a CSWAP with 2+ controls (qelib1's cswap takes exactly one)", () => {
    const c = grid({ "0,0": CTRL, "1,0": CTRL, "2,0": SWAP, "3,0": SWAP });
    expect(circuitToQasm(c, 4)).toContain("// unsupported in OpenQASM 2.0: controlled-SWAP with 2 control(s)");
  });

  it("import does not yet recognize cswap — an unsupported statement rejects the whole program", () => {
    // QasmImport intentionally has no cswap case yet (see CLAUDE.md); this documents that the
    // program is rejected outright (fails closed) rather than silently dropping the gate.
    expect(qasmToCircuit(`${QASM_HEADER}qreg q[3];\ncswap q[0],q[1],q[2];\n`)).toBeNull();
  });

  it("emits only a comment (no stray x conjugation) for gates OpenQASM 2.0 cannot express", () => {
    // Anti-controlled S has no qelib1 form; the x-conjugation must not be emitted around a comment.
    const c = grid({ "0,0": ANTI, "1,0": { kind: "controlledTarget", gate: "S" } });
    const qasm = circuitToQasm(c, 2);
    expect(qasm).toContain("// unsupported in OpenQASM 2.0");
    expect(qasm).not.toContain("x q[");
  });

  it("does not pack an independent gate into a controlled column (the simulator would drop it)", () => {
    const back = qasmToCircuit(`${QASM_HEADER}qreg q[4];\ncx q[0],q[1];\nh q[3];\n`);
    expect(back).not.toBeNull();
    // The h must land in a later column than the cx, and must survive simulation:
    // expected state (|00⟩ ⊗ (|0⟩+|1⟩)/√2 on q3) ⇒ p(|0000⟩) = p(|1000⟩) = 1/2.
    const p = probs(simulate(back!.circuit, back!.qubitCount));
    expect(p[0]).toBeCloseTo(0.5, 10);
    expect(p[8]).toBeCloseTo(0.5, 10);
    expect(back!.circuit[3]![0]!.kind).toBe("empty");
    expect(back!.circuit[3]![1]).toEqual({ kind: "gate", gate: "H" });
  });

  it("does not pack an independent gate into a swap column (the simulator would drop it)", () => {
    const back = qasmToCircuit(`${QASM_HEADER}qreg q[4];\nx q[0];\nswap q[0],q[1];\nh q[3];\n`);
    expect(back).not.toBeNull();
    const p = probs(simulate(back!.circuit, back!.qubitCount));
    // q1 = 1 after the swap, q3 in superposition: p(|0010⟩) = p(|1010⟩) = 1/2.
    expect(p[2]).toBeCloseTo(0.5, 10);
    expect(p[10]).toBeCloseTo(0.5, 10);
  });

  it("lets plain single-qubit gates share a column", () => {
    const back = qasmToCircuit(`${QASM_HEADER}qreg q[2];\nh q[0];\nx q[1];\n`);
    expect(back).not.toBeNull();
    expect(back!.circuit[0]![0]).toEqual({ kind: "gate", gate: "H" });
    expect(back!.circuit[1]![0]).toEqual({ kind: "gate", gate: "X" });
  });

  it("evaluates pi-expression angles", () => {
    const back = qasmToCircuit(`${QASM_HEADER}qreg q[1];\nrx(pi/2) q[0];\nrz(-pi/4) q[0];\nry(3*pi/2) q[0];\n`);
    expect(back).not.toBeNull();
    const cells = back!.circuit[0]!;
    expect(cells[0]).toEqual({ kind: "paramGate", axis: "X", theta: Math.PI / 2 });
    expect(cells[1]).toEqual({ kind: "paramGate", axis: "Z", theta: -Math.PI / 4 });
    expect(cells[2]).toEqual({ kind: "paramGate", axis: "Y", theta: (3 * Math.PI) / 2 });
  });

  it("rejects unsupported programs cleanly", () => {
    expect(qasmToCircuit(`${QASM_HEADER}qreg q[2];\nmystery q[0];\n`)).toBeNull();
    expect(qasmToCircuit(`${QASM_HEADER}qreg q[2];\nqreg r[2];\n`)).toBeNull();
    expect(qasmToCircuit(`${QASM_HEADER}qreg q[9];\n`)).toBeNull();
  });

  describe("angle parsing", () => {
    /** Parses a one-gate program and returns the theta it produced (null if rejected). */
    function theta(angle: string): number | null {
      const back = qasmToCircuit(`${QASM_HEADER}qreg q[1];\nrx(${angle}) q[0];\n`);
      const cell = back?.circuit[0]?.[0];
      return cell?.kind === "paramGate" ? cell.theta : null;
    }

    it("reads scientific notation instead of splitting it on the exponent sign", () => {
      // Regression: the tokenizer had no exponent branch, so "1e-3" became 1 − 3 = −2.
      expect(theta("1e-3")).toBeCloseTo(0.001, 12);
      expect(theta("2.5e2")).toBeCloseTo(250, 12);
      expect(theta("1E-3")).toBeCloseTo(0.001, 12);
      expect(theta("1e+2")).toBeCloseTo(100, 12);
      expect(theta("-1.5e-2")).toBeCloseTo(-0.015, 12);
    });

    it("still evaluates plain and pi-based expressions", () => {
      expect(theta("0")).toBe(0);
      expect(theta("1.25")).toBeCloseTo(1.25, 12);
      expect(theta(".5")).toBeCloseTo(0.5, 12);
      expect(theta("pi/2")).toBeCloseTo(Math.PI / 2, 12);
      expect(theta("2*pi")).toBeCloseTo(2 * Math.PI, 12);
      expect(theta("-(pi/4)")).toBeCloseTo(-Math.PI / 4, 12);
      expect(theta("1+2*3")).toBeCloseTo(7, 12);
      expect(theta("pi / 2")).toBeCloseTo(Math.PI / 2, 12); // whitespace tolerated
    });

    it("handles nested parentheses in the angle expression", () => {
      // Regression: the statement splitter used /\(([^)]*)\)/, which stopped at the first ")" and
      // left parseAngle's parenthesis support unreachable.
      expect(theta("-(pi/4)")).toBeCloseTo(-Math.PI / 4, 12);
      expect(theta("(pi+2)/2")).toBeCloseTo((Math.PI + 2) / 2, 12);
      expect(theta("((1))")).toBeCloseTo(1, 12);
      expect(theta("2*(pi/(2*2))")).toBeCloseTo(Math.PI / 2, 12);
    });

    it("rejects unbalanced parentheses in a statement", () => {
      expect(qasmToCircuit(`${QASM_HEADER}qreg q[1];\nrx((pi/2 q[0];\n`)).toBeNull();
    });

    it("rejects garbage rather than silently dropping it", () => {
      // Unrecognized characters used to be discarded by the tokenizer, so "2x" parsed as 2.
      expect(theta("2x")).toBeNull();
      expect(theta("1e")).toBeNull();
      expect(theta("pi/")).toBeNull();
      expect(theta("(pi")).toBeNull();
      expect(theta("$")).toBeNull();
      expect(theta("")).toBeNull();
    });

    it("rejects angles that would put NaN into the statevector", () => {
      expect(theta("1e999")).toBeNull(); // overflows to Infinity
      expect(theta("pi/0")).toBeNull(); // divides to Infinity
    });
  });
});
