/**
 * GateNode.ts
 *
 * Visual representation of a single quantum gate — a colored rounded rectangle
 * with a bold label. Used in both the palette and the circuit grid.
 */
import { Node, Rectangle, Text } from "scenerystack/scenery";
import QubitSketchColors from "../../QubitSketchColors.js";
import { scaledFont } from "../../QubitSketchFonts.js";
import type { GateType, RotationAxis } from "../model/GateType.js";

// Map gate type to its color property
const GATE_COLOR_MAP = {
  H: QubitSketchColors.hGateColorProperty,
  X: QubitSketchColors.xGateColorProperty,
  Y: QubitSketchColors.yGateColorProperty,
  Z: QubitSketchColors.zGateColorProperty,
  S: QubitSketchColors.sGateColorProperty,
  T: QubitSketchColors.tGateColorProperty,
  Sdg: QubitSketchColors.sdgGateColorProperty,
  Tdg: QubitSketchColors.tdgGateColorProperty,
  Vx: QubitSketchColors.vxGateColorProperty,
} as const satisfies Record<GateType, unknown>;

/**
 * The glyph drawn on each gate, decoupled from the (ASCII, serialization-friendly) GateType key
 * so adjoint/root gates can show "S†", "T†", "√X" while keeping plain keys.
 */
const GATE_LABEL_MAP = {
  H: "H",
  X: "X",
  Y: "Y",
  Z: "Z",
  S: "S",
  T: "T",
  Sdg: "S†",
  Tdg: "T†",
  Vx: "√X",
} as const satisfies Record<GateType, string>;

/** Corner radius of a gate's colored box (shared by fixed and rotation gates). */
export const GATE_CORNER_RADIUS = 6;

// Glyph size as a fraction of the box, so labels scale with the gate box.
const SINGLE_CHAR_LABEL_SCALE = 0.44; // "H", "X", … fill more of the box
const MULTI_CHAR_LABEL_SCALE = 0.3; // "S†", "√X", … must fit a wider glyph

/** Bold monospace font sized to fit a 1- or multi-character glyph inside the gate box. */
function labelFont(label: string, size: number): string {
  const scale = label.length <= 1 ? SINGLE_CHAR_LABEL_SCALE : MULTI_CHAR_LABEL_SCALE;
  return scaledFont(Math.floor(size * scale), { bold: true, mono: true });
}

export class GateNode extends Node {
  private readonly background: Rectangle;
  private readonly label: Text;
  private readonly size: number;

  /**
   * `labelOverride` swaps the glyph without changing the gate's identity or color — e.g.
   * GateLabScreen draws the same X/H boxes as CircuitScreen but labeled "NOT"/"PETE" to match
   * the book. Defaults to the standard glyph ({@link GATE_LABEL_MAP}).
   */
  public constructor(gateType: GateType, size: number, labelOverride?: string) {
    super();
    this.size = size;

    this.background = new Rectangle(0, 0, size, size, {
      fill: GATE_COLOR_MAP[gateType],
      cornerRadius: GATE_CORNER_RADIUS,
    });

    const text = labelOverride ?? GATE_LABEL_MAP[gateType];
    this.label = new Text(text, {
      font: labelFont(text, size),
      fill: QubitSketchColors.onGateTextColorProperty,
      centerX: size / 2,
      centerY: size / 2,
    });

    this.addChild(this.background);
    this.addChild(this.label);
  }

  public updateGateType(gateType: GateType, labelOverride?: string): void {
    const text = labelOverride ?? GATE_LABEL_MAP[gateType];
    this.background.fill = GATE_COLOR_MAP[gateType];
    this.label.string = text;
    this.label.font = labelFont(text, this.size);
    this.label.centerX = this.size / 2;
    this.label.centerY = this.size / 2;
  }
}

const ROTATION_COLOR_MAP = {
  X: QubitSketchColors.rxGateColorProperty,
  Y: QubitSketchColors.ryGateColorProperty,
  Z: QubitSketchColors.rzGateColorProperty,
} as const satisfies Record<RotationAxis, unknown>;

/** Label drawn on a parametrized rotation gate, e.g. axis "X" → "Rx". */
export function rotationLabel(axis: RotationAxis): string {
  return `R${axis.toLowerCase()}`;
}

// Rotation-gate glyph metrics, as fractions of the box size. The axis label ("Rx") sits
// higher to make room for the angle readout ("90°") below it when an angle is shown.
const ROTATION_LABEL_SCALE = 0.34; // font size of the "Rx" axis label
const ROTATION_LABEL_CENTER_Y_WITH_ANGLE = 0.36; // axis label vertical center when the angle shows
const ROTATION_ANGLE_SCALE = 0.24; // font size of the "90°" angle readout
const ROTATION_ANGLE_CENTER_Y = 0.7; // angle readout vertical center
const HALF_TURN_DEGREES = 180;

/**
 * Visual for a parametrized rotation gate: a colored box with the axis label ("Rx"/"Ry"/"Rz")
 * and, optionally, the current angle in degrees below it.
 */
export class RotationGateNode extends Node {
  public constructor(axis: RotationAxis, size: number, theta?: number) {
    super();

    this.addChild(
      new Rectangle(0, 0, size, size, {
        fill: ROTATION_COLOR_MAP[axis],
        cornerRadius: GATE_CORNER_RADIUS,
      }),
    );

    const showAngle = theta !== undefined;
    this.addChild(
      new Text(rotationLabel(axis), {
        font: scaledFont(Math.floor(size * ROTATION_LABEL_SCALE), { bold: true, mono: true }),
        fill: QubitSketchColors.onGateTextColorProperty,
        centerX: size / 2,
        centerY: showAngle ? size * ROTATION_LABEL_CENTER_Y_WITH_ANGLE : size / 2,
      }),
    );

    if (showAngle) {
      const deg = Math.round((theta * HALF_TURN_DEGREES) / Math.PI);
      this.addChild(
        new Text(`${deg}°`, {
          font: scaledFont(Math.floor(size * ROTATION_ANGLE_SCALE)),
          fill: QubitSketchColors.onGateTextColorProperty,
          centerX: size / 2,
          centerY: size * ROTATION_ANGLE_CENTER_Y,
        }),
      );
    }
  }
}
