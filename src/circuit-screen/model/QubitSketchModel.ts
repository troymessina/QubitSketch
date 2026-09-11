/**
 * QubitSketchModel.ts
 *
 * Top-level model for the quantum circuit builder screen. Nearly all of its behavior
 * (grid editing, undo/redo, live statevector/probability/Bloch derived Properties) lives
 * in the shared `CircuitEditingModel` base — see common/CircuitEditingModel.ts. This class
 * adds only what's specific to CircuitScreen: the full qubit-count range and tool palette,
 * and re-applying the preferences-driven qubit count on Reset All.
 */
import { CircuitEditingModel } from "../../common/CircuitEditingModel.js";
import type { QubitSketchPreferencesModel } from "../../preferences/QubitSketchPreferencesModel.js";
import { DEFAULT_QUBITS, MAX_QUBITS, MIN_QUBITS, SELECTED_TOOL_VALUES } from "./GateType.js";

export class QubitSketchModel extends CircuitEditingModel {
  private readonly preferences: QubitSketchPreferencesModel | undefined;

  public constructor(preferences?: QubitSketchPreferencesModel) {
    // The initial qubit count comes from the injected preferences model (whose own initial value
    // derives from the ?qubits= query parameter), or the plain default when constructed without one.
    super({
      minQubits: MIN_QUBITS,
      maxQubits: MAX_QUBITS,
      defaultQubits: preferences?.qubitCountProperty.value ?? DEFAULT_QUBITS,
      toolValues: SELECTED_TOOL_VALUES,
      defaultTool: "H",
    });
    this.preferences = preferences;
  }

  protected override onReset(): void {
    if (this.preferences) {
      this._qubitCountProperty.value = this.preferences.qubitCountProperty.value;
    }
  }
}
