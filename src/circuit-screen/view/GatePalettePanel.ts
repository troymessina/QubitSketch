/**
 * GatePalettePanel.ts
 *
 * A vertical panel of gate-selection buttons. Clicking a button sets
 * model.selectedToolProperty to that gate type. An eraser button is
 * included at the bottom for removing gates from the circuit.
 *
 * The active tool is shown with a highlight border.
 */
import type { Vector2 } from "scenerystack/dot";
import { Circle, DragListener, Line, Node, Rectangle, Text } from "scenerystack/scenery";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { scaledFont } from "../../QubitSketchFonts.js";
import type { Complex2x2 } from "../model/GateMatrices.js";
import { GATE_MATRICES, rotationMatrix } from "../model/GateMatrices.js";
import type { SelectedTool } from "../model/GateType.js";
import { GateType, ROTATION_TOOL_AXIS } from "../model/GateType.js";
import type { QubitSketchModel } from "../model/QubitSketchModel.js";
import type { SlotDropTarget } from "./CircuitCanvas.js";
import { GATE_CORNER_RADIUS, GateNode, RotationGateNode } from "./GateNode.js";
import { MatrixTooltipNode } from "./MatrixTooltipNode.js";

/** Where dragged gates float and land. Supplied by CircuitScreenView. */
export interface PaletteDragContext {
  readonly dragLayer: Node;
  readonly dropTarget: SlotDropTarget;
  /** Overlay layer (above everything) where hover tooltips are shown. */
  readonly overlayLayer: Node;
}

/** The 2×2 matrix a palette tool applies, or null for markers (control/swap/eraser). */
function toolMatrix(tool: SelectedTool): Complex2x2 | null {
  if (tool === "Rx" || tool === "Ry" || tool === "Rz") {
    return rotationMatrix(ROTATION_TOOL_AXIS[tool], Math.PI / 2);
  }
  if (tool === "control" || tool === "antiControl" || tool === "swap" || tool === "eraser") {
    return null;
  }
  return GATE_MATRICES[tool];
}

const BUTTON_SIZE = 52;
const BUTTON_GAP = 8;
const PANEL_PADDING = 10;
const HIGHLIGHT_INSET = 3;
const COLUMNS = 2;

const ALL_TOOLS: SelectedTool[] = [
  GateType.H,
  GateType.X,
  GateType.Y,
  GateType.Z,
  GateType.S,
  GateType.T,
  GateType.Sdg,
  GateType.Tdg,
  GateType.Vx,
  "Rx",
  "Ry",
  "Rz",
  "control",
  "antiControl",
  "swap",
  "eraser",
];

type ButtonEntry = { tool: SelectedTool; highlight: Rectangle };

