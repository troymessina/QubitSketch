# CLAUDE.md — QubitSketch

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/CLAUDE.md](https://github.com/OpenLyceum/.github/blob/main/CLAUDE.md).

## Project

Three-screen sim, all built on the same shared quantum engine, ordered from most to least
literal to the book:

1. **Intro** (`src/intro-screen/`) — the most literal screen: a single ball animates falling
   through a drag-and-droppable vertical stack of boxes (NOT/PETE), turning "misty" (a faded
   double-ball look) the moment it enters superposition. Modeled directly on a VPython demo of
   Rudolph's own book. Single-qubit only — real per-frame animation (`IntroModel.step`), unlike
   every other model in this sim. See doc/model.md.
2. **Gate Lab** (`src/gate-lab-screen/`) — the next step up: multi-qubit (≤ 3), instant (no
   animation) "mist" display of surviving ball configurations with a sign (relative phase) —
   still real ±1 amplitudes only, no complex numbers, matching the book. See doc/model.md.
3. **Circuit** (`src/circuit-screen/`) — the full drag-and-drop **quantum circuit builder** with
   live CPU statevector simulation (≤ 5 qubits). Pedagogical reimplementation of
   [Quirk](https://github.com/Strilanc/Quirk)'s core (local checkout: `../Baseline/Qubit/Quirk`)
   — superposition, entanglement, and unitary gates (including complex phases) on a grid of
   qubit wires.

Physics for educators: `doc/model.md`. Architecture: `doc/implementation-notes.md`.

## Key files

| Area | Location |
|---|---|
| Screens | `src/intro-screen/IntroScreen.ts`, `src/gate-lab-screen/GateLabScreen.ts`, `src/circuit-screen/CircuitScreen.ts` |
| Shared editing core | `src/common/CircuitEditingModel.ts` — grid editing, undo/redo, inspect, live statevector/probability/Bloch derived Properties, and the input-ball bitmask; Circuit's and Gate Lab's models extend it (`QubitSketchModel`, `GateLabModel`) with only their qubit-count range and tool palette. `IntroModel` does **not** extend it (see Model below) |
| Shared engine | `circuit-screen/model/QuantumSimulator.ts` (pure engine), `GateType.ts`, `GateMatrices.ts`, `CircuitGrid.ts`, `ColumnRules.ts` — used by all three screens |
| Circuit-only model | `circuit-screen/model/CircuitSerializer.ts`, `CircuitUrlSync.ts`, `QasmSerializer.ts` (barrel over `QasmExport/Import/Mappings/Angle.ts`) — URL-sharing and QASM are CircuitScreen-only; Intro and Gate Lab have neither (teaching sandboxes, not shareable-circuit tools) |
| Circuit view | `circuit-screen/view/CircuitScreenView.ts`, `CircuitCanvas.ts`, `GatePalettePanel.ts`, `BlochSpheresNode.ts`, `CircuitScreenSummaryContent.ts` |
| Gate Lab view | `gate-lab-screen/view/GateLabScreenView.ts`, `GateLabCanvas.ts` (ball/box grid), `BoxPalettePanel.ts`, `MistCloudNode.ts` (the mist display + Peek), `GateLabScreenSummaryContent.ts` |
| Intro view | `intro-screen/view/IntroScreenView.ts`, `BallDropCanvas.ts` (box stack + animated ball + drag-to-insert), `BoxNode.ts` (the literal box art), `IntroPalettePanel.ts`, `IntroScreenSummaryContent.ts`. Reuses Gate Lab's `MistCloudNode`/`MistState.computeMistRows` directly rather than forking them |
| Shared view controls | `circuit-screen/view/QubitCountControl.ts`, `InspectControlNode.ts`, `undoRedoKeyboardShortcuts.ts` — reused by GateLabScreenView; `undoRedoKeyboardShortcuts.ts` also reused by IntroScreenView (its `UndoRedoTarget` interface is structural, so `IntroModel` satisfies it without extending anything) |
| Constants / colors | `src/QubitSketchConstants.ts`, `QubitSketchColors.ts`, `src/i18n/StringManager.ts` |

## Model

`QubitSketchModel` and `GateLabModel` `extends CircuitEditingModel implements TModel` (see
`src/common/CircuitEditingModel.ts` for the full shared API). Circuit grid `circuit[qubit][step]`
holds `CircuitCell` gate placements; `QuantumSimulator.simulate` recomputes derived state. Gate
Lab additionally drives `inputBitsProperty` (the starting computational-basis state — the book's
"drop a black or white ball") via `toggleInputBit`; CircuitScreen never touches it, so it stays 0.

`IntroModel` is a **standalone** `TModel` — deliberately not a `CircuitEditingModel` subclass,
since that base is grid-shaped (qubit × step) with undo/redo over the whole grid, which doesn't
fit an ordered, variable-length single-lane box stack. It still reuses the shared engine directly
(builds a 1-row `Grid` via `CircuitGrid.emptyGrid`/`withCell`, then calls `simulate`) rather than
any new physics, and has its own small undo/redo over just `{boxes, inputBall}`. It is also the
only model in this sim with a real `step(dt)` — `fallProgressProperty` advances at a constant
rate while `isDroppingProperty` is true, driving the falling-ball animation; every other screen's
`step()` is a no-op (SceneryStack's `Sim` calls `screen.model.step(dt)` directly regardless of the
view, so this Just Works without any view-level wiring — see `Sim.ts`'s `stepSimulationAction`).

| Property | Type | Meaning |
|---|---|---|
| `qubitCountProperty` | `ReadOnlyProperty<number>` | 1–MAX_QUBITS wires |
| `selectedToolProperty` | `Property<SelectedTool>` | active palette tool (gate, control, eraser) |
| `circuitProperty` | `ReadOnlyProperty<CircuitCell[][]>` | 2-D grid; mutate via model methods only |
| `stateVectorProperty` | derived | complex amplitudes, length 2ⁿ |
| `probabilitiesProperty` | derived | \|αₖ\|² per basis state |
| `blochVectorsProperty` | derived | per-qubit reduced Bloch vector (length < 1 ⇒ entangled) |
| `inspectStepProperty` | `Property<number \| null>` | step-through inspect cursor (excluded from undo/URL) |
| `canUndoProperty` / `canRedoProperty` | derived | history availability |

### Simulation rules & numerics

- **Endianness:** qubit 0 = LSB; basis index `i` has bit `q` set iff `(i >> q) & 1`. Kets display big-endian `|q_{n-1}…q_0⟩`.
- Gates apply column-by-column; multiple controls in one column → Toffoli (CCX). Two SWAP endpoints plus one or more controls in a column → controlled-SWAP (CSWAP/Fredkin). CSWAP QASM **export** emits `cswap` (single control only; 2+ controls emit an `// unsupported` comment); QASM **import** does not yet recognize `cswap` (rejects the whole program, per QasmImport.ts).
- **Legal column shapes live in `ColumnRules.ts`** (`isApplicableColumn`), checked by the placement guards, `CircuitSerializer.deserialize`, and the QASM packer. Guards scan **all** `MAX_QUBITS` rows, not just visible ones, so hiding a wire cannot smuggle in a column whose gates get dropped later. Change it in the same commit as `applyColumn`.
- **Measure** samples histogram from \|αₖ\|² but does **not** collapse mid-circuit state.
- CPU-only statevector (no WebGL sim); no density matrix.

## Accessibility

Follows the shared [OpenLyceum accessibility convention](https://github.com/OpenLyceum/Baton/blob/main/ACCESSIBILITY.md).
`CircuitScreenView`/`GateLabScreenView`/`IntroScreenView` each register their own
`*ScreenSummaryContent` (live current-details: qubit/ball/box count) via the
`screenSummaryContent` super-option, and order the PDOM through a wrapper `Node`. CircuitScreen's
a11y strings live under the top-level `a11y` key (`StringManager.getA11yStrings()`); Gate Lab's
live under `gateLab.a11y` and Intro's under `intro.a11y` (`StringManager.getGateLabStrings().a11y`
/ `getIntroStrings().a11y`), since each describes a different play area.

## Compliance carve-outs

- **Hardcoded colors:** any remaining non-profile fills are limited to matrix/tooltip debugging chrome; prefer `QubitSketchColors` for new UI.


### `package.json` overrides

JSON cannot carry comments, so the rationale for forced transitive pins lives here. Prefer
**tilde (`~`) or exact** versions — caret (`^`) lets minors drift under what is meant to be a
hard pin. Dependabot ignores these three names (see `.github/dependabot.yml`) so it does not
open PRs that fight the overrides. Revisit when SceneryStack drops or re-pins them upstream.

| Override | Pin | Why |
|---|---|---|
| `lodash` | `~4.18.1` | SceneryStack declares `~4.17.12`. Bump clears Dependabot/npm advisories patched in 4.18.x (e.g. GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh). |
| `three` | `~0.125.2` | SceneryStack declares `^0.104.0`. Floor is 0.125.0 for GHSA-fq6p-x6j3-cmmq (ReDoS). Staying on the 0.125 line avoids a larger API jump; **0.125.x still has open CVEs** (e.g. XSS GHSA-7vvq-7r29-5vg3, fixed only in ≥0.137.0). Remove this override if/when SceneryStack stops depending on `three` or pins a patched line itself. LightPropagation keeps a higher `three` pin — do not force 0.125 there. |
| `brace-expansion` | `~5.0.9` | Transitive via `vite-plugin-pwa` / Workbox. Clears npm audit (originally GHSA-mh99-v99m-4gvg; keep ≥5.0.9 for GHSA-rgw5-rvv9-x895). |

## Testing

Fleet-standard Vitest layout:

| Path | Purpose |
|---|---|
| `vitest.config.ts` | `happy-dom` environment, `setupFiles`, `execArgv: ["--expose-gc"]` |
| `tests/setup.ts` | Canvas / AudioContext mocks + `init({ name: "…" })` before SceneryStack imports |
| `tests/**/*.test.ts` | Model/physics unit tests |
| `tests/memory-leak.test.ts` | WeakRef + `forceGC` dispose regression (fleet pattern) |

Actual specs:

- `tests/quantum-simulator.test.ts` — physics engine (gates, controls, SWAP, CSWAP, Bloch vectors, inspect prefix, `inputBits`)
- `tests/serializers.test.ts` — URL + QASM round-trips, import column packing, malformed-input tolerance, angle-expression parsing (scientific notation, nested parens, garbage rejection), CSWAP export (and its documented import gap)
- `tests/qubit-sketch-model.test.ts` — CircuitScreen placement guards (column shapes), undo/redo history
- `tests/gate-lab-model.test.ts` — Gate Lab placement guards over its restricted tool set, the input-ball bitmask, undo/redo
- `tests/mist-state.test.ts` — statevector → mist-row reduction (`computeMistRows`): superposition, the book's two-PETE-boxes collapse, entanglement, sign
- `tests/intro-model.test.ts` — the ordered box stack (insert/remove/undo/redo, the `MAX_INTRO_BOXES` depth cap), the input ball, the fall animation state machine (`step(dt)` driving `fallProgressProperty`/`displayStateProperty`), and the same headline PETE-box physics cases exercised through `IntroModel`
- `tests/column-rules.test.ts` — the shared legality predicate + all three writers; includes a 4000-edit editor fuzz asserting the invariant holds over the whole grid after every reachable edit
- `tests/display-utils.test.ts` — amplitude/phase formatting (consistent U+2212 minus, no negative zero)
- `tests/memory-leak.test.ts` — covers `GatePalettePanel.dispose()` and `BoxPalettePanel.dispose()` (palette drag previews / tooltips link global color Properties), plus bare-model collectibility for both screens
- Shared grid/cell builders live in `tests/helpers.ts`

Run `npm test`. CI runs the suite when a `test` script is present.

## Commands

```bash
npm run lint && npm run check && npm run build
npm test
```

`npm run release` intentionally skips `npm test` in some sims — append `&& npm test` before the version bump so a release cannot ship a failing suite.

## Development notes

- URL hash `#circuit=…` shares circuits; QASM dialog for export/import (teaching subset) — CircuitScreen only. Undo/redo (Ctrl+Z / Ctrl+Y) on both screens; inspect mode scrubs columns without changing the stored circuit.
- **Adding a gate (CircuitScreen):** key in `GateType.ts` → matrix in `GateMatrices.ts` → color in `QubitSketchColors.ts` → maps in `GateNode.ts` → `ALL_TOOLS` in `GatePalettePanel.ts` → locale JSON + `StringManager.getToolDescriptions()`.
- **Gate Lab's and Intro's palettes are intentionally fixed** to the book's vocabulary
  (`GATE_LAB_TOOL_VALUES` in `GateType.ts`: NOT/PETE/control/swap/eraser; Intro: just NOT/PETE,
  see `IntroBoxType` in `IntroModel.ts`) — neither is meant to grow toward CircuitScreen's full
  gate set; adding a gate would leave the real-±1 amplitude world the mist display assumes (see
  `MistState.ts`).
- **Intro's stack depth is capped below the shared grid's `NUM_STEPS`** (`MAX_INTRO_BOXES = 5` in
  `IntroModel.ts`, vs. `NUM_STEPS = 8`) — boxes are drawn big and literal in a single vertical
  column, so 8 stacked would not fit this sim's fixed 1024×618 layout. Don't "fix" this by
  reusing `NUM_STEPS` directly; recheck `BallDropCanvas`'s layout math if you ever do raise it.
- Non-goals: arithmetic/QFT/Grover gates; time-animated gates (outside Intro's ball-drop
  animation); mid-circuit collapsing measurement; one target gate per column when controls
  present; an Intro/Gate Lab screen covering the book's Part II (entanglement/nonlocality game)
  or Part III (foundations) content — both currently cover Part I only; CSWAP QASM import (see
  the Simulation rules note above).
