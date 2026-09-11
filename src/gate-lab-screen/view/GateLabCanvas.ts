/**
 * GateLabCanvas.ts
 *
 * Renders the Gate Lab grid — the book's ball-and-box picture. Each wire starts with a
 * clickable ball (black = |1⟩, white = |0⟩; the book's "drop a black or white ball in
 * the top") instead of a plain qubit label, followed by a row of clickable box slots.
 * Adapted from CircuitScreen's CircuitCanvas.ts, restricted to GATE_LAB_MAX_QUBITS rows
 * and Gate Lab's smaller tool set (no rotation gates, so no angle-inspector selection
 * ring is needed here).
 *
 * Cell kinds are rendered as:
 *   gate / controlledTarget — a colored GateNode, labeled with the book's box names
 *                             ("NOT" for X, "PETE" for H — see BOX_LABEL_MAP)
 *   control                 — a filled control dot (•) with a vertical connector
 *                             line to the gate/swap target(s) in the same column
 *   swap                    — a ✕ marker (plain SWAP, or CSWAP/Fredkin when paired
 *                             with a control)
 */
import { Circle, Line, Node, Rectangle } from "scenerystack/scenery";
import type { Grid } from "../../circuit-screen/model/CircuitGrid.js";
import { cellAt, classifyColumn, columnHasControl } from "../../circuit-screen/model/CircuitGrid.js";
import type { CircuitCell, GateType } from "../../circuit-screen/model/GateType.js";
import { cellGate, cellsEqual, GATE_LAB_MAX_QUBITS, NUM_STEPS } from "../../circuit-screen/model/GateType.js";
import { GateNode } from "../../circuit-screen/view/GateNode.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import type { GateLabModel } from "../model/GateLabModel.js";

/** Book box glyphs, distinct from CircuitScreen's plain gate letters (see GateNode's labelOverride). */
const BOX_LABEL_MAP: Partial<Record<GateType, string>> = { X: "NOT", H: "PETE" };

const BALL_COLUMN_WIDTH = 56;
const SLOT_SIZE = 56;
const SLOT_GAP = 8;
const WIRE_EXTEND = 12;
const QUBIT_ROW_HEIGHT = SLOT_SIZE + SLOT_GAP;
const CONTROL_DOT_RADIUS = 8;
const BALL_RADIUS = 14;

export const GATE_LAB_CANVAS_WIDTH =
  BALL_COLUMN_WIDTH + NUM_STEPS * SLOT_SIZE + (NUM_STEPS - 1) * SLOT_GAP + WIRE_EXTEND;
export const GATE_LAB_CANVAS_HEIGHT = GATE_LAB_MAX_QUBITS * QUBIT_ROW_HEIGHT - SLOT_GAP;

const slotX = (step: number): number => BALL_COLUMN_WIDTH + step * (SLOT_SIZE + SLOT_GAP);
const rowY = (qubit: number): number => qubit * QUBIT_ROW_HEIGHT;
const slotCenterX = (step: number): number => slotX(step) + SLOT_SIZE / 2;
const slotCenterY = (qubit: number): number => rowY(qubit) + SLOT_SIZE / 2;
const ballCenterX = BALL_COLUMN_WIDTH / 2;

export class GateLabCanvas extends Node {
  private readonly cellNodes: Array<Array<Node | null>>;
  private readonly renderedCells: CircuitCell[][];
  private readonly qubitRows: Node[];
  private readonly connectorLayer: Node;
  private readonly connectors: Array<Line | null>;
  private readonly inspectPlayhead: Line;
  private inspectStep: number | null = null;

