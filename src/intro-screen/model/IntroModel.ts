/**
 * IntroModel.ts
 *
 * Top-level model for the Intro screen — Terry Rudolph's *Q is for Quantum*, made as
 * literal as the book allows: a single ball, a stack of boxes (NOT/PETE), watched
 * falling through in real time (see the VPython demo this screen is modeled on, and
 * doc/model.md's "Intro model" section).
 *
 * Deliberately not a CircuitEditingModel subclass: that base is grid-shaped
 * (qubit × step) with undo/redo over the whole grid, which doesn't fit an ordered,
 * variable-length single-lane stack. This is a small, standalone TModel instead,
 * reusing the shared engine directly (QuantumSimulator.simulate) rather than any new
 * physics — see the box set below, a subset of what the engine already handles.
 */
import {
  BooleanProperty,
  DerivedProperty,
  Property,
  type ReadOnlyProperty,
  StringUnionProperty,
} from "scenerystack/axon";
import type { Complex } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import { emptyGrid, type Grid, withCell } from "../../circuit-screen/model/CircuitGrid.js";
import { NUM_STEPS } from "../../circuit-screen/model/GateType.js";
import { simulate } from "../../circuit-screen/model/QuantumSimulator.js";

/** The two box types this screen exposes — the book's single-qubit boxes only. */
export type IntroBoxType = "X" | "H";

/**
 * Max stack depth. Deliberately smaller than the shared grid's NUM_STEPS (8): boxes here are
 * drawn big and literal (a whole vertical column of them, not a compact horizontal grid cell
 * each), so 8 stacked would not fit this sim's fixed 1024×618 layout — see BallDropCanvas.ts.
 * Five is already more than the book's own examples ever stack in one column.
 */
export const MAX_INTRO_BOXES = 5;

/** How many boxes fall per second while dropping (constant-velocity, like the VPython demo). */
const BOXES_PER_SECOND = 1.2;

/** A point-in-time editor state for undo/redo. */
type IntroSnapshot = { readonly boxes: readonly IntroBoxType[]; readonly inputBall: 0 | 1 };

export class IntroModel implements TModel {
  private readonly _boxesProperty = new Property<readonly IntroBoxType[]>([]);
  /** The ordered stack of boxes, top (index 0) to bottom, max length MAX_INTRO_BOXES. */
  public readonly boxesProperty: ReadOnlyProperty<readonly IntroBoxType[]> = this._boxesProperty;

  private readonly _inputBallProperty = new Property<0 | 1>(0);
  /** Starting ball color: 0 = white (|0⟩), 1 = black (|1⟩). Toggle via {@link toggleInputBall}. */
  public readonly inputBallProperty: ReadOnlyProperty<0 | 1> = this._inputBallProperty;

  /**
   * The palette box currently "armed" for click-to-place (as opposed to drag-and-drop).
   * Mirrors CircuitEditingModel's selectedToolProperty, scoped to this screen's two boxes.
   */
  public readonly selectedToolProperty: StringUnionProperty<IntroBoxType> = new StringUnionProperty<IntroBoxType>("H", {
    validValues: ["X", "H"],
  });

  /** Constant 1 — lets the shared MistCloudNode (built for any qubit count) be reused as-is. */
  public readonly qubitCountProperty: ReadOnlyProperty<number> = new Property(1);

  private readonly _fallProgressProperty = new Property(0);
  /** 0..boxes.length, continuous; how far the ball has fallen. Transient — not undoable. */
  public readonly fallProgressProperty: ReadOnlyProperty<number> = this._fallProgressProperty;

  private readonly _isDroppingProperty = new BooleanProperty(false);
  public readonly isDroppingProperty: ReadOnlyProperty<boolean> = this._isDroppingProperty;

  /** The 1-row Grid built from `boxesProperty`, for reuse with the shared `simulate` engine. */
  private readonly circuitProperty: ReadOnlyProperty<Grid>;

  /** The FINAL state (every box applied) — feeds the end-of-fall mist panel. */
  public readonly stateVectorProperty: ReadOnlyProperty<Complex[]>;
  public readonly probabilitiesProperty: ReadOnlyProperty<number[]>;

  /** The state after Math.round(fallProgress) boxes — drives the animating ball's look. */
  public readonly displayStateProperty: ReadOnlyProperty<Complex[]>;

  private readonly _canUndoProperty = new BooleanProperty(false);
  private readonly _canRedoProperty = new BooleanProperty(false);
  public readonly canUndoProperty: ReadOnlyProperty<boolean> = this._canUndoProperty;
  public readonly canRedoProperty: ReadOnlyProperty<boolean> = this._canRedoProperty;

  private readonly past: IntroSnapshot[] = [];
  private readonly future: IntroSnapshot[] = [];
  private static readonly MAX_HISTORY = 100;

