/**
 * CircuitEditingModel.ts
 *
 * Shared circuit-grid editing core used by every screen that places gates on a qubit
 * grid: the qubit count, the circuit grid, placement guards, undo/redo history,
 * step-through inspect, the initial (input) computational-basis state, and the live
 * statevector/probability/Bloch derived Properties. `QubitSketchModel`
 * (circuit-screen) and `GateLabModel` (gate-lab-screen) are both built directly on
 * this — they differ only in qubit-count range and palette tool set (constructor
 * options), plus whatever screen-specific state they add around an instance.
 *
 * `protected onReset()` is a hook for that screen-specific state to react to a
 * Reset All (see QubitSketchModel, which re-applies a preferences-driven qubit count).
 */
import {
  BooleanProperty,
  DerivedProperty,
  NumberProperty,
  Property,
  type ReadOnlyProperty,
  StringUnionProperty,
} from "scenerystack/axon";
import type { Complex, Vector3 } from "scenerystack/dot";
import { Range } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import type { Grid } from "../circuit-screen/model/CircuitGrid.js";
import { cellAt, classifyColumn, columnHasControl, emptyGrid, withCell } from "../circuit-screen/model/CircuitGrid.js";
import { censusColumn, isApplicableColumn } from "../circuit-screen/model/ColumnRules.js";
import type { CircuitCell, GateType, SelectedTool } from "../circuit-screen/model/GateType.js";
import { cellsEqual, EMPTY_CELL, MAX_QUBITS, NUM_STEPS, ROTATION_TOOL_AXIS } from "../circuit-screen/model/GateType.js";
import { computeBlochVectors, simulate } from "../circuit-screen/model/QuantumSimulator.js";

/** A position in the circuit grid. */
export type GridPosition = { readonly qubit: number; readonly step: number };

/** A point-in-time editor state for undo/redo. The grid is immutable, so this is a cheap reference. */
type EditorSnapshot = { readonly circuit: Grid; readonly qubitCount: number; readonly inputBits: number };

export type CircuitEditingModelOptions = {
  /** Range of the visible qubit-wire count for this screen (must be ≤ global MAX_QUBITS). */
  readonly minQubits: number;
  readonly maxQubits: number;
  readonly defaultQubits: number;
  /** The palette tools this screen's selectedToolProperty may hold, and its initial value. */
  readonly toolValues: readonly SelectedTool[];
  readonly defaultTool: SelectedTool;
};

export class CircuitEditingModel implements TModel {
  private readonly minQubits: number;
  private readonly maxQubits: number;

  /** Backing store for the qubit count; protected so a subclass's `onReset` can re-drive it. */
  protected readonly _qubitCountProperty: NumberProperty;

  /** Number of visible qubit wires (minQubits–maxQubits). Mutate via setQubitCount/loadCircuit/reset. */
  public readonly qubitCountProperty: ReadOnlyProperty<number>;

  public readonly selectedToolProperty: StringUnionProperty<SelectedTool>;

  /** The parametrized-rotation cell currently being edited (drives the angle inspector), or null. */
  public readonly selectedCellProperty: Property<GridPosition | null> = new Property<GridPosition | null>(null);

  /**
   * Step-through "inspect" cursor: the number of circuit columns applied when showing the
   * intermediate state (0 = initial state, NUM_STEPS = full circuit). `null` means inspect is
   * off and the displays show the final state. This is transient view state — it is deliberately
   * excluded from undo/redo and from the URL hash.
   */
  private readonly _inspectStepProperty = new Property<number | null>(null);
  public readonly inspectStepProperty: ReadOnlyProperty<number | null> = this._inspectStepProperty;

  /** Backing store for the circuit grid; mutated only through this model's methods. */
  private readonly _circuitProperty: Property<Grid>;

  /** circuit[qubitIndex][stepIndex] — read-only; mutate via placeCell/loadCircuit/undo/redo/etc. */
  public readonly circuitProperty: ReadOnlyProperty<Grid>;

  /**
   * The starting computational-basis state, as a bitmask (bit `q` set ⇒ wire `q` starts at
   * |1⟩). Defaults to |0…0⟩. Toggle a wire with {@link toggleInputBit}; CircuitScreen never
   * touches this, so it stays 0 there. GateLabScreen's input-ball picker drives it directly —
   * see doc/model.md's "drop a black or white ball" framing.
   */
  public readonly inputBitsProperty: Property<number> = new Property<number>(0);

  /** Live statevector — recomputed whenever the circuit, qubit count, or input state changes. */
  public readonly stateVectorProperty: ReadOnlyProperty<Complex[]>;

  /** Measurement probability of each computational basis state. */
  public readonly probabilitiesProperty: ReadOnlyProperty<number[]>;