  public constructor(model: GateLabModel) {
    super();

    this.cellNodes = [];
    this.renderedCells = [];
    this.qubitRows = [];
    this.connectors = Array.from({ length: NUM_STEPS }, () => null);

    this.connectorLayer = new Node({ pickable: false });
    this.inspectPlayhead = new Line(0, 0, 0, 0, {
      stroke: QubitSketchColors.inspectPlayheadColorProperty,
      lineWidth: 2.5,
      lineDash: [5, 4],
      visible: false,
      pickable: false,
    });

    for (let q = 0; q < GATE_LAB_MAX_QUBITS; q++) {
      const wireCenterY = slotCenterY(q);
      const rowNode = new Node();
      this.addChild(rowNode);
      this.qubitRows.push(rowNode);

      // Horizontal wire spanning all slots (drawn under the ball and the slots).
      const wireStart = ballCenterX;
      const wireEnd = BALL_COLUMN_WIDTH + NUM_STEPS * SLOT_SIZE + (NUM_STEPS - 1) * SLOT_GAP + WIRE_EXTEND;
      rowNode.addChild(
        new Rectangle(wireStart, wireCenterY - 1, wireEnd - wireStart, 2, {
          fill: QubitSketchColors.wireColorProperty,
          pickable: false,
        }),
      );

      // Input ball: the book's "drop a black or white ball in the top" — click to flip.
      const ball = new Circle(BALL_RADIUS, {
        fill: QubitSketchColors.ballWhiteColorProperty,
        stroke: QubitSketchColors.ballStrokeColorProperty,
        lineWidth: 1.5,
        centerX: ballCenterX,
        centerY: wireCenterY,
        cursor: "pointer",
      });
      const qubitIndex = q;
      ball.addInputListener({ down: () => model.toggleInputBit(qubitIndex) });
      rowNode.addChild(ball);
      model.inputBitsProperty.link((bits) => {
        ball.fill =
          ((bits >> qubitIndex) & 1) === 1
            ? QubitSketchColors.ballBlackColorProperty
            : QubitSketchColors.ballWhiteColorProperty;
      });

      const nodeRow: Array<Node | null> = [];
      const cellRow: CircuitCell[] = [];

      for (let s = 0; s < NUM_STEPS; s++) {
        const stepIndex = s;
        const slot = new Rectangle(slotX(s), rowY(q), SLOT_SIZE, SLOT_SIZE, {
          fill: QubitSketchColors.slotBackgroundColorProperty,
          stroke: QubitSketchColors.slotBorderColorProperty,
          lineWidth: 1,
          cornerRadius: 4,
          cursor: "pointer",
        });
        rowNode.addChild(slot);
        nodeRow.push(null);
        cellRow.push({ kind: "empty" });

        slot.addInputListener({
          over: () => {
            slot.fill = QubitSketchColors.slotHoverColorProperty;
          },
          out: () => {
            slot.fill = QubitSketchColors.slotBackgroundColorProperty;
          },
          down: () => model.placeCell(qubitIndex, stepIndex),
        });
      }

      this.cellNodes.push(nodeRow);
      this.renderedCells.push(cellRow);
    }

    this.addChild(this.connectorLayer);
    this.addChild(this.inspectPlayhead);

    model.circuitProperty.link((circuit) => {
      this.updateCellNodes(circuit);
      this.updateConnectors(circuit, model.qubitCountProperty.value);
    });

    model.qubitCountProperty.link((count) => {
      for (let q = 0; q < GATE_LAB_MAX_QUBITS; q++) {
        const row = this.qubitRows[q];
        if (row !== undefined) {
          row.visible = q < count;
        }
      }
      this.updateConnectors(model.circuitProperty.value, count);
      this.updateInspectPlayhead(count);
    });

    model.inspectStepProperty.link((step) => {
      this.inspectStep = step;
      this.updateInspectPlayhead(model.qubitCountProperty.value);
    });
  }

  private updateInspectPlayhead(qubitCount: number): void {
    if (this.inspectStep === null) {
      this.inspectPlayhead.visible = false;
      return;
    }
    const x = BALL_COLUMN_WIDTH + this.inspectStep * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP / 2;
    const top = rowY(0) - 4;
    const bottom = rowY(qubitCount - 1) + SLOT_SIZE + 4;
    this.inspectPlayhead.setLine(x, top, x, bottom);
    this.inspectPlayhead.visible = true;
  }

