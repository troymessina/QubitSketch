/**
 * CircuitCanvas.ts
 *
 * Renders the quantum circuit grid — qubit labels, horizontal wire lines,
 * and a grid of clickable gate slots. Clicking a slot applies the currently
 * selected tool via model.placeCell().
 *
 * Cell kinds are rendered as:
 *   gate / controlledTarget — a colored GateNode (the gate letter)
 *   control                 — a filled control dot (•) with a vertical connector
 *                             line to the gate target in the same column
 *
 * Layout (all values in SceneryStack's virtual coordinate space):
 *   - LABEL_WIDTH  — left-side qubit labels (q₀, q₁, …)
 *   - SLOT_SIZE    — size of each gate cell (width = height)
 *   - SLOT_GAP     — gap between consecutive cells
 *   - WIRE_EXTEND  — how far the wire extends past the last slot
 */
import { PatternStringProperty } from "scenerystack/axon";
import type { Vector2 } from "scenerystack/dot";
import { Circle, Line, Node, Rectangle, Text } from "scenerystack/scenery";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { FONTS } from "../../QubitSketchFonts.js";
import type { Grid } from "../model/CircuitGrid.js";
import { cellAt, classifyColumn, columnHasControl } from "../model/CircuitGrid.js";
import type { CircuitCell } from "../model/GateType.js";
import { cellGate, cellsEqual, MAX_QUBITS, NUM_STEPS } from "../model/GateType.js";
import type { QubitSketchModel } from "../model/QubitSketchModel.js";
import { GateNode, RotationGateNode } from "./GateNode.js";

const LABEL_WIDTH = 52;
const SLOT_SIZE = 50;
const SLOT_GAP = 8;
const WIRE_EXTEND = 12;
const QUBIT_ROW_HEIGHT = SLOT_SIZE + SLOT_GAP;
const CONTROL_DOT_RADIUS = 7;

// Total canvas dimensions (sized for MAX_QUBITS rows, NUM_STEPS columns)
export const CIRCUIT_CANVAS_WIDTH = LABEL_WIDTH + NUM_STEPS * SLOT_SIZE + (NUM_STEPS - 1) * SLOT_GAP + WIRE_EXTEND;
export const CIRCUIT_CANVAS_HEIGHT = MAX_QUBITS * QUBIT_ROW_HEIGHT - SLOT_GAP;

/** The grid as a drag-and-drop drop target (implemented by CircuitCanvas). */
export interface SlotDropTarget {
  slotIndexAt(globalPoint: Vector2, qubitCount: number): { qubit: number; step: number } | null;
}

const slotX = (step: number): number => LABEL_WIDTH + step * (SLOT_SIZE + SLOT_GAP);
const rowY = (qubit: number): number => qubit * QUBIT_ROW_HEIGHT;
const slotCenterX = (step: number): number => slotX(step) + SLOT_SIZE / 2;
const slotCenterY = (qubit: number): number => rowY(qubit) + SLOT_SIZE / 2;

export class CircuitCanvas extends Node {
  /** The node currently rendered in each cell (gate, control dot, …) or null. */
  private readonly cellNodes: Array<Array<Node | null>>;
  /** The cell content last rendered in each position, to detect changes. */
  private readonly renderedCells: CircuitCell[][];
  private readonly qubitRows: Node[];
  /** Layer holding control→target connector lines, one per column. */
  private readonly connectorLayer: Node;
  private readonly connectors: Array<Line | null>;
  /** Highlight ring around the rotation cell whose angle is being edited. */
  private readonly selectionRing: Rectangle;
  /** Vertical "playhead" marking how far the circuit has been simulated in step-through mode. */
  private readonly inspectPlayhead: Line;
  /** Current inspect cursor (columns applied), or null when not inspecting. */
  private inspectStep: number | null = null;

