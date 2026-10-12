/**
 * CircuitScreenView.ts
 *
 * Top-level view for the quantum circuit builder screen.
 *
 * Layout (1024 × 618 virtual coordinate space):
 *   - Gate palette panel — left edge, vertically centered
 *   - Circuit canvas     — center, fills remaining horizontal space
 *   - Qubit count row    — above the circuit (+ / − buttons + count display)
 *   - Reset All button   — bottom-right corner (PhET convention)
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Node, Rectangle, Text } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FlatAppearanceStrategy, RectangularPushButton } from "scenerystack/sun";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/QubitSketchButtonOptions.js";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { SCREEN_VIEW_MARGIN } from "../../QubitSketchConstants.js";
import { FONTS } from "../../QubitSketchFonts.js";
import type { QubitSketchModel } from "../model/QubitSketchModel.js";
import { CIRCUIT_CANVAS_HEIGHT, CIRCUIT_CANVAS_WIDTH, CircuitCanvas } from "./CircuitCanvas.js";
import { CircuitScreenSummaryContent } from "./CircuitScreenSummaryContent.js";
import { ExampleCircuitsComboBox } from "./ExampleCircuitsComboBox.js";
import { GateInspectorNode } from "./GateInspectorNode.js";
import { GatePalettePanel } from "./GatePalettePanel.js";
import { InspectControlNode } from "./InspectControlNode.js";
import { createQasmDialogOpener } from "./QasmDialog.js";
import { QubitCountControl } from "./QubitCountControl.js";
import { SimulationPanel } from "./SimulationPanel.js";
import { attachUndoRedoKeyboardShortcuts } from "./undoRedoKeyboardShortcuts.js";

export type CircuitScreenViewOptions = ScreenViewOptions;

export class CircuitScreenView extends ScreenView {
  public constructor(model: QubitSketchModel, providedOptions?: CircuitScreenViewOptions) {
    const options = optionize<CircuitScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new CircuitScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    // ── Background ────────────────────────────────────────────────────────────
    const background = new Rectangle(0, 0, this.layoutBounds.width, this.layoutBounds.height, {
      fill: QubitSketchColors.backgroundColorProperty,
    });
    this.addChild(background);

    // ── Circuit canvas ────────────────────────────────────────────────────────
    // Created first so the palette can use it as a drag-and-drop drop target.
    const circuitCanvas = new CircuitCanvas(model);

    // Layer that floating drag previews are added to (kept on top of everything).
    const dragLayer = new Node({ pickable: false });
    // Layer for hover tooltips (kept above everything else).
    const tooltipLayer = new Node({ pickable: false });
    // Layer for the Example-circuits dropdown list. Unlike the layers above it must stay
    // interactive (the list items are clickable), so it is not pickable:false.
    const popupLayer = new Node();

    // ── Gate palette (left side) ──────────────────────────────────────────────
    const palette = new GatePalettePanel(model, {
      dragLayer,
      dropTarget: circuitCanvas,
      overlayLayer: tooltipLayer,
    });
    palette.left = SCREEN_VIEW_MARGIN;
    palette.centerY = this.layoutBounds.centerY;
    this.addChild(palette);

    // ── Simulation panel (right side) ─────────────────────────────────────────
    const simulationPanel = new SimulationPanel(model);
    simulationPanel.right = this.layoutBounds.maxX - SCREEN_VIEW_MARGIN;
    simulationPanel.top = SCREEN_VIEW_MARGIN;
    this.addChild(simulationPanel);

    // ── Qubit count control (above circuit) ───────────────────────────────────
    const qubitControlNode = new QubitCountControl(model);

    // Position circuit canvas: centered horizontally between the palette and the panel
    const availableLeft = palette.right + SCREEN_VIEW_MARGIN;
    const availableRight = simulationPanel.left - SCREEN_VIEW_MARGIN;
    const circuitX = availableLeft + (availableRight - availableLeft - CIRCUIT_CANVAS_WIDTH) / 2;
    circuitCanvas.x = circuitX;
    circuitCanvas.y = this.layoutBounds.centerY - CIRCUIT_CANVAS_HEIGHT / 2 + 20;

    qubitControlNode.left = circuitCanvas.x;
    qubitControlNode.bottom = circuitCanvas.y - 12;

    this.addChild(qubitControlNode);
    this.addChild(circuitCanvas);

    // ── Example circuits dropdown (above the qubit-count row) ─────────────────
    const examplesCombo = new ExampleCircuitsComboBox(model, popupLayer);
    examplesCombo.left = circuitCanvas.x;
    examplesCombo.bottom = qubitControlNode.top - 8;
    this.addChild(examplesCombo);

    // ── Undo / redo (next to the qubit-count control) ─────────────────────────
    // Shared styling: a flat (un-gradiented) look, a vivid enabled fill that stands out from
    // the background, and a dark disabled fill so a disabled button stays muted instead of
    // glaring white.
    const buttonAppearance = {
      baseColor: QubitSketchColors.buttonColorProperty,
      disabledColor: QubitSketchColors.buttonDisabledColorProperty,
      buttonAppearanceStrategy: FlatAppearanceStrategy,
    } as const;
    const a11yControls = StringManager.getInstance().getA11yStrings().controls;
    const undoButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text(StringManager.getInstance().getGlyphStrings().undoStringProperty, {
        font: FONTS.toolbarGlyph,
        fill: QubitSketchColors.textColorProperty,
      }),
      listener: () => model.undo(),
      enabledProperty: model.canUndoProperty,
      accessibleName: a11yControls.undoStringProperty,
    });
    const redoButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text(StringManager.getInstance().getGlyphStrings().redoStringProperty, {
        font: FONTS.toolbarGlyph,
        fill: QubitSketchColors.textColorProperty,
      }),
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

    // Keyboard: Ctrl/Cmd+Z = undo, Ctrl+Y or Ctrl/Cmd+Shift+Z = redo. The shortcut
    // lives on the global `window`, so it must be removed when this view is disposed
    // or `window` would retain the listener (and, through it, the model) forever.
    this.disposeEmitter.addListener(attachUndoRedoKeyboardShortcuts(model));

    // ── Rotation-gate angle inspector (below the circuit) ─────────────────────
    const inspector = new GateInspectorNode(model);
    inspector.left = circuitCanvas.x;
    inspector.top = circuitCanvas.y + CIRCUIT_CANVAS_HEIGHT + 16;
    this.addChild(inspector);

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

    // ── OpenQASM export/import (bottom-right, left of Reset All) ───────────────
    const openQasmDialog = createQasmDialogOpener(model);
    const qasmButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text(StringManager.getInstance().getQasmStrings().buttonStringProperty, {
        font: FONTS.panelTitle,
        fill: QubitSketchColors.textColorProperty,
      }),
      listener: openQasmDialog,
      accessibleName: a11yControls.openQasmStringProperty,
    });
    qasmButton.right = resetAllButton.left - 16;
    qasmButton.centerY = resetAllButton.centerY;
    this.addChild(qasmButton);

    // Drag previews, tooltips, and the dropdown list float above all other content.
    this.addChild(dragLayer);
    this.addChild(tooltipLayer);
    this.addChild(popupLayer);

    // ── Accessibility: keyboard / reading traversal order ───────────────────────
    // Deterministic Tab/reading order: tools, qubit count, the circuit grid,
    // examples, undo/redo, inspect controls, export, and Reset All last.
    // ScreenView throws if you set pdomOrder on itself, so use a wrapper Node.
    this.addChild(
      new Node({
        pdomOrder: [
          palette,
          qubitControlNode,
          circuitCanvas,
          examplesCombo,
          undoButton,
          redoButton,
          inspectControl,
          inspector,
          qasmButton,
          resetAllButton,
        ],
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
