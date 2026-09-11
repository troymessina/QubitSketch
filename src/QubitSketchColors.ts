/**
 * QubitSketchColors.ts
 *
 * Defines all dynamic colors for the simulation using ProfileColorProperty.
 * Each color has a "default" (dark) and "projector" (light) profile.
 */
import { ProfileColorProperty } from "scenerystack/scenery";
import QubitSketchNamespace from "./QubitSketchNamespace.js";

const QubitSketchColors = {
  backgroundColorProperty: new ProfileColorProperty(QubitSketchNamespace, "background", {
    default: "#0d1b2a",
    projector: "#ffffff",
  }),

  panelBackgroundColorProperty: new ProfileColorProperty(QubitSketchNamespace, "panelBackground", {
    default: "#0f3460",
    projector: "#f0f0f0",
  }),

  panelBorderColorProperty: new ProfileColorProperty(QubitSketchNamespace, "panelBorder", {
    default: "#1565c0",
    projector: "#aaaaaa",
  }),

  textColorProperty: new ProfileColorProperty(QubitSketchNamespace, "text", {
    default: "#e8eaf6",
    projector: "#1a1a1a",
  }),

  // Toolbar / control buttons (undo, redo, step-through transport, QASM, qubit ±).
  // Deliberately distinct from panelBackground: a panel-colored button is nearly the same
  // hue as the dark background and visually disappears, so the enabled fill is a vivid blue
  // that reads clearly against either theme.
  buttonColorProperty: new ProfileColorProperty(QubitSketchNamespace, "button", {
    default: "#1565c0",
    projector: "#e3f2fd",
  }),

  // Subtle edge for the always-enabled qubit ± boxes (the sun push buttons derive their own
  // stroke from the base color, so they intentionally don't use this).
  buttonStrokeColorProperty: new ProfileColorProperty(QubitSketchNamespace, "buttonStroke", {
    default: "#0e3a6b",
    projector: "#1565c0",
  }),

  // Disabled push-button fill. The sun button code defaults this to a near-white light gray
  // and then brightens it, so in the dark theme a disabled button glares like a white chip.
  // A dark slate keeps disabled buttons muted and recessive instead. (Projector keeps the
  // light-gray behavior, which already reads correctly on a light background.)
  buttonDisabledColorProperty: new ProfileColorProperty(QubitSketchNamespace, "buttonDisabled", {
    default: "#233446",
    projector: "#dcdcdc",
  }),

  // Qubit wire and slot colors
  wireColorProperty: new ProfileColorProperty(QubitSketchNamespace, "wire", {
    default: "#1e88e5",
    projector: "#1565c0",
  }),

  slotBackgroundColorProperty: new ProfileColorProperty(QubitSketchNamespace, "slotBackground", {
    default: "#0a2744",
    projector: "#e8eaf6",
  }),

  slotBorderColorProperty: new ProfileColorProperty(QubitSketchNamespace, "slotBorder", {
    default: "#1565c0",
    projector: "#9e9e9e",
  }),

  slotHoverColorProperty: new ProfileColorProperty(QubitSketchNamespace, "slotHover", {
    default: "#1a3a5c",
    projector: "#d0d8e0",
  }),

  selectedToolHighlightColorProperty: new ProfileColorProperty(QubitSketchNamespace, "selectedToolHighlight", {
    default: "#4fc3f7",
    projector: "#1565c0",
  }),

  // Step-through "inspect" playhead: a vertical line marking how far the circuit has been simulated.
  inspectPlayheadColorProperty: new ProfileColorProperty(QubitSketchNamespace, "inspectPlayhead", {
    default: "#ffca28",
    projector: "#f57f17",
  }),

  // Gate colors — one per gate type
  hGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "hGate", {
    default: "#7c4dff",
    projector: "#6200ea",
  }),

  xGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "xGate", {
    default: "#ef5350",
    projector: "#c62828",
  }),

  yGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "yGate", {
    default: "#ff7043",
    projector: "#bf360c",
  }),

  zGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "zGate", {
    default: "#42a5f5",
    projector: "#1565c0",
  }),

  sGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "sGate", {
    default: "#26c6da",
    projector: "#00838f",
  }),

  tGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "tGate", {
    default: "#ffca28",
    projector: "#f57f17",
  }),

  sdgGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "sdgGate", {
    default: "#00acc1",
    projector: "#006064",
  }),

  tdgGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "tdgGate", {
    default: "#ffb300",
    projector: "#e65100",
  }),

  vxGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "vxGate", {
    default: "#ec407a",
    projector: "#ad1457",
  }),

  // Parametrized rotation gates (Rx, Ry, Rz) — lighter relatives of the Pauli colors
  rxGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "rxGate", {
    default: "#e57373",
    projector: "#b71c1c",
  }),

  ryGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "ryGate", {
    default: "#ffb74d",
    projector: "#e65100",
  }),

  rzGateColorProperty: new ProfileColorProperty(QubitSketchNamespace, "rzGate", {
    default: "#64b5f6",
    projector: "#0d47a1",
  }),

  // Eraser tool / Clear-shots button — kept light enough for onGateText (≥3:1).
  eraserColorProperty: new ProfileColorProperty(QubitSketchNamespace, "eraser", {
    default: "#90a4ae",
    projector: "#78909c",
  }),

  // Labels drawn on gate tiles and Measure/Clear buttons (dark on light fills).
  onGateTextColorProperty: new ProfileColorProperty(QubitSketchNamespace, "onGateText", {
    default: "#1a1a1a",
    projector: "#1a1a1a",
  }),

  // Control dot (•) and the vertical connector line linking it to its target
  controlDotColorProperty: new ProfileColorProperty(QubitSketchNamespace, "controlDot", {
    default: "#e8eaf6",
    projector: "#1a1a1a",
  }),

  // SWAP endpoint (✕) markers and the line connecting them
  swapMarkerColorProperty: new ProfileColorProperty(QubitSketchNamespace, "swapMarker", {
    default: "#26a69a",
    projector: "#00695c",
  }),

  // Simulation displays
  probabilityBarColorProperty: new ProfileColorProperty(QubitSketchNamespace, "probabilityBar", {
    default: "#4fc3f7",
    projector: "#1565c0",
  }),

  histogramBarColorProperty: new ProfileColorProperty(QubitSketchNamespace, "histogramBar", {
    default: "#66bb6a",
    projector: "#2e7d32",
  }),

  blochArrowColorProperty: new ProfileColorProperty(QubitSketchNamespace, "blochArrow", {
    default: "#ffca28",
    projector: "#f57f17",
  }),

  blochSphereOutlineColorProperty: new ProfileColorProperty(QubitSketchNamespace, "blochSphereOutline", {
    default: "#1e88e5",
    projector: "#9e9e9e",
  }),

  // Translucent shaded body of the 3D Bloch sphere (main fill + specular highlight)
  blochSphereFillColorProperty: new ProfileColorProperty(QubitSketchNamespace, "blochSphereFill", {
    default: "#1e88e5",
    projector: "#90caf9",
  }),

  blochSphereHighlightColorProperty: new ProfileColorProperty(QubitSketchNamespace, "blochSphereHighlight", {
    default: "#bbdefb",
    projector: "#ffffff",
  }),

  // ── Light control surfaces ───────────────────────────────────────────────────
  // White chrome (combo boxes, flat push buttons, editable input fields) stays light
  // in both profiles; its text stays dark. Same values in default and projector mode,
  // but defined here so every color lives in one themeable place.

  /** Fill of light control surfaces: combo-box button/list, editable input fields. */
  controlSurfaceColorProperty: new ProfileColorProperty(QubitSketchNamespace, "controlSurface", {
    default: "#ffffff",
    projector: "#ffffff",
  }),

  /** Fill of a disabled control surface (grayed-out editable input field). */
  controlSurfaceDisabledColorProperty: new ProfileColorProperty(QubitSketchNamespace, "controlSurfaceDisabled", {
    default: "#cccccc",
    projector: "#cccccc",
  }),

  /** Text on light control surfaces: combo items, flat-button labels, field values, preferences. */
  controlSurfaceTextColorProperty: new ProfileColorProperty(QubitSketchNamespace, "controlSurfaceText", {
    default: "#1a1a1a",
    projector: "#1a1a1a",
  }),

  // ── GateLabScreen ("Q is for Quantum" companion) ────────────────────────────
  // Black/white ball glyphs (the book's qubits) and the "mist" superposition cloud.

  ballBlackColorProperty: new ProfileColorProperty(QubitSketchNamespace, "ballBlack", {
    default: "#1a1a1a",
    projector: "#1a1a1a",
  }),

  ballWhiteColorProperty: new ProfileColorProperty(QubitSketchNamespace, "ballWhite", {
    default: "#f5f5f5",
    projector: "#f5f5f5",
  }),

  /** Outline on every ball glyph, so a white ball reads clearly against either background. */
  ballStrokeColorProperty: new ProfileColorProperty(QubitSketchNamespace, "ballStroke", {
    default: "#9e9e9e",
    projector: "#757575",
  }),

  mistCloudColorProperty: new ProfileColorProperty(QubitSketchNamespace, "mistCloud", {
    default: "#1a3a5c",
    projector: "#e8eaf6",
  }),

  mistCloudBorderColorProperty: new ProfileColorProperty(QubitSketchNamespace, "mistCloudBorder", {
    default: "#4fc3f7",
    projector: "#1565c0",
  }),
};

export default QubitSketchColors;