  public constructor() {
    this.circuitProperty = new DerivedProperty([this.boxesProperty], (boxes) => {
      let grid: Grid = emptyGrid();
      for (const [step, box] of boxes.entries()) {
        grid = withCell(grid, 0, step, { kind: "gate", gate: box });
      }
      return grid;
    });

    this.stateVectorProperty = new DerivedProperty(
      [this.circuitProperty, this.inputBallProperty],
      (circuit, inputBall) => simulate(circuit, 1, NUM_STEPS, inputBall),
    );

    this.probabilitiesProperty = new DerivedProperty([this.stateVectorProperty], (state) =>
      state.map((amp) => amp.magnitudeSquared),
    );

    // Rounds (rather than floors) so a box's effect appears once the ball has visually reached
    // its vertical midpoint — matching the VPython demo, which updates state there too.
    this.displayStateProperty = new DerivedProperty(
      [this.circuitProperty, this.inputBallProperty, this.fallProgressProperty],
      (circuit, inputBall, fallProgress) => simulate(circuit, 1, Math.round(fallProgress), inputBall),
    );
  }

  private snapshot(): IntroSnapshot {
    return { boxes: this.boxesProperty.value, inputBall: this.inputBallProperty.value };
  }

  private pushHistory(): void {
    this.past.push(this.snapshot());
    if (this.past.length > IntroModel.MAX_HISTORY) {
      this.past.shift();
    }
    this.future.length = 0;
    this.updateUndoRedoEnabled();
  }

  private updateUndoRedoEnabled(): void {
    this._canUndoProperty.value = this.past.length > 0;
    this._canRedoProperty.value = this.future.length > 0;
  }

  /** Stops any in-progress fall and pops the ball back to the top, ready to redrop. */
  private resetFall(): void {
    this._fallProgressProperty.value = 0;
    this._isDroppingProperty.value = false;
  }

  /**
   * Inserts `type` at `index` (clamped into [0, boxes.length]), refused once the stack is at
   * MAX_INTRO_BOXES or while a drop is in progress. Resets any in-progress/completed fall.
   */
  public insertBox(index: number, type: IntroBoxType): void {
    const current = this.boxesProperty.value;
    if (this.isDroppingProperty.value || current.length >= MAX_INTRO_BOXES) {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(current.length, index));
    this.pushHistory();
    this._boxesProperty.value = [...current.slice(0, clampedIndex), type, ...current.slice(clampedIndex)];
    this.resetFall();
  }

  /** Removes the box at `index`, refused while a drop is in progress. */
  public removeBox(index: number): void {
    const current = this.boxesProperty.value;
    if (this.isDroppingProperty.value || index < 0 || index >= current.length) {
      return;
    }
    this.pushHistory();
    this._boxesProperty.value = current.filter((_box, i) => i !== index);
    this.resetFall();
  }

  /** Flips the starting ball between white (|0⟩) and black (|1⟩), refused mid-drop. */
  public toggleInputBall(): void {
    if (this.isDroppingProperty.value) {
      return;
    }
    this.pushHistory();
    this._inputBallProperty.value = this.inputBallProperty.value === 0 ? 1 : 0;
    this.resetFall();
  }

  /** Starts the ball falling from the top. No-op if already dropping or the stack is empty. */
  public startDrop(): void {
    if (this.isDroppingProperty.value || this.boxesProperty.value.length === 0) {
      return;
    }
    this._fallProgressProperty.value = 0;
    this._isDroppingProperty.value = true;
  }

  public undo(): void {
    const prev = this.past.pop();
    if (prev === undefined) {
      return;
    }
    this.future.push(this.snapshot());
    this.applySnapshot(prev);
    this.updateUndoRedoEnabled();
  }

  public redo(): void {
    const next = this.future.pop();
    if (next === undefined) {
      return;
    }
    this.past.push(this.snapshot());
    this.applySnapshot(next);
    this.updateUndoRedoEnabled();
  }

  private applySnapshot(snap: IntroSnapshot): void {
    this._boxesProperty.value = snap.boxes;
    this._inputBallProperty.value = snap.inputBall;
    this.resetFall();
  }

  public reset(): void {
    this._boxesProperty.reset();
    this._inputBallProperty.reset();
    this.selectedToolProperty.reset();
    this.resetFall();
    this.past.length = 0;
    this.future.length = 0;
    this.updateUndoRedoEnabled();
  }

  /** Advances the fall while dropping; stops (and clamps to the bottom) once it completes. */
  public step(dt: number): void {
    if (!this.isDroppingProperty.value) {
      return;
    }
    const total = this.boxesProperty.value.length;
    const next = this.fallProgressProperty.value + dt * BOXES_PER_SECOND;
    if (next >= total) {
      this._fallProgressProperty.value = total;
      this._isDroppingProperty.value = false;
    } else {
      this._fallProgressProperty.value = next;
    }
  }
}
