/**
 * QubitSketchConstants.ts
 *
 * Sim-wide layout constants (pixels). Physical/model parameters do not belong
 * here — QubitSketch's model is discrete (circuit cells), so this file holds
 * only view spacing, sizes, and corner radii.
 */
import QubitSketchNamespace from "./QubitSketchNamespace.js";

/** Corner radius shared by control panels and dialogs (px). */
export const PANEL_CORNER_RADIUS = 5;

/** Margin between the ScreenView edges and the top-level panels (px). */
export const SCREEN_VIEW_MARGIN = 20;

/** Qubit-count control (the −/＋ stepper above the circuit). All values in px. */
export const QUBIT_COUNT_CONTROL = {
  BUTTON_SIZE: 28, // width/height of the −/＋ buttons (px)
  BUTTON_RADIUS: 4, // corner radius of the buttons and readout (px)
  READOUT_WIDTH: 80, // width of the "N qubits" readout box (px)
  READOUT_HEIGHT: 28, // height of the readout box (px)
  SPACING: 6, // gap between button, readout, and button (px)
} as const;

QubitSketchNamespace.register("QubitSketchConstants", {
  PANEL_CORNER_RADIUS,
  SCREEN_VIEW_MARGIN,
  QUBIT_COUNT_CONTROL,
});
