# QubitSketch

[![CI](https://github.com/OpenPhysics/QubitSketch/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenPhysics/QubitSketch/actions/workflows/ci.yml)

A two-screen quantum computing sim built with [SceneryStack](https://scenerystack.org/): a
book-modeled **Gate Lab** for an introduction to single gates and superposition, and a full
drag-and-drop **Circuit** builder with a live state simulator. Place gates on qubit wires and
watch probabilities, amplitudes, Bloch spheres, and measurements update in real time.

## Features

- **Gate Lab** — modeled on Terry Rudolph's book *Q is for Quantum*: black/white balls (qubits)
  pass through NOT/PETE (Hadamard)/control/swap boxes; superposition is shown as a "mist" of
  surviving ball configurations and their sign; a Peek button samples one outcome
- **Circuit** — build circuits by dragging gates or click-to-place; undo/redo and shareable URL
  encoding
  - Standard gates (H, X, Y, Z, S, T, √X) plus parametrized Rx/Ry/Rz rotations
  - Controls, CNOT, Toffoli, SWAP, and CSWAP (Fredkin) columns for entanglement experiments
  - Live CPU statevector simulation (≤ 5 qubits) driving four result panels
  - Probabilities, amplitudes, drag-rotatable Bloch spheres, and measurement histogram
- English, Spanish, and French UI, projector color profile, and PWA support

## Quick Start

```bash
npm install
npm run icons    # generate PNG icons from public/icons/icon.svg
npm start        # dev server → http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm start` / `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build → `dist/` |
| `npm test` | Run Vitest unit tests (includes memory-leak suite) |
| `npm run preview` | Preview the production build locally |
| `npm run check` | TypeScript type check |
| `npm run lint` | Biome lint check |
| `npm run format` | Auto-format all files |
| `npm run fix` | Lint + auto-fix |
| `npm run icons` | Regenerate PNG icons from `public/icons/icon.svg` |
| `npm run clean` | Remove `dist/` |

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| [SceneryStack](https://scenerystack.org/) | ^3.0.0 | Simulation framework |
| [Vite](https://vitejs.dev/) | ^8 | Build tool + dev server |
| [TypeScript](https://www.typescriptlang.org/) | ^7 | Type-safe JavaScript |
| [Biome](https://biomejs.dev/) | ^2.5 | Linting + formatting |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | ^1 | PWA + service worker |

## License

GNU Affero General Public License v3.0 — see [OpenPhysics org license](https://github.com/OpenPhysics/.github/blob/main/LICENSE).

## Contributing

See [OpenPhysics contributing guidelines](https://github.com/OpenPhysics/.github/blob/main/CONTRIBUTING.md).
Report bugs via GitHub Issues; use org issue templates.
