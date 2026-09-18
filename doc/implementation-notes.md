# Implementation Notes - QubitSketch

Developer-facing notes on the architecture. The quantum mechanics is documented for educators in
[model.md](./model.md).

## Architecture Overview

QubitSketch is a three-screen SceneryStack sim with a CPU-only statevector engine (no WebGL),
sharing one circuit-grid engine between the screens (Intro's model reuses the engine directly
without sharing the grid-editing core — see below). The code separates into:

```
src/common/
  └─ CircuitEditingModel.ts    shared grid-editing/undo/inspect/live-Property core; Circuit's and
                                Gate Lab's models extend it directly (see "Shared editing core"
                                below). IntroModel does NOT — see "Intro model" below

src/circuit-screen/model/       — shared engine + CircuitScreen-only interop
  ├─ QuantumSimulator.ts       pure math: simulate(), applyControlledGate(), applyControlledSwap(),
  │                             computeBlochVectors() — used by ALL THREE screens
  ├─ GateMatrices.ts           2×2 unitaries, rotationMatrix(axis, θ) — used by ALL THREE screens
  ├─ GateType.ts               CircuitCell discriminated union, MAX_QUBITS/NUM_STEPS, plus Gate
  │                             Lab's GATE_LAB_* constants and tool list — used by Circuit + Gate
  │                             Lab (Intro has its own smaller IntroBoxType/MAX_INTRO_BOXES)
  ├─ CircuitGrid.ts            Grid type, bounds-safe reads, immutable edit, column classifier —
  │                             used by ALL THREE screens (Intro builds a 1-row Grid from its box
  │                             stack via emptyGrid/withCell)
  ├─ ColumnRules.ts            shared "does the simulator apply this column in full?" predicate —
  │                             used by Circuit + Gate Lab (Intro's grid never has controls/swaps,
  │                             so every column it can produce is trivially legal)
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
  │    — shared with GateLabScreenView (type against CircuitEditingModel, not QubitSketchModel);
  │      undoRedoKeyboardShortcuts.ts is also reused by IntroScreenView (its UndoRedoTarget
  │      interface is structural — IntroModel satisfies it without extending anything)
  └─ QasmDialog.ts, GateInspectorNode.ts, ExampleCircuitsComboBox.ts

src/gate-lab-screen/model/
  ├─ GateLabModel.ts           thin CircuitEditingModel subclass: Gate Lab's small qubit range +
  │                             restricted tool palette (GATE_LAB_* in GateType.ts) — nothing else
  └─ MistState.ts              pure fn: statevector → mist rows (sign + basis bits); see model.md
                                — reused directly by Intro, not forked

src/gate-lab-screen/view/
  ├─ GateLabScreenView.ts      palette + canvas + mist panel (no QASM dialog, no rotation inspector)
  ├─ GateLabCanvas.ts          ball-and-box grid — a restricted, restyled CircuitCanvas
  ├─ BoxPalettePanel.ts        click-to-select tool palette (no drag, unlike GatePalettePanel)
  ├─ MistCloudNode.ts          the mist display + single-shot Peek (see MistState.ts) — reused
  │                             directly by IntroScreenView, not forked
  └─ GateLabScreenSummaryContent.ts, GateLabKeyboardHelpContent.ts

src/intro-screen/model/
  └─ IntroModel.ts             standalone TModel (not a CircuitEditingModel subclass): the ordered
                                box stack + its own small undo/redo, the input ball, and the fall
                                animation state machine (step(dt) → fallProgressProperty). Builds
                                a 1-row Grid from the stack and calls the shared simulate() — see
                                "Intro model" below

src/intro-screen/view/
  ├─ IntroScreenView.ts        palette + ball-drop canvas + mist panel + Drop/Undo/Redo
  ├─ BallDropCanvas.ts         vertical box-stack track, drag-to-insert, the animated ball (look
                                from MistState.computeMistRows on displayStateProperty)
  ├─ BoxNode.ts                literal box art (bevel + "feet"), bigger than GateNode's grid tiles
  ├─ IntroPalettePanel.ts      drag-and-drop palette (NOT/PETE), adapted from GatePalettePanel
  └─ IntroScreenSummaryContent.ts, IntroKeyboardHelpContent.ts

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

## Intro model

`IntroModel` deliberately does **not** extend `CircuitEditingModel`: that base's undo/redo and
placement guards operate on a fixed-shape `qubit × step` grid, which doesn't fit an ordered,
variable-length single-lane box stack (`readonly IntroBoxType[]`). It's a small, standalone
`TModel` instead, with its own undo/redo over just `{boxes, inputBall}` — a few dozen lines, not
worth force-fitting into the grid abstraction. It still builds a `CircuitGrid.Grid` (via
`emptyGrid`/`withCell`, one row, one cell per box) and calls the shared `simulate()` directly, so
there is no parallel physics implementation.

The one genuinely new mechanism here — and the only `step(dt)` in this sim that does anything —
is the fall animation: `fallProgressProperty` (0..boxes.length, continuous) advances at a fixed
rate while `isDroppingProperty` is true. SceneryStack's `Sim` calls `screen.model.step(dt)`
directly on the active screen every frame regardless of what the view does (`Sim.ts`'s
`stepSimulationAction`), so `IntroScreenView.step()` stays a no-op like every other screen's — no
view-side wiring is needed to drive the animation. `displayStateProperty` reads
`Math.round(fallProgress)` boxes applied (rounds, not floors, so a box's effect appears at its
visual midpoint); `stateVectorProperty` always reads the full stack regardless of `fallProgress`,
so the end-of-stack `MistCloudNode` reading is authoritative even before a Drop.

**A layout gotcha worth remembering:** the box stack is capped at `MAX_INTRO_BOXES = 5`, not the
shared grid's `NUM_STEPS = 8`. The first version of `BallDropCanvas` reserved room for all 8 —
764px of vertical track — which silently pushed the Drop/Undo/Redo buttons off the top of this
sim's fixed 1024×618 layout (nothing errored; they were just unreachable above y=0). If you ever
want more than 5 boxes, the fix is shrinking `BOX_HEIGHT`/`GAP` in `BallDropCanvas.ts` to keep the
total reserved height under budget, not just bumping the constant.

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
  Gate Lab and Intro show only a sign (see model.md), not a phase color — their whole gate set
  stays real.
- Circuit canvas uses a fixed virtual size (`QubitSketchConstants`); not model-view metres.
- `BoxNode.ts` (Intro) is a separate, purpose-built visual from `GateNode.ts` — bigger, with a
  bevel and "feet" circles for the literal book-box look — rather than reusing `GateNode` at a
  larger size, since Intro's boxes are the visual centerpiece of the screen, not a compact grid
  tile.

## Disposal conventions

`GatePalettePanel` (and its counterparts `BoxPalettePanel` on Gate Lab, `IntroPalettePanel` on
Intro) are the primary dynamic views: drag previews (CircuitScreen and Intro only — Gate Lab's
palette is click-to-select only), hover tooltips, and `selectedToolProperty` links. Their
`dispose()` unlinks listeners, disposes drag listeners (if any), and depth-first disposes children
so global color Properties are not retained. Screen-lifetime nodes (canvas, simulation/mist panel)
intentionally omit dispose today.

## Testing

`npm test` (vitest, `--expose-gc`); see CLAUDE.md's Testing section for the full spec list. Key
points not obvious from file names:

- `tests/memory-leak.test.ts` — WeakRef/GC regression after `GatePalettePanel.dispose()` and
  `BoxPalettePanel.dispose()`, plus bare-model collectibility for both `QubitSketchModel` and
  `GateLabModel`
- `tests/mist-state.test.ts` — Gate Lab's `computeMistRows` pure function (no DOM needed), also
  exercised (indirectly, through `IntroModel`'s derived state) by `tests/intro-model.test.ts`
- `tests/intro-model.test.ts` — the box stack, undo/redo, and the fall animation state machine;
  `step(dt)` is called directly rather than through a real animation frame loop, so these tests
  run instantly regardless of `BOXES_PER_SECOND`

## Multi-screen simulations

Three screens, `IntroScreen` → `GateLabScreen` → `CircuitScreen` (`src/main.ts`'s `screens`
array), ordered from most to least literal to the book: one ball watched falling in real time,
then multi-qubit with an instant mist display, then the full circuit builder. `QubitSketchModel`
and `GateLabModel` extend the same `CircuitEditingModel` base (see "Shared editing core" above)
rather than duplicating grid-editing logic; `IntroModel` is standalone (see "Intro model" above)
since its box stack isn't grid-shaped. Upstream Quirk lives at `../Baseline/Qubit/Quirk`
(OpenLyceum/Baseline), not part of the shipped build.
