/**
 * BallDropCanvas.ts
 *
 * Renders the Intro screen's vertical box stack and the animated ball. Structurally
 * plays the same role as GateLabCanvas.ts / CircuitCanvas.ts (build static structure
 * once, then update on Property changes) but for an ordered, variable-length stack
 * instead of a fixed grid.
 *
 * Layout: a fixed-height track reserving room for MAX_INTRO_BOXES boxes (same "always
 * show every slot" convention CircuitCanvas uses for its rows) — always-visible
 * empty-slot outlines below the current stack, a BoxNode over each filled one. The
 * ball's appearance (solid vs. "misty" double-ball) comes from
 * MistState.computeMistRows on model.displayStateProperty; its position is driven
 * every frame by fallProgress.
 */
import type { Complex, Vector2 } from "scenerystack/dot";
import { Circle, Node, Rectangle } from "scenerystack/scenery";
import { computeMistRows } from "../../gate-lab-screen/model/MistState.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import type { IntroBoxType, IntroModel } from "../model/IntroModel.js";
import { MAX_INTRO_BOXES } from "../model/IntroModel.js";
import { BoxNode } from "./BoxNode.js";

export const BOX_WIDTH = 160;
export const BOX_HEIGHT = 56;
const GAP = 14;
const STEP_PITCH = BOX_HEIGHT + GAP;
const TOP_MARGIN = 55;
const BOTTOM_MARGIN = 55;
const BALL_RADIUS = 15;
const BALL_HOVER_GAP = 20;
const SIDE_PAD = 24;

export const BALL_DROP_CANVAS_WIDTH = BOX_WIDTH + SIDE_PAD * 2;
export const BALL_DROP_CANVAS_HEIGHT = TOP_MARGIN + MAX_INTRO_BOXES * STEP_PITCH - GAP + BOTTOM_MARGIN;

const trackX = SIDE_PAD + BOX_WIDTH / 2;
const slotY = (index: number): number => TOP_MARGIN + index * STEP_PITCH;
/** The ball's y-position for a given (possibly fractional) fall progress. */
const ballY = (fallProgress: number): number => TOP_MARGIN - BALL_HOVER_GAP + fallProgress * STEP_PITCH;

/** Where dragged boxes land. Supplied by IntroScreenView. */
export interface StackDropTarget {
  /** The stack index a global drop point corresponds to, or null if outside the track. */
  insertionIndexAt(globalPoint: Vector2): number | null;
}

export class BallDropCanvas extends Node implements StackDropTarget {
  private readonly slotOutlines: Rectangle[] = [];
  private readonly boxLayer: Node;
  private readonly boxNodes: Array<Node | null> = [];
  private readonly hitAreas: Array<Node | null> = [];
  private renderedBoxes: readonly IntroBoxType[] = [];
  private readonly ballPositionNode: Node;
  private readonly ballLookNode: Node;

  public constructor(model: IntroModel) {
    super();

    // Vertical track/wire, spanning the whole reserved height.
    this.addChild(
      new Rectangle(trackX - 1, 0, 2, BALL_DROP_CANVAS_HEIGHT, {
        fill: QubitSketchColors.wireColorProperty,
        pickable: false,
      }),
    );

    // Always-visible empty-slot outlines (one per MAX_INTRO_BOXES position) — same "every slot is
    // always drawn" convention as CircuitCanvas, so drop/click targets are visible in advance.
    for (let i = 0; i < MAX_INTRO_BOXES; i++) {
      this.boxNodes.push(null);
      this.hitAreas.push(null);
      const outline = new Rectangle(SIDE_PAD, slotY(i), BOX_WIDTH, BOX_HEIGHT, {
        fill: QubitSketchColors.slotBackgroundColorProperty,
        stroke: QubitSketchColors.slotBorderColorProperty,
        lineDash: [6, 4],
        lineWidth: 1,
        cornerRadius: 10,
        cursor: "pointer",
      });
      const slotIndex = i;
      outline.addInputListener({
        over: () => {
          if (slotIndex <= model.boxesProperty.value.length) {
            outline.fill = QubitSketchColors.slotHoverColorProperty;
          }
        },
        out: () => {
          outline.fill = QubitSketchColors.slotBackgroundColorProperty;
        },
        down: () => {
          if (!model.isDroppingProperty.value) {
            model.insertBox(slotIndex, model.selectedToolProperty.value);
          }
        },
      });
      this.addChild(outline);
      this.slotOutlines.push(outline);
    }

    this.boxLayer = new Node();
    this.addChild(this.boxLayer);

    // The ball: a fixed-position wrapper (moved every frame) containing the look (rebuilt only
    // when the displayed state changes), so per-frame motion never rebuilds the ball's shapes.
    // The look itself is pickable:false (it's rebuilt from scratch on every state change, so it
    // is not a stable click target); a dedicated, always-present hit-area circle carries the
    // click handler instead — the same "invisible pickable shape" pattern used for every other
    // click target in this sim (e.g. GateLabCanvas's ball, GatePalettePanel's hit rectangles).
    this.ballLookNode = new Node({ pickable: false });
    const ballHitArea = new Circle(BALL_RADIUS + 6, { fill: "rgba(0,0,0,0)", cursor: "pointer" });
    ballHitArea.addInputListener({ down: () => model.toggleInputBall() });
    this.ballPositionNode = new Node({ children: [this.ballLookNode, ballHitArea], x: trackX });
    this.addChild(this.ballPositionNode);

    model.boxesProperty.link((boxes) => this.updateBoxes(boxes, model));
    model.displayStateProperty.link((state) => {
      this.ballLookNode.removeAllChildren();
      for (const child of buildBallLook(state)) {
        this.ballLookNode.addChild(child);
      }
    });
    model.fallProgressProperty.link((fallProgress) => {
      this.ballPositionNode.y = ballY(fallProgress);
    });
  }