  /** Per-qubit reduced Bloch vector (length < 1 ⇒ mixed/entangled). */
  public readonly blochVectorsProperty: ReadOnlyProperty<Vector3[]>;

  /** Number of occupied columns (highest non-empty step + 1; 0 if empty) — the inspect range. */
  public readonly circuitDepthProperty: ReadOnlyProperty<number>;

  /** Whether there is undo/redo history available (drives toolbar button enablement). */
  private readonly _canUndoProperty = new BooleanProperty(false);
  private readonly _canRedoProperty = new BooleanProperty(false);
  public readonly canUndoProperty: ReadOnlyProperty<boolean> = this._canUndoProperty;
  public readonly canRedoProperty: ReadOnlyProperty<boolean> = this._canRedoProperty;

  private readonly past: EditorSnapshot[] = [];
  private readonly future: EditorSnapshot[] = [];
  /** True while undo/redo is re-applying a snapshot, so those changes do not push new history. */
  private applyingHistory = false;
  /** Coalesces consecutive edits sharing this key (e.g. a slider drag) into one history entry. */
  private lastHistoryKey: string | null = null;
  private static readonly MAX_HISTORY = 100;

  public constructor(options: CircuitEditingModelOptions) {
    this.minQubits = options.minQubits;
    this.maxQubits = options.maxQubits;

    this._qubitCountProperty = new NumberProperty(options.defaultQubits, {
      range: new Range(options.minQubits, options.maxQubits),
      numberType: "Integer",
    });
    this.qubitCountProperty = this._qubitCountProperty;

    this.selectedToolProperty = new StringUnionProperty<SelectedTool>(options.defaultTool, {
      validValues: options.toolValues,
    });

    this._circuitProperty = new Property<Grid>(emptyGrid());
    this.circuitProperty = this._circuitProperty;

    this.stateVectorProperty = new DerivedProperty(
      [this.circuitProperty, this.qubitCountProperty, this.inspectStepProperty, this.inputBitsProperty],
      (circuit, n, inspectStep, inputBits) => simulate(circuit, n, inspectStep ?? NUM_STEPS, inputBits),
    );

    this.probabilitiesProperty = new DerivedProperty([this.stateVectorProperty], (state) =>
      state.map((amp) => amp.magnitudeSquared),
    );

    this.blochVectorsProperty = new DerivedProperty([this.stateVectorProperty, this.qubitCountProperty], (state, n) =>
      computeBlochVectors(state, n),
    );

    // Only the visible wires are simulated, so only they can extend the inspect range. Counting
    // hidden rows would let a gate parked on a hidden wire stretch the slider past anything the
    // student can see or that affects the state.
    this.circuitDepthProperty = new DerivedProperty([this.circuitProperty, this.qubitCountProperty], (circuit, n) => {
      let depth = 0;
      for (let q = 0; q < n; q++) {
        for (let s = NUM_STEPS - 1; s >= depth; s--) {
          if (cellAt(circuit, q, s).kind !== "empty") {
            depth = s + 1;
            break;
          }
        }
      }
      return depth;
    });

    // Deselect the angle inspector if its qubit row is hidden by a smaller qubit count.
    this.qubitCountProperty.lazyLink((count) => {
      const sel = this.selectedCellProperty.value;
      if (sel !== null && sel.qubit >= count) {
        this.selectedCellProperty.value = null;
      }
    });
  }

  /** Rounds and clamps a requested qubit count into the supported [minQubits, maxQubits] range. */
  private clampQubitCount(count: number): number {
    return Math.max(this.minQubits, Math.min(this.maxQubits, Math.round(count)));
  }

  /**
   * True if any VISIBLE cell in the given step (column) other than `exceptQubit` is a control of
   * either polarity (• or ◦). Hidden rows (q ≥ qubitCount) are excluded to match the simulator,
   * which ignores them.
   *
   * Used only to pick between the `gate` and `controlledTarget` cell kinds, which is purely
   * cosmetic (both are gate-bearing, and the canvas renders them identically) — so this
   * deliberately reflects what is controlled at the CURRENT wire count. Legality is a separate,
   * grid-wide question; see {@link wouldRemainApplicable}.
   */
  private columnHasControlExcept(stepIndex: number, exceptQubit: number): boolean {
    const shape = classifyColumn(this.circuitProperty.value, stepIndex, this.qubitCountProperty.value);
    const without = (wires: number[]): number[] => wires.filter((q) => q !== exceptQubit);
    return columnHasControl({
      ...shape,
      onControls: without(shape.onControls),
      offControls: without(shape.offControls),
    });
  }

