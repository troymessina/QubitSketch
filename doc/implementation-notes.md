# Implementation Notes - QubitSketch

Developer-facing notes on the architecture. The quantum mechanics is documented for educators in
[model.md](./model.md).

## Architecture Overview

QubitSketch is a two-screen SceneryStack sim with a CPU-only statevector engine (no WebGL), sharing
one circuit-grid engine and editing core between the screens. The code separates into:

```
src/common/
  └─ CircuitEditingModel.ts    shared grid-editing/undo/inspect/live-Property core; both screens'
                                models extend it directly (see "Shared editing core" below)

src/circuit-screen/model/       — shared engine + CircuitScreen-only interop
  ├─ QuantumSimulator.ts       pure math: simulate(), applyControlledGate(), applyControlledSwap(),
  │                             computeBlochVectors() — used by BOTH screens
  ├─ GateMatrices.ts           2×2 unitaries, rotationMatrix(axis, θ) — used by BOTH screens
  ├─ GateType.ts               CircuitCell discriminated union, MAX_QUBITS/NUM_STEPS, plus Gate
  │                             Lab's GATE_LAB_* constants and tool list — used by BOTH screens
  ├─ CircuitGrid.ts            Grid type, bounds-safe reads, immutable edit, column classifier —
  │                             used by BOTH screens
  ├─ ColumnRules.ts            shared "does the simulator apply this column in full?" predicate —
  │                             used by BOTH screens
  ├─ QubitSketchModel.ts       thin CircuitEditingModel subclass: full qubit range + tool palette,
  │                             preferences-driven qubit count on reset — CircuitScreen only
  ├─ CircuitSerializer.ts      compact URL hash encoding — CircuitScreen only
  ├─ CircuitUrlSync.ts         #circuit=… load/save on hash change — CircuitScreen only
  ├─ QasmSerializer.ts         OpenQASM 2.0 teaching subset — CircuitScreen only; barrel over:
  │    QasmExport.ts (circuit → QASM, incl. single-control cswap), QasmImport.ts (QASM → circuit,
  │    no cswap yet), QasmMappings.ts (gate-name maps), QasmAngle.ts (angle format/parse)
  └─ CircuitPresets.ts         example circuits — CircuitScreen only

src/circuit-screen/view/
  ├─ CircuitScreenView.ts      palette + canvas + simulation panel + QASM dialog
  ├─ CircuitCanvas.ts          grid, connectors, click/drag placement
  ├─ GatePalettePanel.ts       tool selection, drag-to-place (dispose required)
  ├─ SimulationPanel.ts        probabilities, amplitudes, Bloch, histogram
  ├─ BlochSpheresNode / BlochSphereNode / MeasurementHistogramNode
  ├─ QubitCountControl.ts, InspectControlNode.ts, undoRedoKeyboardShortcuts.ts
  │    — shared with GateLabScreenView (type against CircuitEditingModel, not QubitSketchModel)
  └─ QasmDialog.ts, GateInspectorNode.ts, ExampleCircuitsComboBox.ts

src/gate-lab-screen/model/
  ├─ GateLabModel.ts           thin CircuitEditingModel subclass: Gate Lab's small qubit range +
  │                             restricted tool palette (GATE_LAB_* in GateType.ts) — nothing else
  └─ MistState.ts              pure fn: statevector → mist rows (sign + basis bits); see model.md

src/gate-lab-screen/view/
  ├─ GateLabScreenView.ts      palette + canvas + mist panel (no QASM dialog, no rotation inspector)
  ├─ GateLabCanvas.ts          ball-and-box grid — a restricted, restyled CircuitCanvas
  ├─ BoxPalettePanel.ts        click-to-select tool palette (no drag, unlike GatePalettePanel)
  ├─ MistCloudNode.ts          the mist display + single-shot Peek (see MistState.ts)
  └─ GateLabScreenSummaryContent.ts, GateLabKeyboardHelpContent.ts

src/QubitSketchConstants.ts    layout margins, control sizes
src/QubitSketchColors.ts       ProfileColorProperty + gate colors + Gate Lab ball/mist colors
src/preferences/               qubit count default, query parameters (CircuitScreen only)
```

Data flows Model → View through AXON `Property` objects; `QuantumSimulator` imports only `dot`
(`Complex`, `Vector3`) — no axon/scenery.

## Shared editing core