  private updateBoxes(boxes: readonly IntroBoxType[], model: IntroModel): void {
    // Toggle empty-slot outline visibility: hidden behind a placed box, dashed beyond the stack.
    for (let i = 0; i < MAX_INTRO_BOXES; i++) {
      const outline = this.slotOutlines[i];
      if (outline !== undefined) {
        outline.visible = i >= boxes.length;
      }
    }

    for (let i = 0; i < MAX_INTRO_BOXES; i++) {
      const box = boxes[i];
      const prev = this.renderedBoxes[i];
      if (box === prev) {
        continue;
      }
      const oldNode = this.boxNodes[i];
      if (oldNode !== null && oldNode !== undefined) {
        this.boxLayer.removeChild(oldNode);
      }
      const oldHit = this.hitAreas[i];
      if (oldHit !== null && oldHit !== undefined) {
        this.boxLayer.removeChild(oldHit);
      }
      if (box === undefined) {
        this.boxNodes[i] = null;
        this.hitAreas[i] = null;
        continue;
      }
      const boxNode = new BoxNode(box, BOX_WIDTH, BOX_HEIGHT);
      boxNode.x = SIDE_PAD;
      boxNode.y = slotY(i);
      boxNode.pickable = false;
      this.boxLayer.addChild(boxNode);
      this.boxNodes[i] = boxNode;

      // Clicking a placed box removes it — no separate eraser tool needed for a 2-box palette.
      const hitArea = new Rectangle(SIDE_PAD, slotY(i), BOX_WIDTH, BOX_HEIGHT, {
        fill: "rgba(0,0,0,0)",
        cursor: "pointer",
      });
      const boxIndex = i;
      hitArea.addInputListener({ down: () => model.removeBox(boxIndex) });
      this.boxLayer.addChild(hitArea);
      this.hitAreas[i] = hitArea;
    }
    this.renderedBoxes = boxes;
  }

  /** The stack index a global drop point corresponds to (clamped by IntroModel.insertBox itself). */
  public insertionIndexAt(globalPoint: Vector2): number | null {
    const local = this.globalToLocalPoint(globalPoint);
    if (local.x < 0 || local.x > BALL_DROP_CANVAS_WIDTH || local.y < 0 || local.y > BALL_DROP_CANVAS_HEIGHT) {
      return null;
    }
    return Math.max(0, Math.round((local.y - TOP_MARGIN) / STEP_PITCH));
  }
}

/** Builds the ball's current look: one solid circle when definite, an overlapping faded
 * black+white pair when the displayed state is a genuine (2-row) superposition. */
function buildBallLook(state: readonly Complex[]): Node[] {
  const rows = computeMistRows(state);
  if (rows.length === 1) {
    const row = rows[0];
    const bit = row?.bits === 1 ? 1 : 0;
    return [
      new Circle(BALL_RADIUS, {
        fill: bit === 1 ? QubitSketchColors.ballBlackColorProperty : QubitSketchColors.ballWhiteColorProperty,
        stroke: QubitSketchColors.ballStrokeColorProperty,
        lineWidth: 1.5,
      }),
    ];
  }
  const offset = BALL_RADIUS * 0.4;
  return [
    new Circle(BALL_RADIUS, {
      x: -offset,
      fill: QubitSketchColors.ballWhiteColorProperty,
      stroke: QubitSketchColors.ballStrokeColorProperty,
      lineWidth: 1.5,
      opacity: 0.65,
    }),
    new Circle(BALL_RADIUS, {
      x: offset,
      fill: QubitSketchColors.ballBlackColorProperty,
      stroke: QubitSketchColors.ballStrokeColorProperty,
      lineWidth: 1.5,
      opacity: 0.65,
    }),
  ];
}
