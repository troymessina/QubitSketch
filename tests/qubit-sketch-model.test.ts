/**
 * qubit-sketch-model.test.ts
 *
 * Behavior tests for QubitSketchModel: tool placement rules (including the
 * column-shape guards that refuse placements the simulator would silently
 * ignore), undo/redo history, and hidden-row handling.
 */
import { describe, expect, it } from "vitest";
import type { CircuitCell, SelectedTool } from "../src/circuit-screen/model/GateType.js";
import { QubitSketchModel } from "../src/circuit-screen/model/QubitSketchModel.js";

/** Places with the given tool at (qubit, step). */
function place(model: QubitSketchModel, tool: SelectedTool, qubit: number, step: number): void {
  model.selectedToolProperty.value = tool;
  model.placeCell(qubit, step);
}

function cellAt(model: QubitSketchModel, qubit: number, step: number): CircuitCell {
  return model.circuitProperty.value[qubit]![step]!;
}

describe("placement", () => {
  it("places gates, controls, swaps, and rotations; same tool toggles a cell off", () => {
    const model = new QubitSketchModel();
    place(model, "H", 0, 0);
    expect(cellAt(model, 0, 0)).toEqual({ kind: "gate", gate: "H" });
    place(model, "H", 0, 0);
    expect(cellAt(model, 0, 0).kind).toBe("empty");

    place(model, "control", 1, 0);
    expect(cellAt(model, 1, 0).kind).toBe("control");
    place(model, "Rx", 0, 0);
    expect(cellAt(model, 0, 0)).toEqual({ kind: "paramGate", axis: "X", theta: Math.PI / 2 });
  });

  it("tags a gate placed in a controlled column as controlledTarget", () => {
    const model = new QubitSketchModel();
    place(model, "control", 0, 0);
    place(model, "X", 1, 0);
    expect(cellAt(model, 1, 0)).toEqual({ kind: "controlledTarget", gate: "X" });
  });

  it("refuses a second gate in a controlled column (the simulator would ignore it)", () => {
    const model = new QubitSketchModel();
    place(model, "control", 0, 0);
    place(model, "X", 1, 0);
    place(model, "H", 2, 0);
    expect(cellAt(model, 2, 0).kind).toBe("empty");
    // Replacing the existing target in place is still allowed.
    place(model, "H", 1, 0);
    expect(cellAt(model, 1, 0)).toEqual({ kind: "controlledTarget", gate: "H" });
  });

  it("refuses a control in a column that already has two gates", () => {
    const model = new QubitSketchModel();
    place(model, "H", 0, 0);
    place(model, "X", 1, 0);
    place(model, "control", 2, 0);
    expect(cellAt(model, 2, 0).kind).toBe("empty");
    // With a single gate, adding a control is fine (that gate becomes the target).
    const model2 = new QubitSketchModel();
    place(model2, "H", 0, 0);
    place(model2, "control", 1, 0);
    expect(cellAt(model2, 1, 0).kind).toBe("control");
  });

  it("keeps swap columns free of gates, but allows a control (CSWAP/Fredkin)", () => {
    const model = new QubitSketchModel();
    place(model, "swap", 0, 0);
    place(model, "H", 1, 0);
    expect(cellAt(model, 1, 0).kind).toBe("empty");
    // A control MAY join a swap column — this is how CSWAP (Fredkin) is built, and it may be
    // placed before or after the swap pair is complete (see ColumnRules.isApplicableColumn).
    place(model, "control", 1, 0);
    expect(cellAt(model, 1, 0).kind).toBe("control");
    place(model, "swap", 2, 0);
    expect(cellAt(model, 2, 0).kind).toBe("swap");
    // Third endpoint refused (at most one pair per column).
    place(model, "swap", 3, 0);
    expect(cellAt(model, 3, 0).kind).toBe("empty");
    // And no swap may join a column that already holds a gate.
    place(model, "H", 0, 1);
    place(model, "swap", 1, 1);
    expect(cellAt(model, 1, 1).kind).toBe("empty");
  });

  it("ignores controls on hidden rows when tagging new gates", () => {
    const model = new QubitSketchModel();
    model.setQubitCount(5);
    place(model, "control", 4, 0);
    model.setQubitCount(3); // row 4 (and its control) is now hidden
    place(model, "X", 0, 0);
    // The simulator ignores hidden rows, so the placed gate must be a plain gate.
    expect(cellAt(model, 0, 0)).toEqual({ kind: "gate", gate: "X" });
  });
});

describe("undo/redo history", () => {
  it("records placements and restores them in order", () => {
    const model = new QubitSketchModel();
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
    const model = new QubitSketchModel();
    place(model, "eraser", 0, 0); // erasing an empty cell is a no-op
    expect(model.canUndoProperty.value).toBe(false);
  });

  it("coalesces a theta drag on one cell into a single undo step", () => {
    const model = new QubitSketchModel();
    place(model, "Rx", 0, 0);
    model.setCellTheta(0, 0, 1.0);
    model.setCellTheta(0, 0, 1.1);
    model.setCellTheta(0, 0, 1.2);
    model.undo(); // one undo restores the freshly placed default angle
    expect(cellAt(model, 0, 0)).toEqual({ kind: "paramGate", axis: "X", theta: Math.PI / 2 });
  });

  it("does not record history for a theta write with an unchanged value", () => {
    const model = new QubitSketchModel();
    place(model, "Rx", 0, 0);
    model.undo();
    expect(model.canUndoProperty.value).toBe(false);
    place(model, "Rx", 0, 0);
    model.setCellTheta(0, 0, Math.PI / 2); // same angle — must not push an entry
    model.undo();
    expect(cellAt(model, 0, 0).kind).toBe("empty");
  });
});
