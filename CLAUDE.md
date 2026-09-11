# CLAUDE.md — QubitSketch

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenPhysics/.github/CLAUDE.md](https://github.com/OpenPhysics/.github/blob/main/CLAUDE.md).

## Project

Two-screen sim, both built on the same shared circuit-grid engine:

1. **Gate Lab** (`src/gate-lab-screen/`) — an introductory companion modeled on Terry Rudolph's
   book *Q is for Quantum*: black/white **balls** (qubits) pass through labeled **boxes**
   (NOT/PETE/control/swap; PETE = Hadamard), and superposition is shown as a **"mist"** of
   surviving ball configurations with a sign (relative phase) — real ±1 amplitudes only, no
   complex numbers, matching the book. See doc/model.md.
2. **Circuit** (`src/circuit-screen/`) — the full drag-and-drop **quantum circuit builder** with
   live CPU statevector simulation (≤ 5 qubits). Pedagogical reimplementation of
   [Quirk](https://github.com/Strilanc/Quirk)'s core (local checkout: `../Baseline/Qubit/Quirk`)
   — superposition, entanglement, and unitary gates (including complex phases) on a grid of
   qubit wires.

Physics for educators: `doc/model.md`. Architecture: `doc/implementation-notes.md`.

## Key files

| Area | Location |
|---|---|
| Screens | `src/circuit-screen/CircuitScreen.ts`, `src/gate-lab-screen/GateLabScreen.ts` |
| Shared editing core | `src/common/CircuitEditingModel.ts` — grid editing, undo/redo, inspect, live statevector/probability/Bloch derived Properties, and the input-ball bitmask; both screens' models extend it (`QubitSketchModel`, `GateLabModel`) with only their qubit-count range and tool palette |
| Shared engine | `circuit-screen/model/QuantumSimulator.ts` (pure engine), `GateType.ts`, `GateMatrices.ts`, `CircuitGrid.ts`, `ColumnRules.ts` — used by both screens |
| Circuit-only model | `circuit-screen/model/CircuitSerializer.ts`, `CircuitUrlSync.ts`, `QasmSerializer.ts` (barrel over `QasmExport/Import/Mappings/Angle.ts`) — URL-sharing and QASM are CircuitScreen-only; Gate Lab has neither (teaching sandbox, not a shareable-circuit tool) |
| Circuit view | `circuit-screen/view/CircuitScreenView.ts`, `CircuitCanvas.ts`, `GatePalettePanel.ts`, `BlochSpheresNode.ts`, `CircuitScreenSummaryContent.ts` |
| Gate Lab view | `gate-lab-screen/view/GateLabScreenView.ts`, `GateLabCanvas.ts` (ball/box grid), `BoxPalettePanel.ts`, `MistCloudNode.ts` (the mist display + Peek), `GateLabScreenSummaryContent.ts` |
| Shared view controls | `circuit-screen/view/QubitCountControl.ts`, `InspectControlNode.ts`, `undoRedoKeyboardShortcuts.ts` — reused by GateLabScreenView |
| Constants / colors | `src/QubitSketchConstants.ts`, `QubitSketchColors.ts`, `src/i18n/StringManager.ts` |

## Model

Both `QubitSketchModel` and `GateLabModel` `extends CircuitEditingModel implements TModel` (see
`src/common/CircuitEditingModel.ts` for the full shared API). Circuit grid `circuit[qubit][step]`
holds `CircuitCell` gate placements; `QuantumSimulator.simulate` recomputes derived state. Gate
Lab additionally drives `inputBitsProperty` (the starting computational-basis state — the book's
"drop a black or white ball") via `toggleInputBit`; CircuitScreen never touches it, so it stays 0.

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

Follows the shared [OpenPhysics accessibility convention](https://github.com/OpenPhysics/Baton/blob/main/ACCESSIBILITY.md).
`CircuitScreenView`/`GateLabScreenView` each register their own `*ScreenSummaryContent` (live
current-details: qubit/ball count) via the `screenSummaryContent` super-option, and order the PDOM
through a wrapper `Node`. CircuitScreen's a11y strings live under the top-level `a11y` key
(`StringManager.getA11yStrings()`); Gate Lab's live under `gateLab.a11y`
(`StringManager.getGateLabStrings().a11y`), since they describe a different play area.

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
- **Gate Lab's palette is intentionally fixed** to the book's vocabulary (`GATE_LAB_TOOL_VALUES` in `GateType.ts`: NOT/PETE/control/swap/eraser) — it is not meant to grow toward CircuitScreen's full gate set; adding a gate there would leave the real-±1 amplitude world the mist display assumes (see `MistState.ts`).
- Non-goals: arithmetic/QFT/Grover gates; time-animated gates; mid-circuit collapsing measurement; one target gate per column when controls present; a Gate Lab screen covering the book's Part II (entanglement/nonlocality game) or Part III (foundations) content — Gate Lab currently covers Part I only; CSWAP QASM import (see the Simulation rules note above).
