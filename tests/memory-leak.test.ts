/**
 * memory-leak.test.ts
 *
 * Creates the model and the GatePalettePanel, disposes them, forces garbage
 * collection, then asserts via WeakRef that the disposed objects were actually
 * collected. Requires --expose-gc (configured in vitest.config.ts execArgv).
 *
 * V8 requires a *function* boundary (not merely a block scope) to release local
 * variables for collection, so every allocation is wrapped in a helper function
 * whose strong references die when it returns.
 *
 * GatePalettePanel is the only sim component that adds/removes nodes at runtime
 * (drag previews in the dragLayer, hover tooltips in the overlayLayer) and links
 * to the shared model's selectedToolProperty. dispose() must unlink that
 * listener, dispose the drag listeners, and dispose the whole child subtree so
 * the global QubitSketchColors Properties no longer retain the panel.
 */

import type { Vector2 } from "scenerystack/dot";
import { Node } from "scenerystack/scenery";
import { describe, expect, it } from "vitest";
import { QubitSketchModel } from "../src/circuit-screen/model/QubitSketchModel.js";
import type { SlotDropTarget } from "../src/circuit-screen/view/CircuitCanvas.js";
import { GatePalettePanel, type PaletteDragContext } from "../src/circuit-screen/view/GatePalettePanel.js";
import { GateLabModel } from "../src/gate-lab-screen/model/GateLabModel.js";
import { BoxPalettePanel } from "../src/gate-lab-screen/view/BoxPalettePanel.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

// Long-lived model sentinel: stays alive across tests so that a disposed panel
// must drop its own reference (unlink selectedToolProperty) to be collectible.
const sharedModel = new QubitSketchModel();
const sharedGateLabModel = new GateLabModel();

// Drop target that never reports a slot — drags simply cancel.
const noopDropTarget: SlotDropTarget = {
  slotIndexAt: (_globalPoint: Vector2, _qubitCount: number) => null,
};

/** A fresh drag context (drag + overlay layers) for one panel under test. */
function makeDragContext(): PaletteDragContext {
  return { dragLayer: new Node(), dropTarget: noopDropTarget, overlayLayer: new Node() };
}

describeDisposalLeaks([
  {
    name: "GatePalettePanel (click-to-select, no dragContext)",
    create: () => new GatePalettePanel(sharedModel, undefined),
  },
  { name: "BoxPalettePanel (no overlay layer)", create: () => new BoxPalettePanel(sharedGateLabModel) },
  {
    name: "BoxPalettePanel (with overlay layer)",
    create: () => new BoxPalettePanel(sharedGateLabModel, new Node()),
    idempotentDispose: true,
  },
]);

// Models are plain TModels with no dispose() of their own — only forceGC applies.
describe("Memory leak regression — bare models", () => {
  it("bare QubitSketchModel is collected (no global retention)", async () => {
    const ref = (() => new WeakRef<object>(new QubitSketchModel()))();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("bare GateLabModel is collected (no global retention)", async () => {
    const ref = (() => new WeakRef<object>(new GateLabModel()))();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });
});

// GatePalettePanel also strands drag-preview/tooltip nodes in caller-owned layers if dispose()
// doesn't clean them up — a failure mode the generic harness above can't see, so it's covered here.
describe("Memory leak regression — GatePalettePanel drag context", () => {
  it("GatePalettePanel (drag-enabled) is collected and leaves no stranded preview/tooltip nodes", async () => {
    const dragContext = makeDragContext();
    // `panel` must not survive as a local in this (suspended-by-await) function; a nested
    // function boundary that returns before forceGC runs lets V8 release it.
    const panelRef = ((): WeakRef<object> => {
      const panel = new GatePalettePanel(sharedModel, dragContext);
      const ref = new WeakRef<object>(panel);
      panel.dispose();
      return ref;
    })();
    await forceGC(panelRef);
    expect(panelRef.deref()).toBeUndefined();
    expect(dragContext.dragLayer.children.length).toBe(0);
    expect(dragContext.overlayLayer.children.length).toBe(0);
  });

  it("double dispose() does not throw", () => {
    const panel = new GatePalettePanel(sharedModel, makeDragContext());
    panel.dispose();
    expect(() => panel.dispose()).not.toThrow();
  });

  it("repeated create/dispose cycles (with and without dragContext) leave no survivors", async () => {
    // Each panel is created inside a function that returns before the loop continues, so
    // `panel` never lingers as a local in this (suspended-by-await) function — see above.
    const createAndDisposePanel = (withDragContext: boolean): WeakRef<object> => {
      const panel = new GatePalettePanel(sharedModel, withDragContext ? makeDragContext() : undefined);
      const ref = new WeakRef<object>(panel);
      panel.dispose();
      return ref;
    };
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 20; i++) {
      refs.push(createAndDisposePanel(i % 2 === 0));
    }
    await forceGC(refs);
    expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
  });
});