  /**
   * True if writing `cell` at the position would leave that column a shape the simulator applies
   * in full (see ColumnRules). This is the one guard behind every placement refusal.
   *
   * It scans ALL global MAX_QUBITS rows, not just this screen's visible ones: a cell parked on a
   * hidden wire re-enters the simulation the moment the user grows the wire count, so a column
   * that is legal only while part of it is hidden would then have a gate silently dropped — a
   * gate the canvas still draws. Checking the whole grid keeps the invariant true at every wire
   * count, for every screen (the grid is always allocated at the global MAX_QUBITS × NUM_STEPS
   * size regardless of a screen's own, possibly smaller, qubit-count range).
   */
  private wouldRemainApplicable(qubitIndex: number, stepIndex: number, cell: CircuitCell): boolean {
    const circuit = this.circuitProperty.value;
    const column: CircuitCell[] = [];
    for (let q = 0; q < MAX_QUBITS; q++) {
      column.push(q === qubitIndex ? cell : cellAt(circuit, q, stepIndex));
    }
    return isApplicableColumn(censusColumn(column));
  }

  /**
   * Computes the cell a control/swap marker tool would leave, or null if the placement is refused.
   * Clicking the marker's own cell clears it (toggle).
   */
  private nextMarkerCell(
    tool: "control" | "antiControl" | "swap",
    current: CircuitCell,
    qubitIndex: number,
    stepIndex: number,
  ): CircuitCell | null {
    if (current.kind === tool) {
      return EMPTY_CELL;
    }
    const cell: CircuitCell =
      tool === "swap" ? { kind: "swap" } : tool === "control" ? { kind: "control" } : { kind: "antiControl" };
    return this.wouldRemainApplicable(qubitIndex, stepIndex, cell) ? cell : null;
  }

  /**
   * Computes the cell the active tool would leave at the position, or null if the placement is
   * refused. Each tool toggles: clicking the same tool on a cell it already occupies clears it.
   * Placements the simulator would silently ignore are refused, keeping every column one of the
   * supported shapes (see ColumnRules). Clearing (toggle-off / eraser) is always allowed.
   */
  private nextCellForTool(
    tool: SelectedTool,
    current: CircuitCell,
    qubitIndex: number,
    stepIndex: number,
  ): CircuitCell | null {
    if (tool === "eraser") {
      return EMPTY_CELL;
    }
    if (tool === "control" || tool === "antiControl" || tool === "swap") {
      return this.nextMarkerCell(tool, current, qubitIndex, stepIndex);
    }
    if (tool === "Rx" || tool === "Ry" || tool === "Rz") {
      const axis = ROTATION_TOOL_AXIS[tool];
      if (current.kind === "paramGate" && current.axis === axis) {
        return EMPTY_CELL;
      }
      const rotation: CircuitCell = { kind: "paramGate", axis, theta: Math.PI / 2 };
      return this.wouldRemainApplicable(qubitIndex, stepIndex, rotation) ? rotation : null;
    }
    const gate: GateType = tool;
    if ((current.kind === "gate" || current.kind === "controlledTarget") && current.gate === gate) {
      return EMPTY_CELL;
    }
    const placed: CircuitCell = this.columnHasControlExcept(stepIndex, qubitIndex)
      ? { kind: "controlledTarget", gate }
      : { kind: "gate", gate };
    return this.wouldRemainApplicable(qubitIndex, stepIndex, placed) ? placed : null;
  }

  /**
   * Applies the currently selected tool to the given grid position (see {@link nextCellForTool}
   * for the per-tool placement and refusal rules).
   */
  public placeCell(qubitIndex: number, stepIndex: number): void {
    const current = cellAt(this.circuitProperty.value, qubitIndex, stepIndex);
    const next = this.nextCellForTool(this.selectedToolProperty.value, current, qubitIndex, stepIndex);

    // A refused placement or a click that changes nothing (e.g. the eraser on an empty cell)
    // records no history and leaves inspect mode alone.
    if (next === null || cellsEqual(current, next)) {
      return;
    }
    // Editing the circuit leaves step-through inspect mode so the displays stay authoritative.
    this._inspectStepProperty.value = null;
    this.pushHistory();
    this.setCell(qubitIndex, stepIndex, next);
    // Auto-select a freshly placed rotation gate so its angle inspector opens; otherwise deselect.
    this.selectedCellProperty.value = next.kind === "paramGate" ? { qubit: qubitIndex, step: stepIndex } : null;
  }

  /** Updates the rotation angle (radians) of a parametrized gate at the given position. */
  public setCellTheta(qubitIndex: number, stepIndex: number, theta: number): void {
    const current = cellAt(this.circuitProperty.value, qubitIndex, stepIndex);
    if (current.kind !== "paramGate" || current.theta === theta) {
      return;
    }
    // Coalesce a continuous slider drag on one cell into a single undo step.
    this.pushHistory(`theta:${qubitIndex}:${stepIndex}`);
    this.setCell(qubitIndex, stepIndex, { kind: "paramGate", axis: current.axis, theta });
  }

