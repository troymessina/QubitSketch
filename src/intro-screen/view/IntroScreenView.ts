/**
 * IntroScreenView.ts
 *
 * Top-level view for the Intro screen — the most literal rendering of *Q is for
 * Quantum* in this sim: one ball, a drag-and-droppable stack of boxes, watched
 * falling through in real time (see doc/model.md's "Intro model" section). No
 * qubit-count control or inspect transport (single-qubit, one-shot animation
 * instead) — a "▶ Drop" button starts the fall.
 *
 * Layout (1024 × 618 virtual coordinate space):
 *   - Box palette panel — left edge, vertically centered
 *   - Ball-drop canvas   — center (the box stack + animated ball)
 *   - Mist panel         — right edge, top-aligned
 *   - Drop / Undo / Redo — above the canvas
 *   - Reset All button   — bottom-right corner (PhET convention)
 */
import { DerivedProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Node, Rectangle, Text, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FlatAppearanceStrategy, RectangularPushButton } from "scenerystack/sun";
import { attachUndoRedoKeyboardShortcuts } from "../../circuit-screen/view/undoRedoKeyboardShortcuts.js";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/QubitSketchButtonOptions.js";
import { QubitSketchPanel } from "../../common/QubitSketchPanel.js";
import { MistCloudNode } from "../../gate-lab-screen/view/MistCloudNode.js";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { SCREEN_VIEW_MARGIN } from "../../QubitSketchConstants.js";
import { FONTS } from "../../QubitSketchFonts.js";
import type { IntroModel } from "../model/IntroModel.js";
import { BALL_DROP_CANVAS_HEIGHT, BALL_DROP_CANVAS_WIDTH, BallDropCanvas } from "./BallDropCanvas.js";
import { IntroPalettePanel } from "./IntroPalettePanel.js";
import { IntroScreenSummaryContent } from "./IntroScreenSummaryContent.js";

export type IntroScreenViewOptions = ScreenViewOptions;

const MIST_PANEL_CONTENT_WIDTH = 260;
const MIST_BOX_HEIGHT = 200;

export class IntroScreenView extends ScreenView {
  public constructor(model: IntroModel, providedOptions?: IntroScreenViewOptions) {
    const options = optionize<IntroScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new IntroScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    const strings = StringManager.getInstance();
    const a11yControls = strings.getA11yStrings().controls;
    const introStrings = strings.getIntroStrings();

    // ── Background ────────────────────────────────────────────────────────────
    const background = new Rectangle(0, 0, this.layoutBounds.width, this.layoutBounds.height, {
      fill: QubitSketchColors.backgroundColorProperty,
    });
    this.addChild(background);

    // Layers dragged boxes float in / tooltips render above.
    const dragLayer = new Node({ pickable: false });
    const tooltipLayer = new Node({ pickable: false });

    // ── Ball-drop canvas (center) — created first so the palette can drop onto it ──
    const canvas = new BallDropCanvas(model);

    // ── Box palette (left side) ───────────────────────────────────────────────
    const palette = new IntroPalettePanel(model, { dragLayer, dropTarget: canvas, overlayLayer: tooltipLayer });
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

    // Position the canvas centered between the palette and the mist panel.
    const availableLeft = palette.right + SCREEN_VIEW_MARGIN;
    const availableRight = mistPanel.left - SCREEN_VIEW_MARGIN;
    canvas.x = availableLeft + (availableRight - availableLeft - BALL_DROP_CANVAS_WIDTH) / 2;
    canvas.y = this.layoutBounds.centerY - BALL_DROP_CANVAS_HEIGHT / 2 + 20;
    this.addChild(canvas);

    // ── Drop / Undo / Redo (above the canvas) ─────────────────────────────────
    const buttonAppearance = {
      baseColor: QubitSketchColors.buttonColorProperty,
      disabledColor: QubitSketchColors.buttonDisabledColorProperty,
      buttonAppearanceStrategy: FlatAppearanceStrategy,
    } as const;
    const dropButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text(introStrings.dropButtonStringProperty, {
        font: FONTS.panelTitle,
        fill: QubitSketchColors.textColorProperty,
      }),
      listener: () => model.startDrop(),
      enabledProperty: new DerivedProperty([model.isDroppingProperty], (isDropping) => !isDropping),
    });
    dropButton.left = canvas.x;
    dropButton.bottom = canvas.y - 12;
    this.addChild(dropButton);

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
    undoButton.left = dropButton.right + 24;
    undoButton.centerY = dropButton.centerY;
    redoButton.left = undoButton.right + 6;
    redoButton.centerY = dropButton.centerY;
    this.addChild(undoButton);
    this.addChild(redoButton);

    // Keyboard: Ctrl/Cmd+Z = undo, Ctrl+Y or Ctrl/Cmd+Shift+Z = redo.
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

    // Drag previews and tooltips float above everything else.
    this.addChild(dragLayer);
    this.addChild(tooltipLayer);

    // ── Accessibility: keyboard / reading traversal order ───────────────────────
    this.addChild(
      new Node({
        pdomOrder: [palette, canvas, dropButton, undoButton, redoButton, resetAllButton],
      }),
    );
  }

  public reset(): void {
    // All view state is driven by model Property links, so model.reset() suffices.
  }

  public override step(_dt: number): void {
    // Animation lives in the model (IntroModel.step, called directly by Sim); the view just
    // reads its Properties each frame via the links set up in the constructor.
  }
}
