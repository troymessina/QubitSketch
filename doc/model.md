# Model - QubitSketch

This document describes the model (the underlying physics, math, and behavior) for the simulation,
in terms appropriate for an educator. It is the companion to
[implementation-notes.md](./implementation-notes.md), which targets developers.

## Overview

QubitSketch has two screens sharing one circuit-grid engine:

- **Gate Lab** — an introductory companion modeled on Terry Rudolph's book *Q is for Quantum*
  (see References). Qubits are drawn as black/white **balls**; gates are labeled **boxes** (NOT,
  PETE = Hadamard, control, swap); superposition is a **"mist"** of surviving ball configurations,
  each carrying a **sign** (relative phase). Real ±1 amplitudes only — no complex numbers — by
  design, matching the book. See "Gate Lab model" below.
- **Circuit** — a full **quantum-circuit builder and statevector simulator**. Students place gates
  on a grid of qubit wires and watch the **statevector**, **measurement probabilities**,
  **Bloch-sphere reduced states**, and (optionally) a sampled **measurement histogram** update
  live. It is a pedagogical tool inspired by Craig Gidney's *Quirk*, focused on superposition,
  entanglement, interference, and how unitary gates (including complex phases) transform a
  multi-qubit register.

The rest of this document describes the Circuit screen's model in full; the "Gate Lab model"
section at the end describes Gate Lab's restricted, book-faithful subset of the same engine.

The key ideas a student should take away:

- A register of *n* qubits is described by **2ⁿ complex amplitudes**; the state must stay **normalized**
  (total probability 1).
- Each gate column applies a **unitary** transformation; composing gates is matrix multiplication
  applied column-by-column from left to right.
- **Controlled gates** (• on |1⟩, ◦ on |0⟩) act on one target only when all control conditions match;
  CNOT and Toffoli (CCX) are built from control dots plus a target gate.
- **Entanglement** shows up when a single-qubit Bloch vector has length **less than 1** — the qubit
  cannot be described by a pure state alone.
- The **Measure** tool samples outcomes from |αₖ|² but does **not** collapse the simulated state
  mid-circuit (inspect mode scrubs columns without changing the stored circuit).

## Quantities and units

These are dimensionless quantum-mechanical quantities (ħ = 1 convention).

| Quantity | Symbol | Notes |
|---|---|---|
| Number of qubits | n | 1–5 wires; state dimension 2ⁿ |
| Statevector | \|ψ⟩ | Unit-norm vector in ℂ^(2ⁿ) |
| Basis index | k | 0 … 2ⁿ−1; bit q set iff (k >> q) & 1 |
| Amplitude | αₖ | Complex; magnitude and phase displayed |
| Probability | pₖ = \|αₖ\|² | Born rule; Σ pₖ = 1 |
| Gate / column | U | Unitary on one or more wires per column rules |
| Bloch vector | (⟨X⟩, ⟨Y⟩, ⟨Z⟩) | Reduced one-qubit state; length ≤ 1 |
| Rotation angle | θ | Radians for Rx, Ry, Rz parametrized gates |

**Display endianness:** qubit 0 is the **least significant bit** in the basis index, but kets are
shown in **big-endian** notation |q_{n−1}…q_0⟩ to match textbook bra-ket ordering.

## Governing equations

**Initialization.** The circuit starts in |0…0⟩ (α_0 = 1, all other amplitudes 0).

**Column evolution.** For each column (step) from left to right, the engine applies:

```
|ψ'⟩ = U_column · |ψ⟩
```

Column semantics (v1):

- **Single-qubit gates** (H, X, Y, Z, S, T, √X, Rx/Ry/Rz, …) on independent targets commute and
  are all applied when no controls are present.
- **Controls:** one gate-bearing wire is the **target**; all • (on) and ◦ (off) conditions must
  match. Example: CNOT = X target + one • control; Toffoli = X target + two • controls.
- **SWAP:** exactly two ✕ endpoints in a column with **no** controls exchanges those wires.
- **Controlled-SWAP (CSWAP/Fredkin):** exactly two ✕ endpoints in a column **with** one or more
  • / ◦ conditions exchanges those wires only when the controls match.
- 3+ swap markers in one column are **not** supported (no-op).

**Controlled single-qubit apply** (conceptually): for each basis pair differing only at the target bit,
if control bits match, rotate amplitudes by the 2×2 gate matrix; otherwise leave them unchanged.

