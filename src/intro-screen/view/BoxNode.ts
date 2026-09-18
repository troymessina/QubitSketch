/**
 * BoxNode.ts
 *
 * The Intro screen's literal box visual — a bigger, more physical rendering than
 * `GateNode` (which stays as-is for the grid screens): a rounded rectangle with a
 * top highlight / bottom shadow band (a simple bevel suggesting the VPython demo's
 * extruded 3D box, without leaving this sim's 2D/no-WebGL architecture) plus three
 * small "feet" circles (echoing its cylinders) and a label.
 */
import { Circle, Node, Rectangle, Text } from "scenerystack/scenery";
import QubitSketchColors from "../../QubitSketchColors.js";
import { scaledFont } from "../../QubitSketchFonts.js";
import type { IntroBoxType } from "../model/IntroModel.js";

/** Book box glyphs — same labels Gate Lab uses, for the two boxes this screen exposes. */
const BOX_LABEL: Record<IntroBoxType, string> = { X: "NOT", H: "PETE" };

/** Box fill color, matching Gate Lab's box colors for visual continuity across screens. */
const BOX_COLOR = {
  X: QubitSketchColors.xGateColorProperty,
  H: QubitSketchColors.hGateColorProperty,
} as const satisfies Record<IntroBoxType, unknown>;

const CORNER_RADIUS = 10;
const FOOT_RADIUS = 5;
const BEVEL_INSET = 2;

export class BoxNode extends Node {
  public constructor(type: IntroBoxType, width: number, height: number) {
    super();

    this.addChild(
      new Rectangle(0, 0, width, height, {
        fill: BOX_COLOR[type],
        cornerRadius: CORNER_RADIUS,
      }),
    );
    // A simple bevel — a light band along the top, a dark band along the bottom — stands in
    // for the VPython extrusion's lit-from-above 3D look.
    this.addChild(
      new Rectangle(BEVEL_INSET, BEVEL_INSET, width - BEVEL_INSET * 2, height * 0.32, {
        fill: "white",
        opacity: 0.15,
        cornerRadius: CORNER_RADIUS * 0.7,
      }),
    );
    this.addChild(
      new Rectangle(BEVEL_INSET, height * 0.72, width - BEVEL_INSET * 2, height * 0.28 - BEVEL_INSET, {
        fill: "black",
        opacity: 0.15,
        cornerRadius: CORNER_RADIUS * 0.7,
      }),
    );

    // "Feet" — three small circles echoing the VPython cylinders (top-center, bottom corners),
    // in a darker shade so they read as separate physical supports rather than decoration.
    const footColor = QubitSketchColors.panelBorderColorProperty;
    this.addChild(new Circle(FOOT_RADIUS, { centerX: width / 2, centerY: 0, fill: footColor }));
    this.addChild(new Circle(FOOT_RADIUS, { centerX: FOOT_RADIUS * 2, centerY: height, fill: footColor }));
    this.addChild(new Circle(FOOT_RADIUS, { centerX: width - FOOT_RADIUS * 2, centerY: height, fill: footColor }));

    this.addChild(
      new Text(BOX_LABEL[type], {
        font: scaledFont(Math.floor(height * 0.36), { bold: true, mono: true }),
        fill: QubitSketchColors.onGateTextColorProperty,
        centerX: width / 2,
        centerY: height / 2,
      }),
    );
  }
}
