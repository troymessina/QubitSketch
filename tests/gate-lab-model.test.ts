/**
 * gate-lab-model.test.ts
 *
 * Behavior tests for GateLabModel: placement rules over its restricted tool set
 * (NOT/PETE/control/swap/eraser — see GATE_LAB_TOOL_VALUES), the input-ball
 * bitmask (toggleInputBit), and undo/redo history. Mirrors
 * qubit-sketch-model.test.ts, scoped to what Gate Lab actually exposes.
 */
import { describe, expect, it } from "vitest";
import type { CircuitCell, SelectedTool } from "../src/circuit-screen/model/GateType.js";
import { GATE_LAB_MAX_QUBITS } from "../src/circuit-screen/model/GateType.js";
import { GateLabModel } from "../src/gate-lab-screen/model/GateLabModel.js";

/** Places with the given tool at (qubit, step). */
function place(model: GateLabModel, tool: SelectedTool, qubit: number, step: number): void {
  model.selectedToolProperty.value = tool;
  model.placeCell(qubit, step);
}

function cellAt(model: GateLabModel, qubit: number, step: number): CircuitCell {
  return model.circuitProperty.value[qubit]![step]!;
}

describe("GateLabModel placement", () => {
  it("places NOT (X) and PETE (H) boxes; the same tool toggles a cell off", () => {
    const model = new GateLabModel();
    place(model, "H", 0, 0);
    expect(cellAt(model, 0, 0)).toEqual({ kind: "gate", gate: "H" });
    place(model, "H", 0, 0);
    expect(cellAt(model, 0, 0).kind).toBe("empty");

    place(model, "X", 0, 1);
    expect(cellAt(model, 0, 1)).toEqual({ kind: "gate", gate: "X" });
  });

  it("builds a CNOT from a control + a NOT target", () => {
    const model = new GateLabModel();
    place(model, "control", 0, 0);
    place(model, "X", 1, 0);
    expect(cellAt(model, 0, 0).kind).toBe("control");
    expect(cellAt(model, 1, 0)).toEqual({ kind: "controlledTarget", gate: "X" });
  });

  it("builds a CSWAP (Fredkin) from a control + two swap endpoints", () => {
    const model = new GateLabModel();
    model.setQubitCount(GATE_LAB_MAX_QUBITS);
    place(model, "control", 0, 0);
    place(model, "swap", 1, 0);
    place(model, "swap", 2, 0);
    expect(cellAt(model, 0, 0).kind).toBe("control");
    expect(cellAt(model, 1, 0).kind).toBe("swap");
    expect(cellAt(model, 2, 0).kind).toBe("swap");
  });

  it("keeps swap columns exclusive: no gates or a lone control alongside a swap pair", () => {
    const model = new GateLabModel();
    place(model, "swap", 0, 0);
    place(model, "H", 1, 0);
    expect(cellAt(model, 1, 0).kind).toBe("empty");
    place(model, "swap", 1, 0);
    expect(cellAt(model, 1, 0).kind).toBe("swap");
    // A third endpoint is refused (at most one pair per column).
    model.setQubitCount(GATE_LAB_MAX_QUBITS);
    place(model, "swap", 2, 0);
    expect(cellAt(model, 2, 0).kind).toBe("empty");
  });

  it("refuses a second gate in a controlled column (the simulator would ignore it)", () => {
    const model = new GateLabModel();
    model.setQubitCount(GATE_LAB_MAX_QUBITS);
    place(model, "control", 0, 0);
    place(model, "X", 1, 0);
    place(model, "H", 2, 0);
    expect(cellAt(model, 2, 0).kind).toBe("empty");
  });
});

describe("GateLabModel input balls", () => {
  it("toggleInputBit flips a wire's starting color and back", () => {
    const model = new GateLabModel();
    expect(model.inputBitsProperty.value).toBe(0);
    model.toggleInputBit(0);
    expect(model.inputBitsProperty.value).toBe(0b1);
    model.toggleInputBit(1);
    expect(model.inputBitsProperty.value).toBe(0b11);
    model.toggleInputBit(0);
    expect(model.inputBitsProperty.value).toBe(0b10);
  });

  it("is undoable, and a Reset All clears it", () => {
    const model = new GateLabModel();
    model.toggleInputBit(0);
    expect(model.canUndoProperty.value).toBe(true);
    model.undo();
    expect(model.inputBitsProperty.value).toBe(0);

    model.toggleInputBit(0);
    model.reset();
    expect(model.inputBitsProperty.value).toBe(0);
  });

  it("drives the live statevector: a black (|1⟩) input through two PETE boxes stays black", () => {
    const model = new GateLabModel();
    model.toggleInputBit(0);
    place(model, "H", 0, 0);
    place(model, "H", 0, 1);
    const probabilities = model.probabilitiesProperty.value;
    expect(probabilities[0b1]).toBeCloseTo(1, 12);
  });
});

describe("GateLabModel undo/redo history", () => {
  it("records placements and restores them in order", () => {
    const model = new GateLabModel();
    place(model, "H", 0, 0);
    place(model, "X", 1, 1);
    expect(model.canUndoProperty.value).toBe(true);

    model.undo();
    expect(cellAt(model, 1, 1).kind).toBe("empty");
    expect(cellAt(model, 0, 0).kind).toBe("gate");
    model.undo();
    expect(cellAt(model, 0, 0).kind).toBe("empty");
    expect(model.canUndoProperty.value).toBe(false);

    model.redo();
    model.redo();
    expect(cellAt(model, 1, 1)).toEqual({ kind: "gate", gate: "X" });
    expect(model.canRedoProperty.value).toBe(false);
  });

  it("does not record history for a click that changes nothing", () => {
    const model = new GateLabModel();
    place(model, "eraser", 0, 0); // erasing an empty cell is a no-op
    expect(model.canUndoProperty.value).toBe(false);
  });
});
