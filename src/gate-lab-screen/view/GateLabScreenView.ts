/**
 * GateLabScreenView.ts
 *
 * Top-level view for the Gate Lab screen — Terry Rudolph's *Q is for Quantum*
 * ball-and-box picture (see doc/model.md). Structurally mirrors
 * CircuitScreenView.ts, minus the pieces Gate Lab doesn't need (no rotation-angle
 * inspector, no example-circuits dropdown, no QASM dialog — see the plan's
 * non-goals in CLAUDE.md).
 *
 * Layout (1024 × 618 virtual coordinate space):
 *   - Box palette panel — left edge, vertically centered
 *   - Gate Lab canvas    — center (balls + box grid), fills remaining horizontal space
 *   - Mist panel         — right edge, top-aligned
 *   - Qubit count row    — above the canvas (+ / − buttons + ball count display)
 *   - Reset All button   — bottom-right corner (PhET convention)
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Node, Rectangle, Text, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FlatAppearanceStrategy, RectangularPushButton } from "scenerystack/sun";
import { InspectControlNode } from "../../circuit-screen/view/InspectControlNode.js";
import { QubitCountControl } from "../../circuit-screen/view/QubitCountControl.js";
import { attachUndoRedoKeyboardShortcuts } from "../../circuit-screen/view/undoRedoKeyboardShortcuts.js";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/QubitSketchButtonOptions.js";
import { QubitSketchPanel } from "../../common/QubitSketchPanel.js";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { SCREEN_VIEW_MARGIN } from "../../QubitSketchConstants.js";
import { FONTS } from "../../QubitSketchFonts.js";
import type { GateLabModel } from "../model/GateLabModel.js";
import { BoxPalettePanel } from "./BoxPalettePanel.js";
import { GATE_LAB_CANVAS_HEIGHT, GATE_LAB_CANVAS_WIDTH, GateLabCanvas } from "./GateLabCanvas.js";
import { GateLabScreenSummaryContent } from "./GateLabScreenSummaryContent.js";
import { MistCloudNode } from "./MistCloudNode.js";

export type GateLabScreenViewOptions = ScreenViewOptions;

const MIST_PANEL_CONTENT_WIDTH = 260;
const MIST_BOX_HEIGHT = 200;

export class GateLabScreenView extends ScreenView {
  public constructor(model: GateLabModel, providedOptions?: GateLabScreenViewOptions) {
    const options = optionize<GateLabScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new GateLabScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    const strings = StringManager.getInstance();
    const a11yControls = strings.getA11yStrings().controls;

    // ── Background ────────────────────────────────────────────────────────────
    const background = new Rectangle(0, 0, this.layoutBounds.width, this.layoutBounds.height, {
      fill: QubitSketchColors.backgroundColorProperty,
    });
    this.addChild(background);

    // Layer for hover tooltips (kept above everything else).
    const tooltipLayer = new Node({ pickable: false });

    // ── Box palette (left side) ───────────────────────────────────────────────
    const palette = new BoxPalettePanel(model, tooltipLayer);
    palette.left = SCREEN_VIEW_MARGIN;
    palette.centerY = this.layoutBounds.centerY;
    this.addChild(palette);

    // ── Mist panel (right side) ───────────────────────────────────────────────
    const mistStrings = strings.getGateLabStrings().mist;
    const mistPanel = new QubitSketchPanel(
      new VBox({
        align: "left",
        spacing: 4,
        children: [
          new Text(mistStrings.titleStringProperty, {
            font: FONTS.panelTitle,
            fill: QubitSketchColors.textColorProperty,
          }),
          new MistCloudNode(
            model.stateVectorProperty,
            model.probabilitiesProperty,
            model.qubitCountProperty,
            MIST_PANEL_CONTENT_WIDTH,
            MIST_BOX_HEIGHT,
          ),
        ],
      }),
    );
    mistPanel.right = this.layoutBounds.maxX - SCREEN_VIEW_MARGIN;
    mistPanel.top = SCREEN_VIEW_MARGIN;
    this.addChild(mistPanel);

    // ── Gate Lab canvas (balls + box grid) ────────────────────────────────────
    const canvas = new GateLabCanvas(model);

    const qubitControlNode = new QubitCountControl(model);

    const availableLeft = palette.right + SCREEN_VIEW_MARGIN;
    const availableRight = mistPanel.left - SCREEN_VIEW_MARGIN;
    const canvasX = availableLeft + (availableRight - availableLeft - GATE_LAB_CANVAS_WIDTH) / 2;
    canvas.x = canvasX;
    canvas.y = this.layoutBounds.centerY - GATE_LAB_CANVAS_HEIGHT / 2;

    qubitControlNode.left = canvas.x;
    qubitControlNode.bottom = canvas.y - 12;

    this.addChild(qubitControlNode);
    this.addChild(canvas);

    // ── Undo / redo (next to the qubit-count control) ─────────────────────────
    const buttonAppearance = {
      baseColor: QubitSketchColors.buttonColorProperty,
      disabledColor: QubitSketchColors.buttonDisabledColorProperty,
      buttonAppearanceStrategy: FlatAppearanceStrategy,
    } as const;
    const undoButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text("↶", { font: FONTS.toolbarGlyph, fill: QubitSketchColors.textColorProperty }),
      listener: () => model.undo(),
      enabledProperty: model.canUndoProperty,
      accessibleName: a11yControls.undoStringProperty,
    });
    const redoButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text("↷", { font: FONTS.toolbarGlyph, fill: QubitSketchColors.textColorProperty }),
      listener: () => model.redo(),
      enabledProperty: model.canRedoProperty,
      accessibleName: a11yControls.redoStringProperty,
    });
    undoButton.left = qubitControlNode.right + 24;
    undoButton.centerY = qubitControlNode.centerY;
    redoButton.left = undoButton.right + 6;
    redoButton.centerY = qubitControlNode.centerY;
    this.addChild(undoButton);
    this.addChild(redoButton);

    // ── Step-through inspect transport (right of undo/redo) ───────────────────
    const inspectControl = new InspectControlNode(model);
    inspectControl.left = redoButton.right + 24;
    inspectControl.centerY = qubitControlNode.centerY;
    this.addChild(inspectControl);

    // Keyboard: Ctrl/Cmd+Z = undo, Ctrl+Y or Ctrl/Cmd+Shift+Z = redo (see the note in
    // undoRedoKeyboardShortcuts.ts on why the disposer must be registered).
    this.disposeEmitter.addListener(attachUndoRedoKeyboardShortcuts(model));

    // ── Reset All button ──────────────────────────────────────────────────────
    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        model.reset();
        this.reset();
      },
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
      accessibleName: a11yControls.resetAllStringProperty,
    });
    this.addChild(resetAllButton);

    // Tooltips float above all other content.
    this.addChild(tooltipLayer);

    // ── Accessibility: keyboard / reading traversal order ───────────────────────
    // ScreenView throws if you set pdomOrder on itself, so use a wrapper Node.
    this.addChild(
      new Node({
        pdomOrder: [palette, qubitControlNode, canvas, undoButton, redoButton, inspectControl, resetAllButton],
      }),
    );
  }

  public reset(): void {
    // All view state is driven by model Property links, so model.reset() suffices.
  }

  public override step(_dt: number): void {
    // No per-frame animation.
  }
}
