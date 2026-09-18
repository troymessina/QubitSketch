/**
 * intro-model.test.ts
 *
 * Behavior tests for IntroModel: the ordered box stack (insert/remove/undo/redo,
 * the MAX_INTRO_BOXES depth cap), the input ball, the fall animation state machine,
 * and physics-reuse correctness (the same headline PETE-box cases already covered
 * for Gate Lab, now exercised through IntroModel's derived properties).
 */
import { describe, expect, it } from "vitest";
import { computeMistRows } from "../src/gate-lab-screen/model/MistState.js";
import { IntroModel, MAX_INTRO_BOXES } from "../src/intro-screen/model/IntroModel.js";

describe("IntroModel box stack", () => {
  it("inserts at the end and at a specific index", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    model.insertBox(1, "X");
    expect(model.boxesProperty.value).toEqual(["H", "X"]);

    model.insertBox(1, "H");
    expect(model.boxesProperty.value).toEqual(["H", "H", "X"]);
  });

  it("clamps an out-of-range insertion index", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    model.insertBox(99, "X"); // clamped to the end
    expect(model.boxesProperty.value).toEqual(["H", "X"]);
  });

  it("removes by index and refuses an out-of-range index", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    model.insertBox(1, "X");
    model.removeBox(0);
    expect(model.boxesProperty.value).toEqual(["X"]);

    model.removeBox(5);
    expect(model.boxesProperty.value).toEqual(["X"]);
  });

  it("refuses to grow the stack past MAX_INTRO_BOXES", () => {
    const model = new IntroModel();
    for (let i = 0; i < MAX_INTRO_BOXES; i++) {
      model.insertBox(i, "H");
    }
    expect(model.boxesProperty.value.length).toBe(MAX_INTRO_BOXES);
    model.insertBox(0, "X");
    expect(model.boxesProperty.value.length).toBe(MAX_INTRO_BOXES);
  });
});

describe("IntroModel undo/redo", () => {
  it("undoes and redoes an insertion", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    expect(model.canUndoProperty.value).toBe(true);

    model.undo();
    expect(model.boxesProperty.value).toEqual([]);
    expect(model.canUndoProperty.value).toBe(false);

    model.redo();
    expect(model.boxesProperty.value).toEqual(["H"]);
    expect(model.canRedoProperty.value).toBe(false);
  });

  it("undoes toggling the input ball", () => {
    const model = new IntroModel();
    model.toggleInputBall();
    expect(model.inputBallProperty.value).toBe(1);
    model.undo();
    expect(model.inputBallProperty.value).toBe(0);
  });
});

describe("IntroModel input ball", () => {
  it("toggles between white (0) and black (1)", () => {
    const model = new IntroModel();
    expect(model.inputBallProperty.value).toBe(0);
    model.toggleInputBall();
    expect(model.inputBallProperty.value).toBe(1);
    model.toggleInputBall();
    expect(model.inputBallProperty.value).toBe(0);
  });
});

describe("IntroModel physics reuse", () => {
  it("a single PETE box on a white ball produces a 2-row mist", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    expect(computeMistRows(model.stateVectorProperty.value)).toEqual([
      { bits: 0, sign: 1 },
      { bits: 1, sign: 1 },
    ]);
  });

  it("two stacked PETE boxes collapse back to the deterministic starting color", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    model.insertBox(1, "H");
    expect(computeMistRows(model.stateVectorProperty.value)).toEqual([{ bits: 0, sign: 1 }]);

    model.toggleInputBall(); // black input
    expect(computeMistRows(model.stateVectorProperty.value)).toEqual([{ bits: 1, sign: 1 }]);
  });

  it("a single NOT box flips the ball deterministically", () => {
    const model = new IntroModel();
    model.insertBox(0, "X");
    expect(computeMistRows(model.stateVectorProperty.value)).toEqual([{ bits: 1, sign: 1 }]);
  });
});

describe("IntroModel fall animation", () => {
  it("startDrop is a no-op on an empty stack", () => {
    const model = new IntroModel();
    model.startDrop();
    expect(model.isDroppingProperty.value).toBe(false);
  });

  it("advances fallProgress while dropping, then stops and clamps at the end", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    model.insertBox(1, "H");
    model.startDrop();
    expect(model.isDroppingProperty.value).toBe(true);

    model.step(0.5);
    expect(model.fallProgressProperty.value).toBeGreaterThan(0);
    expect(model.fallProgressProperty.value).toBeLessThan(2);
    expect(model.isDroppingProperty.value).toBe(true);

    model.step(100); // far more than enough to reach the bottom
    expect(model.fallProgressProperty.value).toBe(2);
    expect(model.isDroppingProperty.value).toBe(false);
  });

  it("displayStateProperty reflects boxes applied so far, rounded to the nearest box", () => {
    const model = new IntroModel();
    model.insertBox(0, "H"); // one PETE box: |0> -> mist
    model.startDrop();

    // Just past the start: rounds down to 0 boxes applied (still the raw white input).
    model.step(0.1);
    expect(computeMistRows(model.displayStateProperty.value)).toEqual([{ bits: 0, sign: 1 }]);

    // Past the box's midpoint (fallProgress rounds to 1): the PETE box has now acted.
    model.step(10);
    expect(computeMistRows(model.displayStateProperty.value)).toEqual([
      { bits: 0, sign: 1 },
      { bits: 1, sign: 1 },
    ]);
  });

  it("refuses to edit the stack or the input ball while dropping", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    model.startDrop();

    model.insertBox(1, "X");
    expect(model.boxesProperty.value).toEqual(["H"]);

    model.removeBox(0);
    expect(model.boxesProperty.value).toEqual(["H"]);

    model.toggleInputBall();
    expect(model.inputBallProperty.value).toBe(0);
  });

  it("editing after a completed drop resets the ball to the top", () => {
    const model = new IntroModel();
    model.insertBox(0, "H");
    model.startDrop();
    model.step(100);
    expect(model.fallProgressProperty.value).toBe(1);

    model.insertBox(1, "X");
    expect(model.fallProgressProperty.value).toBe(0);
    expect(model.isDroppingProperty.value).toBe(false);
  });
});