`CircuitEditingModel` (`src/common/CircuitEditingModel.ts`) holds everything both screens' models
need: the qubit-count Property, the circuit grid, placement guards (`placeCell`/`nextCellForTool`),
undo/redo history, step-through inspect, the input-ball bitmask (`inputBitsProperty`/
`toggleInputBit`), and the derived `stateVectorProperty`/`probabilitiesProperty`/
`blochVectorsProperty`/`circuitDepthProperty`. `QubitSketchModel` and `GateLabModel` are both
`extends CircuitEditingModel`, configured only with their own qubit-count range and
`SelectedTool` palette (`CircuitEditingModelOptions`). A `protected onReset()` hook lets a subclass
react to Reset All while `applyingHistory` is still true; `QubitSketchModel` is the only current
user, re-applying its preferences-driven qubit count. Before extracting this base, both models
duplicated ~150 lines of undo/redo bookkeeping — see the git history around GateLabScreen's
introduction if you need the pre-extraction version for reference.

## Key design decisions

- **Derived simulation.** `stateVectorProperty`, `probabilitiesProperty`, and `blochVectorsProperty`
  are `DerivedProperty` instances recomputing from `circuitProperty`, `qubitCountProperty`, and
  `inspectStepProperty` — no manual invalidation.
- **Immutable grid updates.** Each edit replaces the affected row in `circuitProperty`; undo/redo
  stores cheap `{ circuit, qubitCount }` snapshots (max 100 entries). Slider drags on Rx/Ry/Rz coalesce
  via `pushHistory(coalesceKey)`.
- **Inspect is transient.** `inspectStepProperty` is excluded from undo/redo and URL hash; editing the
  circuit clears inspect back to live final state.
- **Column semantics in one place.** `applyColumn()` in `QuantumSimulator.ts` is the single authority
  for control/SWAP/CSWAP/single-qubit rules — keep tests and docs aligned with it.
- **One legality predicate, three writers.** `ColumnRules.ts` answers "does the simulator apply this
  column in full?", and every path that can write a grid checks it: `CircuitEditingModel`'s
  placement guards (shared by both screens), the URL deserializer, and the QASM column packer. A
  grid that fails it would render gates that never act, so `deserialize`/`qasmToCircuit` reject
  rather than load one. When changing `applyColumn`'s supported shapes, change `isApplicableColumn`
  in the same commit.
- **Legality is grid-wide, not visible-only.** The guards scan all `MAX_QUBITS` rows even though the
  simulator only reads the visible ones. A cell parked on a hidden wire re-enters the simulation when
  the user grows the wire count, so a column that is legal only while part of it is hidden would then
  drop a gate. (Choosing `gate` vs `controlledTarget` is separate and *does* use the visible rows —
  it is cosmetic, since `CircuitCanvas` renders both identically.)
- **URL sharing.** `CircuitUrlSync` serializes the grid to `#circuit=…`; `restoreCircuit()` loads at
  startup without pushing undo history.

## Model / view design

- Placement rules live in `CircuitEditingModel.placeCell()` (toggle same tool, max two SWAP
  endpoints — with any number of controls once both are placed — auto `controlledTarget` when
  column has a control). Shared by `QubitSketchModel` and `GateLabModel`.
- Gate colors/labels: `GATE_COLOR_MAP` / `GATE_LABEL_MAP` in `GateNode.ts` from `QubitSketchColors`.
  `GateNode` also takes an optional `labelOverride` (e.g. GateLabCanvas/BoxPalettePanel draw the
  same X/H boxes labeled "NOT"/"PETE") without changing the gate's color/identity.
- Phase display: `twilightColormap.ts` for amplitude phase; matrix tooltip on palette hover.
  Gate Lab shows only a sign (see model.md), not a phase color — its whole gate set stays real.
- Circuit canvas uses a fixed virtual size (`QubitSketchConstants`); not model-view metres.

## Disposal conventions

`GatePalettePanel` (and its Gate Lab counterpart `BoxPalettePanel`) are the primary dynamic views:
drag previews (CircuitScreen only), hover tooltips, and `selectedToolProperty` links. Their
`dispose()` unlinks listeners, disposes drag listeners (if any), and depth-first disposes children
so global color Properties are not retained. Screen-lifetime nodes (canvas, simulation/mist panel)
intentionally omit dispose today.

## Testing

`npm test` (vitest, `--expose-gc`); see CLAUDE.md's Testing section for the full spec list. Key
points not obvious from file names:

- `tests/memory-leak.test.ts` — WeakRef/GC regression after `GatePalettePanel.dispose()` and
  `BoxPalettePanel.dispose()`, plus bare-model collectibility for both `QubitSketchModel` and
  `GateLabModel`
- `tests/mist-state.test.ts` — Gate Lab's `computeMistRows` pure function (no DOM needed)

## Multi-screen simulations

Two screens, `GateLabScreen` then `CircuitScreen` (`src/main.ts`'s `screens` array — Gate Lab first
so the book's single-gate introduction precedes the full circuit builder). Both extend the same
`CircuitEditingModel` base (see "Shared editing core" above) rather than duplicating grid-editing
logic. Upstream Quirk lives at `../Baseline/Qubit/Quirk` (OpenPhysics/Baseline), not part of the
shipped build.
