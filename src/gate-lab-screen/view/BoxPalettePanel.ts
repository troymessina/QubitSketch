/**
 * BoxPalettePanel.ts
 *
 * Gate Lab's palette: the book's box vocabulary — NOT (X), PETE (H, i.e. Hadamard),
 * control, swap, eraser (see GATE_LAB_TOOL_VALUES in GateType.ts). Click-to-select
 * only, unlike CircuitScreen's GatePalettePanel — Gate Lab circuits are small and
 * built one box at a time, so a simple select-then-click-the-grid flow fits the
 * book's spirit better than a full drag-and-drop palette.
 */
import type { Vector2 } from "scenerystack/dot";
import { Circle, Line, Node, Rectangle, Text } from "scenerystack/scenery";
import type { Complex2x2 } from "../../circuit-screen/model/GateMatrices.js";
import { GATE_MATRICES } from "../../circuit-screen/model/GateMatrices.js";
import type { SelectedTool } from "../../circuit-screen/model/GateType.js";
import { GATE_LAB_TOOL_VALUES } from "../../circuit-screen/model/GateType.js";
import { GATE_CORNER_RADIUS, GateNode } from "../../circuit-screen/view/GateNode.js";
import { MatrixTooltipNode } from "../../circuit-screen/view/MatrixTooltipNode.js";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { scaledFont } from "../../QubitSketchFonts.js";
import type { GateLabModel } from "../model/GateLabModel.js";

type BoxTool = (typeof GATE_LAB_TOOL_VALUES)[number];

/** Book box glyphs — same map GateLabCanvas uses, so the palette matches the grid. */
const BOX_LABEL_MAP: Partial<Record<BoxTool, string>> = { X: "NOT", H: "PETE" };

/** The 2×2 matrix a palette tool applies, or null for markers (control/swap/eraser). */
function toolMatrix(tool: BoxTool): Complex2x2 | null {
  return tool === "X" || tool === "H" ? GATE_MATRICES[tool] : null;
}

const BUTTON_SIZE = 56;
const BUTTON_GAP = 10;
const PANEL_PADDING = 10;
const HIGHLIGHT_INSET = 3;

type ButtonEntry = { tool: BoxTool; highlight: Rectangle };

export class BoxPalettePanel extends Node {
  /** `overlayLayer`, if given, is where hover tooltips are drawn (kept above everything else). */
  public constructor(model: GateLabModel, overlayLayer?: Node) {
    super();

    const tools = GATE_LAB_TOOL_VALUES;
    const panelHeight = tools.length * (BUTTON_SIZE + BUTTON_GAP) - BUTTON_GAP + PANEL_PADDING * 2;
    const panelWidth = BUTTON_SIZE + PANEL_PADDING * 2;

    const background = new Rectangle(0, 0, panelWidth, panelHeight, {
      fill: QubitSketchColors.panelBackgroundColorProperty,
      stroke: QubitSketchColors.panelBorderColorProperty,
      lineWidth: 1,
      cornerRadius: 8,
    });
    this.addChild(background);

    const buttonEntries: ButtonEntry[] = [];
    const descriptions = StringManager.getInstance().getGateLabStrings().toolDescriptions;

    let activeTooltip: Node | null = null;
    const hideTooltip = (): void => {
      if (activeTooltip !== null && overlayLayer !== undefined) {
        overlayLayer.removeChild(activeTooltip);
        // removeChild does not dispose: the tooltip links to global QubitSketchColors
        // Properties, so dispose it to release those links.
        activeTooltip.dispose();
        activeTooltip = null;
      }
    };
    const showTooltip = (tool: BoxTool, globalPoint: Vector2): void => {
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

    for (const [i, tool] of tools.entries()) {
      const btnX = PANEL_PADDING;
      const btnY = PANEL_PADDING + i * (BUTTON_SIZE + BUTTON_GAP);

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

      // Transparent hit-area on top so clicks always register.
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
      hitArea.addInputListener({
        down: () => {
          model.selectedToolProperty.value = tool;
        },
      });
      this.addChild(hitArea);

      buttonEntries.push({ tool, highlight });
    }

    // Keep highlight in sync with the selected tool.
    const selectedToolListener = (activeTool: SelectedTool): void => {
      for (const entry of buttonEntries) {
        entry.highlight.visible = entry.tool === activeTool;
      }
    };
    model.selectedToolProperty.link(selectedToolListener);
    this.disposeEmitter.addListener(() => {
      model.selectedToolProperty.unlink(selectedToolListener);
      hideTooltip();
    });
  }

  public override dispose(): void {
    // Node.dispose() does not recurse into children, so every descendant Rectangle/Text/GateNode
    // that links to a global QubitSketchColors Property would keep this panel reachable. Dispose
    // the whole child subtree first, then super.dispose() unlinks the model listener.
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

/** Builds the visual for a tool at the given size, drawn from local (0,0). */
function makeToolNode(tool: BoxTool, size: number): Node {
  const node = new Node();
  if (tool === "eraser") {
    node.addChild(
      new Rectangle(0, 0, size, size, {
        fill: QubitSketchColors.eraserColorProperty,
        cornerRadius: GATE_CORNER_RADIUS,
      }),
    );
    node.addChild(
      new Text("✕", {
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
  } else {
    node.addChild(new GateNode(tool, size, BOX_LABEL_MAP[tool]));
  }
  return node;
}