export class GatePalettePanel extends Node {
  public constructor(model: QubitSketchModel, dragContext?: PaletteDragContext) {
    super();

    const rowCount = Math.ceil(ALL_TOOLS.length / COLUMNS);
    const panelHeight = rowCount * (BUTTON_SIZE + BUTTON_GAP) - BUTTON_GAP + PANEL_PADDING * 2;
    const panelWidth = COLUMNS * BUTTON_SIZE + (COLUMNS - 1) * BUTTON_GAP + PANEL_PADDING * 2;

    const background = new Rectangle(0, 0, panelWidth, panelHeight, {
      fill: QubitSketchColors.panelBackgroundColorProperty,
      stroke: QubitSketchColors.panelBorderColorProperty,
      lineWidth: 1,
      cornerRadius: 8,
    });
    this.addChild(background);

    const buttonEntries: ButtonEntry[] = [];

    // Hover tooltips (shown in the overlay layer, so they float above the circuit).
    const descriptions = StringManager.getInstance().getToolDescriptions();
    const overlayLayer = dragContext?.overlayLayer;
    let activeTooltip: Node | null = null;
    const hideTooltip = (): void => {
      if (activeTooltip !== null && overlayLayer !== undefined) {
        overlayLayer.removeChild(activeTooltip);
        // removeChild does not dispose: the tooltip links to global
        // QubitSketchColors Properties, so dispose it to release those links.
        activeTooltip.dispose();
        activeTooltip = null;
      }
    };
    const showTooltip = (tool: SelectedTool, globalPoint: Vector2): void => {
      if (overlayLayer === undefined) {
        return;
      }
      hideTooltip();
      const tooltip = new MatrixTooltipNode(toolMatrix(tool), descriptions[tool]);
      const local = overlayLayer.globalToLocalPoint(globalPoint);
      tooltip.left = local.x + 16;
      tooltip.top = Math.max(4, local.y + 10);
      overlayLayer.addChild(tooltip);
      activeTooltip = tooltip;
    };

    for (const [i, tool] of ALL_TOOLS.entries()) {
      const col = i % COLUMNS;
      const row = Math.floor(i / COLUMNS);
      const btnX = PANEL_PADDING + col * (BUTTON_SIZE + BUTTON_GAP);
      const btnY = PANEL_PADDING + row * (BUTTON_SIZE + BUTTON_GAP);

      // Selection highlight — a border drawn around the button when it is active
      const highlight = new Rectangle(
        btnX - HIGHLIGHT_INSET,
        btnY - HIGHLIGHT_INSET,
        BUTTON_SIZE + HIGHLIGHT_INSET * 2,
        BUTTON_SIZE + HIGHLIGHT_INSET * 2,
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

      const buttonNode = makeToolNode(tool, BUTTON_SIZE);
      buttonNode.x = btnX;
      buttonNode.y = btnY;
      buttonNode.pickable = false;
      this.addChild(buttonNode);

      // Transparent hit-area on top so clicks always register
      const hitArea = new Rectangle(btnX, btnY, BUTTON_SIZE, BUTTON_SIZE, {
        fill: "rgba(0,0,0,0)",
        cursor: "pointer",
        tagName: "button",
        accessibleName: descriptions[tool],
      });

      if (overlayLayer !== undefined) {
        hitArea.addInputListener({
          enter: (event) => showTooltip(tool, event.pointer.point),
          exit: () => hideTooltip(),
        });
      }

      if (dragContext === undefined) {
        // Click-to-select only.
        hitArea.addInputListener({
          down: () => {
            model.selectedToolProperty.value = tool;
          },
        });
      } else {
        // Drag a copy onto the grid; a plain click (no drop on a slot) just selects.
        let preview: Node | null = null;
        const { dragLayer, dropTarget } = dragContext;
        // Remove and dispose the floating preview. removeChild does not dispose,
        // and the preview links to global QubitSketchColors Properties, so it
        // must be disposed or it accumulates across drags.
        const clearPreview = (): void => {
          if (preview !== null) {
            dragLayer.removeChild(preview);
            preview.dispose();
            preview = null;
          }
        };
        // Palette drag-to-place is pointer-only; keyboard placement uses click-
        // to-select tool then slot focus / place shortcuts elsewhere in the sim.
        const dragListener = new DragListener({
          start: (event) => {
            hideTooltip();
            model.selectedToolProperty.value = tool;
            preview = makeToolNode(tool, BUTTON_SIZE);
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
            const slot =
              event === null ? null : dropTarget.slotIndexAt(event.pointer.point, model.qubitCountProperty.value);
            if (slot !== null) {
              model.placeCell(slot.qubit, slot.step);
            }
            clearPreview();
          },
        });
        hitArea.addInputListener(dragListener);
        // Tear down the drag listener and any in-flight preview on disposal.
        this.disposeEmitter.addListener(() => {
          dragListener.dispose();
          clearPreview();
        });
      }
      this.addChild(hitArea);

      buttonEntries.push({ tool, highlight });
    }

    // Keep highlight in sync with the selected tool
    const selectedToolListener = (activeTool: SelectedTool): void => {
      for (const entry of buttonEntries) {
        entry.highlight.visible = entry.tool === activeTool;
      }
    };
    model.selectedToolProperty.link(selectedToolListener);
    this.disposeEmitter.addListener(() => {
      model.selectedToolProperty.unlink(selectedToolListener);
      // Drop any tooltip still floating in the overlay layer.
      hideTooltip();
    });
  }

  public override dispose(): void {
    // Node.dispose() does not recurse into children, so every descendant
    // Rectangle/Text/GateNode that links to a global QubitSketchColors Property
    // would keep this panel reachable. Dispose the whole child subtree first,
    // then super.dispose() fires disposeEmitter (unlinking the model listener
    // and disposing the drag listeners).
    for (const child of [...this.children]) {
      disposeSubtree(child);
    }
    super.dispose();
  }
}

/**
 * Disposes `node` and all its descendants, leaves-first, so their links to the
 * global QubitSketchColors Properties are removed. Scenery's Node.dispose()
 * does not recurse into children, and every palette button is built from plain
 * Rectangle/Text/Circle/Line/GateNode nodes (no self-disposing composites), so
 * a depth-first dispose is safe here.
 */
function disposeSubtree(node: Node): void {
  for (const child of [...node.children]) {
    disposeSubtree(child);
  }
  if (!node.isDisposed) {
    node.dispose();
  }
}

/** Builds the visual for a tool at the given size, drawn from local (0,0). */
function makeToolNode(tool: SelectedTool, size: number): Node {
  const node = new Node();
  if (tool === "eraser") {
    node.addChild(
      new Rectangle(0, 0, size, size, {
        fill: QubitSketchColors.eraserColorProperty,
        cornerRadius: GATE_CORNER_RADIUS,
      }),
    );
    node.addChild(
      new Text(StringManager.getInstance().getGlyphStrings().removeStringProperty, {
        font: scaledFont(Math.floor(size * 0.44), { bold: true }),
        fill: QubitSketchColors.onGateTextColorProperty,
        centerX: size / 2,
        centerY: size / 2,
      }),
    );
  } else if (tool === "control") {
    node.addChild(
      new Rectangle(0, 0, size, size, {
        fill: QubitSketchColors.slotBackgroundColorProperty,
        stroke: QubitSketchColors.slotBorderColorProperty,
        lineWidth: 1,
        cornerRadius: GATE_CORNER_RADIUS,
      }),
    );
    node.addChild(
      new Circle(8, { fill: QubitSketchColors.controlDotColorProperty, centerX: size / 2, centerY: size / 2 }),
    );
  } else if (tool === "antiControl") {
    node.addChild(
      new Rectangle(0, 0, size, size, {
        fill: QubitSketchColors.slotBackgroundColorProperty,
        stroke: QubitSketchColors.slotBorderColorProperty,
        lineWidth: 1,
        cornerRadius: GATE_CORNER_RADIUS,
      }),
    );
    node.addChild(
      new Circle(8, {
        fill: QubitSketchColors.slotBackgroundColorProperty,
        stroke: QubitSketchColors.controlDotColorProperty,
        lineWidth: 2,
        centerX: size / 2,
        centerY: size / 2,
      }),
    );
  } else if (tool === "swap") {
    node.addChild(
      new Rectangle(0, 0, size, size, {
        fill: QubitSketchColors.slotBackgroundColorProperty,
        stroke: QubitSketchColors.slotBorderColorProperty,
        lineWidth: 1,
        cornerRadius: GATE_CORNER_RADIUS,
      }),
    );
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.22;
    const stroke = QubitSketchColors.swapMarkerColorProperty;
    node.addChild(new Line(cx - r, cy - r, cx + r, cy + r, { stroke, lineWidth: 4 }));
    node.addChild(new Line(cx - r, cy + r, cx + r, cy - r, { stroke, lineWidth: 4 }));
  } else if (tool === "Rx" || tool === "Ry" || tool === "Rz") {
    node.addChild(new RotationGateNode(ROTATION_TOOL_AXIS[tool], size));
  } else {
    node.addChild(new GateNode(tool, size));
  }
  return node;
}