  /** Sets the qubit count (clamped to range), recording an undo step. */
  public setQubitCount(count: number): void {
    const clamped = this.clampQubitCount(count);
    if (clamped === this.qubitCountProperty.value) {
      return;
    }
    this._inspectStepProperty.value = null;
    this.pushHistory();
    this._qubitCountProperty.value = clamped;
  }

  /** Flips wire `qubitIndex`'s starting ball between |0⟩ (white) and |1⟩ (black), recording an undo step. */
  public toggleInputBit(qubitIndex: number): void {
    this._inspectStepProperty.value = null;
    this.pushHistory();
    this.inputBitsProperty.value ^= 1 << qubitIndex;
  }

  /**
   * Sets the step-through inspect cursor: `null` for the live/final state, or a column count
   * clamped into [0, NUM_STEPS]. This is transient view state, so it records no undo history.
   */
  public setInspectStep(step: number | null): void {
    this._inspectStepProperty.value = step === null ? null : Math.max(0, Math.min(NUM_STEPS, Math.round(step)));
  }

  /** Writes a single cell, replacing the grid immutably. Low-level — does not record history. */
  private setCell(qubitIndex: number, stepIndex: number, cell: CircuitCell): void {
    this._circuitProperty.set(withCell(this.circuitProperty.value, qubitIndex, stepIndex, cell));
  }

  /**
   * Replaces both the grid and qubit count as a single undoable action (used by QASM import and
   * example presets). Leaves step-through inspect mode and clears any rotation selection.
   */
  public loadCircuit(grid: Grid, qubitCount: number): void {
    this._inspectStepProperty.value = null;
    this.selectedCellProperty.value = null;
    this.pushHistory();
    this._qubitCountProperty.value = this.clampQubitCount(qubitCount);
    this._circuitProperty.set(grid);
  }

  /**
   * Restores a grid and qubit count *without* recording undo history — for URL-hash restore at
   * startup, where the loaded state is the baseline rather than an undoable edit. For an undoable
   * load (QASM import, example presets) use {@link loadCircuit} instead.
   */
  public restoreCircuit(grid: Grid, qubitCount: number): void {
    this._qubitCountProperty.value = this.clampQubitCount(qubitCount);
    this._circuitProperty.set(grid);
  }

  // ── Undo / redo ─────────────────────────────────────────────────────────────

  private snapshot(): EditorSnapshot {
    return {
      circuit: this.circuitProperty.value,
      qubitCount: this.qubitCountProperty.value,
      inputBits: this.inputBitsProperty.value,
    };
  }

  /**
   * Records the current state as an undo point, to be called *before* a mutation.
   * A non-null `coalesceKey` matching the previous push (e.g. a slider drag) is folded
   * into the existing entry instead of creating a new one.
   */
  private pushHistory(coalesceKey: string | null = null): void {
    if (this.applyingHistory) {
      return;
    }
    if (coalesceKey !== null && coalesceKey === this.lastHistoryKey) {
      this.future.length = 0;
      this.updateUndoRedoEnabled();
      return;
    }
    this.past.push(this.snapshot());
    if (this.past.length > CircuitEditingModel.MAX_HISTORY) {
      this.past.shift();
    }
    this.future.length = 0;
    this.lastHistoryKey = coalesceKey;
    this.updateUndoRedoEnabled();
  }

  private applySnapshot(snap: EditorSnapshot): void {
    this.applyingHistory = true;
    this.selectedCellProperty.value = null;
    this._qubitCountProperty.value = snap.qubitCount;
    this._circuitProperty.set(snap.circuit);
    this.inputBitsProperty.value = snap.inputBits;
    this.applyingHistory = false;
    this.lastHistoryKey = null;
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

  private updateUndoRedoEnabled(): void {
    this._canUndoProperty.value = this.past.length > 0;
    this._canRedoProperty.value = this.future.length > 0;
  }

  private clearHistory(): void {
    this.past.length = 0;
    this.future.length = 0;
    this.lastHistoryKey = null;
    this.updateUndoRedoEnabled();
  }

  public reset(): void {
    this.applyingHistory = true;
    this._qubitCountProperty.reset();
    this.onReset();
    this.selectedToolProperty.reset();
    this.selectedCellProperty.reset();
    this._inspectStepProperty.reset();
    this.inputBitsProperty.reset();
    this._circuitProperty.set(emptyGrid());
    this.applyingHistory = false;
    this.clearHistory();
  }

  /**
   * Hook for screen-specific post-reset state, called while `applyingHistory` is still true (so
   * any Property writes it makes do not themselves get treated as undoable edits). No-op by
   * default; see QubitSketchModel for the one current use (re-applying a preferences-driven
   * qubit count).
   */
  protected onReset(): void {
    // No-op by default; see the doc comment above.
  }

  public step(_dt: number): void {
    // The circuit is static — there is no time-dependent state to advance.
  }
}