  public constructor(model: QubitSketchModel) {
    super();

    this.cellNodes = [];
    this.renderedCells = [];
    this.qubitRows = [];
    this.connectors = Array.from({ length: NUM_STEPS }, () => null);

    this.connectorLayer = new Node({ pickable: false });
    this.selectionRing = new Rectangle(0, 0, SLOT_SIZE + 6, SLOT_SIZE + 6, {
      fill: null,
      stroke: QubitSketchColors.selectedToolHighlightColorProperty,
      lineWidth: 2,
      cornerRadius: 6,
      visible: false,
      pickable: false,
    });
    this.inspectPlayhead = new Line(0, 0, 0, 0, {
      stroke: QubitSketchColors.inspectPlayheadColorProperty,
      lineWidth: 2.5,
      lineDash: [5, 4],
      visible: false,
      pickable: false,
    });

    // Build one row per qubit (up to MAX_QUBITS; hidden rows are toggled by qubitCountProperty)
    for (let q = 0; q < MAX_QUBITS; q++) {
      const wireCenterY = slotCenterY(q);

      const rowNode = new Node();
      this.addChild(rowNode);
      this.qubitRows.push(rowNode);

      // Qubit label
      const label = new Text(
        new PatternStringProperty(StringManager.getInstance().getQubitLabelStrings().indexPatternStringProperty, {
          index: q,
        }),
        {
          font: FONTS.qubitLabel,
          fill: QubitSketchColors.textColorProperty,
          right: LABEL_WIDTH - 6,
          centerY: wireCenterY,
          pickable: false,
        },
      );
      rowNode.addChild(label);

      // Horizontal wire spanning all slots
      const wireStart = LABEL_WIDTH;
      const wireEnd = LABEL_WIDTH + NUM_STEPS * SLOT_SIZE + (NUM_STEPS - 1) * SLOT_GAP + WIRE_EXTEND;
      const wire = new Rectangle(wireStart, wireCenterY - 1, wireEnd - wireStart, 2, {
        fill: QubitSketchColors.wireColorProperty,
        pickable: false,
      });
      rowNode.addChild(wire);

      const nodeRow: Array<Node | null> = [];
      const cellRow: CircuitCell[] = [];

      // Gate slots
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

        // Hover effect + click-to-place
        slot.addInputListener({
          over: () => {
            slot.fill = QubitSketchColors.slotHoverColorProperty;
          },
          out: () => {
            slot.fill = QubitSketchColors.slotBackgroundColorProperty;
          },
          down: () => {
            // Clicking an existing rotation gate (with any non-eraser tool) opens its angle inspector.
            const cell = cellAt(model.circuitProperty.value, q, stepIndex);
            if (cell.kind === "paramGate" && model.selectedToolProperty.value !== "eraser") {
              model.selectedCellProperty.value = { qubit: q, step: stepIndex };
            } else {
              model.placeCell(q, stepIndex);
            }
          },
        });
      }

      this.cellNodes.push(nodeRow);
      this.renderedCells.push(cellRow);
    }

    // Connector lines draw on top of the wires but below the gate/control nodes' rows.
    this.addChild(this.connectorLayer);
    // Selection ring and inspect playhead float above the cells.
    this.addChild(this.selectionRing);
    this.addChild(this.inspectPlayhead);

    // React to circuit changes — update gate/control nodes and connectors
    model.circuitProperty.link((circuit) => {
      this.updateCellNodes(circuit);
      this.updateConnectors(circuit, model.qubitCountProperty.value);
    });

    // Highlight the rotation cell whose angle is being edited.
    model.selectedCellProperty.link((sel) => {
      if (sel === null) {
        this.selectionRing.visible = false;
      } else {
        this.selectionRing.visible = true;
        this.selectionRing.x = slotX(sel.step) - 3;
        this.selectionRing.y = rowY(sel.qubit) - 3;
      }
    });

    // React to qubit count changes — show/hide rows and refresh connectors + playhead
    model.qubitCountProperty.link((count) => {
      for (let q = 0; q < MAX_QUBITS; q++) {
        const row = this.qubitRows[q];
        if (row !== undefined) {
          row.visible = q < count;
        }
      }
      this.updateConnectors(model.circuitProperty.value, count);
      this.updateInspectPlayhead(model.qubitCountProperty.value);
    });