**Measurement display.** Probabilities pₖ = |αₖ|² are exact from the statevector. The histogram **samples**
a basis outcome from the **displayed** distribution (the inspect-mode prefix state when inspect is active);
it is pedagogical, not a mid-circuit projection of |ψ⟩. The tally clears automatically whenever that
distribution changes (circuit edit, qubit-count change, or inspect scrub), so it never mixes shots from
different circuits.

**Inspect mode.** `inspectStep = k` shows the state after the first *k* columns without editing the
circuit or undo history.

## Simplifications and assumptions

- **Ideal, noiseless** unitary gates; no decoherence, gate error, or readout error.
- **Pure-state CPU statevector** — exact but exponential in n; capped at **5 qubits** (32 amplitudes).
- **Global phase** is unobservable and not emphasized in the UI.
- **One controlled target per column** when controls are present. Every column is one of four shapes:
  independent single-qubit gates, a single controlled operation, a single SWAP pair, or a single
  controlled SWAP (CSWAP/Fredkin) pair. This is enforced everywhere a circuit can come from — the
  editor refuses such placements (including ones that would only misbehave later, once a hidden
  wire is shown again), and a shared `#circuit=` link or QASM program describing an unsupported
  column is rejected rather than loaded. So a gate you can see is always a gate that acts.
- OpenQASM import/export covers a **teaching subset** (see QASM dialog); not full OpenQASM 3.

## Gate Lab model

Gate Lab reuses the exact same engine described above (`QuantumSimulator.simulate`,
`ColumnRules.isApplicableColumn`), restricted to a smaller wire count and gate set, plus one
addition: an arbitrary **initial computational-basis state** (the book's "drop a black or white
ball") rather than always starting at |0…0⟩.

- **Balls ↔ qubits.** A white ball is |0⟩; a black ball is |1⟩. Each wire's starting ball is
  chosen by clicking it (`inputBitsProperty`, a bitmask), not fixed to |0…0⟩.
- **Boxes ↔ gates.** Only NOT (Pauli-X), PETE (Hadamard), control, and swap are exposed
  (`GATE_LAB_TOOL_VALUES`). CNOT, Toffoli, and CSWAP (Fredkin) are built the same compositional
  way as on the Circuit screen — a control sharing a column with a target gate, or with a SWAP
  pair — no separate tool exists for them. The book's proof sketch (citing Shi's theorem) that
  Toffoli + Hadamard alone are universal for quantum computing is why this small set suffices to
  demonstrate real quantum phenomena, not just a simplified subset of them.
- **Mist ↔ superposition.** Because every exposed gate (X, H, control, SWAP) has a real matrix,
  starting from a real computational-basis input keeps **every amplitude exactly real** through
  the whole circuit. So instead of a magnitude/phase readout, Gate Lab shows only a **sign**:
  each surviving basis configuration in the "mist" is drawn as one row of ball glyphs, with a
  leading "−" when its amplitude is negative (`MistState.computeMistRows`). Two configurations
  differing only in sign cancel automatically — the statevector amplitude is exactly zero — which
  is the book's central "PETE box" surprise: two stacked PETE (Hadamard) boxes always return a
  ball to its original color, deterministically, despite each box alone being perfectly random.
- **Peek ↔ observe.** The Peek button samples one outcome from |αₖ|² (Born rule) and shows just
  that single, deterministic result — the book's "observe the ball" — rather than an accumulating
  histogram; Reset returns to the mist. Like the Circuit screen's Measure tool, this does not
  collapse the simulated state mid-circuit.
- **Scope.** Gate Lab currently covers the book's Part I (Q-COMPUTING: gates, superposition,
  interference). Part II's entanglement/nonlocality game and Part III's foundational discussion
  are not modeled here.

## References

- M. A. Nielsen & I. L. Chuang, *Quantum Computation and Quantum Information*, Ch. 1–2 (qubits,
  gates, measurement, entanglement).
- Terry Rudolph, *Q is for Quantum* (2017), Part I — the ball/box/mist picture Gate Lab is modeled
  on; qisforquantum.org.
- Craig Gidney, *Quirk* quantum circuit simulator (design inspiration; local checkout: `../Baseline/Qubit/Quirk`
  only).
- Standard gate definitions: Pauli X/Y/Z, Hadamard, phase gates, Rx(θ) = exp(−iθX/2), etc.