  private makeCellNode(cell: CircuitCell, step: number, qubit: number): Node | null {
    if (cell.kind === "control") {
      return new Circle(CONTROL_DOT_RADIUS, {
        fill: QubitSketchColors.controlDotColorProperty,
        centerX: slotCenterX(step),
        centerY: slotCenterY(qubit),
        pickable: false,
      });
    }
    if (cell.kind === "swap") {
      const cx = slotCenterX(step);
      const cy = slotCenterY(qubit);
      const r = CONTROL_DOT_RADIUS + 1;
      const node = new Node({ pickable: false });
      const stroke = QubitSketchColors.swapMarkerColorProperty;
      node.addChild(new Line(cx - r, cy - r, cx + r, cy + r, { stroke, lineWidth: 3 }));
      node.addChild(new Line(cx - r, cy + r, cx + r, cy - r, { stroke, lineWidth: 3 }));
      return node;
    }
    const gate = cellGate(cell);
    if (gate !== null) {
      const gateNode = new GateNode(gate, SLOT_SIZE - 4, BOX_LABEL_MAP[gate]);
      gateNode.x = slotX(step) + 2;
      gateNode.y = rowY(qubit) + 2;
      gateNode.pickable = false;
      return gateNode;
    }
    return null;
  }

  private updateCellNodes(circuit: Grid): void {
    for (let q = 0; q < GATE_LAB_MAX_QUBITS; q++) {
      const row = this.qubitRows[q];
      const nodeRow = this.cellNodes[q];
      const cellRow = this.renderedCells[q];
      if (row === undefined || nodeRow === undefined || cellRow === undefined) {
        continue;
      }
      for (let s = 0; s < NUM_STEPS; s++) {
        const cell = cellAt(circuit, q, s);
        const prev = cellRow[s] ?? { kind: "empty" };
        if (cellsEqual(cell, prev)) {
          continue;
        }
        const old = nodeRow[s];
        if (old !== null && old !== undefined) {
          row.removeChild(old);
        }
        const fresh = this.makeCellNode(cell, s, q);
        if (fresh !== null) {
          row.addChild(fresh);
        }
        nodeRow[s] = fresh;
        cellRow[s] = cell;
      }
    }
  }

  /**
   * Draws a vertical connector line per column from the topmost to the bottommost occupied wire
   * whenever that column contains a control (•) or a pair of SWAP endpoints (plain SWAP or, with
   * a control also present, CSWAP/Fredkin) — same rule as CircuitCanvas.
   */
  private updateConnectors(circuit: Grid, qubitCount: number): void {
    for (let s = 0; s < NUM_STEPS; s++) {
      const existing = this.connectors[s];
      if (existing !== null && existing !== undefined) {
        this.connectorLayer.removeChild(existing);
        this.connectors[s] = null;
      }

      const shape = classifyColumn(circuit, s, qubitCount);
      const occupied = [...shape.onControls, ...shape.swapWires, ...shape.gateWires];
      const hasControl = columnHasControl(shape);
      const top = occupied.length > 0 ? Math.min(...occupied) : -1;
      const bottom = occupied.length > 0 ? Math.max(...occupied) : -1;

      const shouldConnect = (hasControl || shape.swapWires.length === 2) && top !== -1 && bottom > top;
      if (shouldConnect) {
        const line = new Line(slotCenterX(s), slotCenterY(top), slotCenterX(s), slotCenterY(bottom), {
          stroke: hasControl ? QubitSketchColors.controlDotColorProperty : QubitSketchColors.swapMarkerColorProperty,
          lineWidth: 2,
          pickable: false,
        });
        this.connectorLayer.addChild(line);
        this.connectors[s] = line;
      }
    }
  }
}
