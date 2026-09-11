/**
 * GateLabModel.ts
 *
 * Top-level model for the Gate Lab screen — a small, book-faithful companion to
 * CircuitScreen modeled on Terry Rudolph's *Q is for Quantum*: a restricted palette
 * (NOT/PETE/control/swap/eraser — the book's box vocabulary), a small wire count, and
 * an initial computational-basis input per wire (the book's "drop a black or white
 * ball," driven by the shared base's `inputBitsProperty`/`toggleInputBit`). All grid
 * editing, undo/redo, and the live statevector/probability/Bloch Properties come from
 * the shared `CircuitEditingModel` base — see common/CircuitEditingModel.ts. This
 * class adds nothing beyond Gate Lab's own qubit-count range and tool palette.
 */
import {
  GATE_LAB_DEFAULT_QUBITS,
  GATE_LAB_MAX_QUBITS,
  GATE_LAB_MIN_QUBITS,
  GATE_LAB_TOOL_VALUES,
} from "../../circuit-screen/model/GateType.js";
import { CircuitEditingModel } from "../../common/CircuitEditingModel.js";

export class GateLabModel extends CircuitEditingModel {
  public constructor() {
    super({
      minQubits: GATE_LAB_MIN_QUBITS,
      maxQubits: GATE_LAB_MAX_QUBITS,
      defaultQubits: GATE_LAB_DEFAULT_QUBITS,
      toolValues: GATE_LAB_TOOL_VALUES,
      defaultTool: "H",
    });
  }
}
