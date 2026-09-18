/**
 * IntroPalettePanel.ts
 *
 * The Intro screen's palette: NOT and PETE, draggable onto the box stack (or
 * click-to-select, then click the track to insert — mirrors every other screen's
 * dual drag/click support). Adapted from GatePalettePanel.ts's drag mechanics
 * (src/circuit-screen/view/GatePalettePanel.ts) and BoxPalettePanel.ts's tooltip
 * handling (src/gate-lab-screen/view/BoxPalettePanel.ts), simplified to two boxes
 * dropping onto an ordered-stack index instead of a grid cell.
 */
import type { Vector2 } from "scenerystack/dot";
import { DragListener, Node, Rectangle } from "scenerystack/scenery";
import type { Complex2x2 } from "../../circuit-screen/model/GateMatrices.js";
import { GATE_MATRICES } from "../../circuit-screen/model/GateMatrices.js";
import { MatrixTooltipNode } from "../../circuit-screen/view/MatrixTooltipNode.js";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import type { IntroBoxType, IntroModel } from "../model/IntroModel.js";
import type { StackDropTarget } from "./BallDropCanvas.js";
import { BOX_HEIGHT, BOX_WIDTH } from "./BallDropCanvas.js";
import { BoxNode } from "./BoxNode.js";

/** Where dragged boxes float and land. Supplied by IntroScreenView. */
export interface PaletteDragContext {
  readonly dragLayer: Node;
  readonly dropTarget: StackDropTarget;
  /** Overlay layer (above everything) where hover tooltips are shown. */
  readonly overlayLayer: Node;
}

const BOX_TYPES: readonly IntroBoxType[] = ["X", "H"];

// Palette tiles are a scaled-down BoxNode, not full box size — the stack itself shows the real size.
const TILE_SCALE = 0.55;
const TILE_WIDTH = Math.round(BOX_WIDTH * TILE_SCALE);
const TILE_HEIGHT = Math.round(BOX_HEIGHT * TILE_SCALE);
const PANEL_PADDING = 10;
const TILE_GAP = 10;
const HIGHLIGHT_INSET = 3;

type ButtonEntry = { type: IntroBoxType; highlight: Rectangle };

export class IntroPalettePanel extends Node {
  public constructor(model: IntroModel, dragContext?: PaletteDragContext) {
    super();

    const panelWidth = TILE_WIDTH + PANEL_PADDING * 2;
    const panelHeight = BOX_TYPES.length * (TILE_HEIGHT + TILE_GAP) - TILE_GAP + PANEL_PADDING * 2;

    this.addChild(
      new Rectangle(0, 0, panelWidth, panelHeight, {
        fill: QubitSketchColors.panelBackgroundColorProperty,
        stroke: QubitSketchColors.panelBorderColorProperty,
        lineWidth: 1,
        cornerRadius: 8,
      }),
    );

    const descriptions = StringManager.getInstance().getIntroStrings().toolDescriptions;
    const overlayLayer = dragContext?.overlayLayer;
    let activeTooltip: Node | null = null;
    const hideTooltip = (): void => {
      if (activeTooltip !== null && overlayLayer !== undefined) {
        overlayLayer.removeChild(activeTooltip);
        activeTooltip.dispose();
        activeTooltip = null;
      }
    };
    const showTooltip = (type: IntroBoxType, globalPoint: Vector2): void => {
      if (overlayLayer === undefined) {
        return;
      }
      hideTooltip();
      const matrix: Complex2x2 = GATE_MATRICES[type];
      const tooltip = new MatrixTooltipNode(matrix, descriptions[type]);
      const local = overlayLayer.globalToLocalPoint(globalPoint);
      tooltip.left = local.x + 16;
      tooltip.top = Math.max(4, local.y + 10);
      overlayLayer.addChild(tooltip);
      activeTooltip = tooltip;
    };

    const buttonEntries: ButtonEntry[] = [];

    for (const [i, type] of BOX_TYPES.entries()) {
      const btnX = PANEL_PADDING;
      const btnY = PANEL_PADDING + i * (TILE_HEIGHT + TILE_GAP);

      const highlight = new Rectangle(
        btnX - HIGHLIGHT_INSET,
        btnY - HIGHLIGHT_INSET,
        TILE_WIDTH + HIGHLIGHT_INSET * 2,
        TILE_HEIGHT + HIGHLIGHT_INSET * 2,
        {
          fill: null,
          stroke: QubitSketchColors.selectedToolHighlightColorProperty,
          lineWidth: HIGHLIGHT_INSET,
          cornerRadius: 9,
          visible: false,
          pickable: false,
        },
      );
      this.addChild(highlight);

      const tile = new BoxNode(type, TILE_WIDTH, TILE_HEIGHT);
      tile.x = btnX;
      tile.y = btnY;
      tile.pickable = false;
      this.addChild(tile);

      const hitArea = new Rectangle(btnX, btnY, TILE_WIDTH, TILE_HEIGHT, {
        fill: "rgba(0,0,0,0)",
        cursor: "pointer",
        tagName: "button",
        accessibleName: descriptions[type],
      });

      if (overlayLayer !== undefined) {
        hitArea.addInputListener({
          enter: (event) => showTooltip(type, event.pointer.point),
          exit: () => hideTooltip(),
        });
      }

      if (dragContext === undefined) {
        hitArea.addInputListener({
          down: () => {
            model.selectedToolProperty.value = type;
          },
        });
      } else {
        let preview: Node | null = null;
        const { dragLayer, dropTarget } = dragContext;
        const clearPreview = (): void => {
          if (preview !== null) {
            dragLayer.removeChild(preview);
            preview.dispose();
            preview = null;
          }
        };
        const dragListener = new DragListener({
          start: (event) => {
            hideTooltip();
            model.selectedToolProperty.value = type;
            preview = new BoxNode(type, BOX_WIDTH, BOX_HEIGHT);
            preview.opacity = 0.85;
            dragLayer.addChild(preview);
            preview.center = dragLayer.globalToLocalPoint(event.pointer.point);
          },
          drag: (event) => {
            if (preview !== null) {
              preview.center = dragLayer.globalToLocalPoint(event.pointer.point);
            }
          },
          end: (event) => {
            const index = event === null ? null : dropTarget.insertionIndexAt(event.pointer.point);
            if (index !== null) {
              model.insertBox(index, type);
            }
            clearPreview();
          },
        });
        hitArea.addInputListener(dragListener);
        this.disposeEmitter.addListener(() => {
          dragListener.dispose();
          clearPreview();
        });
      }
      this.addChild(hitArea);

      buttonEntries.push({ type, highlight });
    }

    const selectedToolListener = (activeType: IntroBoxType): void => {
      for (const entry of buttonEntries) {
        entry.highlight.visible = entry.type === activeType;
      }
    };
    model.selectedToolProperty.link(selectedToolListener);
    this.disposeEmitter.addListener(() => {
      model.selectedToolProperty.unlink(selectedToolListener);
      hideTooltip();
    });
  }

  public override dispose(): void {
    for (const child of [...this.children]) {
      disposeSubtree(child);
    }
    super.dispose();
  }
}

/** Disposes `node` and all its descendants, leaves-first (see GatePalettePanel's twin). */
function disposeSubtree(node: Node): void {
  for (const child of [...node.children]) {
    disposeSubtree(child);
  }
  if (!node.isDisposed) {
    node.dispose();
  }
}