    // Position the step-through playhead at the current inspect boundary.
    model.inspectStepProperty.link((step) => {
      this.inspectStep = step;
      this.updateInspectPlayhead(model.qubitCountProperty.value);
    });
  }

  /** Positions the inspect playhead in the gap just left of column `inspectStep`, or hides it. */
  private updateInspectPlayhead(qubitCount: number): void {
    if (this.inspectStep === null) {
      this.inspectPlayhead.visible = false;
      return;
    }
    const x = LABEL_WIDTH + this.inspectStep * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP / 2;
    const top = rowY(0) - 4;
    const bottom = rowY(qubitCount - 1) + SLOT_SIZE + 4;
    this.inspectPlayhead.setLine(x, top, x, bottom);
    this.inspectPlayhead.visible = true;
  }

  /** Builds the visual node for a cell, positioned within its slot, or null if empty. */
  private makeCellNode(cell: CircuitCell, step: number, qubit: number): Node | null {
    if (cell.kind === "control") {
      return new Circle(CONTROL_DOT_RADIUS, {
        fill: QubitSketchColors.controlDotColorProperty,
        centerX: slotCenterX(step),
        centerY: slotCenterY(qubit),
        pickable: false,
      });
    }
    if (cell.kind === "antiControl") {
      // Open circle (◦): conditions on |0⟩.
      return new Circle(CONTROL_DOT_RADIUS, {
        fill: QubitSketchColors.slotBackgroundColorProperty,
        stroke: QubitSketchColors.controlDotColorProperty,
        lineWidth: 2,
        centerX: slotCenterX(step),
        centerY: slotCenterY(qubit),
        pickable: false,
      });
    }
    if (cell.kind === "swap") {
      // ✕ marker for a SWAP endpoint.
      const cx = slotCenterX(step);
      const cy = slotCenterY(qubit);
      const r = CONTROL_DOT_RADIUS + 1;
      const node = new Node({ pickable: false });
      const stroke = QubitSketchColors.swapMarkerColorProperty;
      node.addChild(new Line(cx - r, cy - r, cx + r, cy + r, { stroke, lineWidth: 3 }));
      node.addChild(new Line(cx - r, cy + r, cx + r, cy - r, { stroke, lineWidth: 3 }));
      return node;
    }
    if (cell.kind === "paramGate") {
      const gateNode = new RotationGateNode(cell.axis, SLOT_SIZE - 4, cell.theta);
      gateNode.x = slotX(step) + 2;
      gateNode.y = rowY(qubit) + 2;
      gateNode.pickable = false;
      return gateNode;
    }
    const gate = cellGate(cell);
    if (gate !== null) {
      const gateNode = new GateNode(gate, SLOT_SIZE - 4);
      gateNode.x = slotX(step) + 2;
      gateNode.y = rowY(qubit) + 2;
      gateNode.pickable = false;
      return gateNode;
    }
    return null;
  }

  private updateCellNodes(circuit: Grid): void {
    for (let q = 0; q < MAX_QUBITS; q++) {
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
        // Remove the old node, if any.
        const old = nodeRow[s];
        if (old !== null && old !== undefined) {
          row.removeChild(old);
        }
        // Build the replacement.
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
   * Draws a vertical connector line per column from the topmost to the bottommost
   * occupied wire whenever that column contains a control (• or ◦) or a pair of SWAP
   * endpoints, so the user sees which wires the operation links.
   */
  private updateConnectors(circuit: Grid, qubitCount: number): void {
    for (let s = 0; s < NUM_STEPS; s++) {
      const existing = this.connectors[s];
      if (existing !== null && existing !== undefined) {
        this.connectorLayer.removeChild(existing);
        this.connectors[s] = null;
      }

      const shape = classifyColumn(circuit, s, qubitCount);
      const occupied = [...shape.onControls, ...shape.offControls, ...shape.swapWires, ...shape.gateWires];
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

  /**
   * Maps a global point to the {qubit, step} slot it falls in, or null if it is
   * outside the grid / on a hidden qubit row. Used by drag-and-drop placement.
   */
  public slotIndexAt(globalPoint: Vector2, qubitCount: number): { qubit: number; step: number } | null {
    const local = this.globalToLocalPoint(globalPoint);
    const step = Math.floor((local.x - LABEL_WIDTH) / (SLOT_SIZE + SLOT_GAP));
    const qubit = Math.floor(local.y / QUBIT_ROW_HEIGHT);
    if (step < 0 || step >= NUM_STEPS || qubit < 0 || qubit >= qubitCount) {
      return null;
    }
    // Reject points that fall in the inter-slot gap.
    if (local.x - slotX(step) > SLOT_SIZE || local.y - rowY(qubit) > SLOT_SIZE) {
      return null;
    }
    return { qubit, step };
  }
}
