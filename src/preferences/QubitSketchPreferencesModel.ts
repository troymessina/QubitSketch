/**
 * QubitSketchPreferencesModel.ts
 *
 * Model for the simulation-specific preferences shown in Preferences →
 * Simulation. Each preference Property takes its initial value from the
 * corresponding query parameter in qubitSketchQueryParameters.
 */

import { NumberProperty } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import type { Tandem } from "scenerystack/tandem";
import { MAX_QUBITS, MIN_QUBITS } from "../circuit-screen/model/GateType.js";
import QubitSketchNamespace from "../QubitSketchNamespace.js";
import qubitSketchQueryParameters from "./qubitSketchQueryParameters.js";

export const QUBIT_COUNT_RANGE = new Range(MIN_QUBITS, MAX_QUBITS);

export class QubitSketchPreferencesModel {
  /** Initial number of qubit wires. */
  public readonly qubitCountProperty: NumberProperty;

  public constructor(tandem?: Tandem) {
    this.qubitCountProperty = new NumberProperty(qubitSketchQueryParameters.qubits, {
      range: QUBIT_COUNT_RANGE,
      numberType: "Integer",
      ...(tandem && { tandem: tandem.createTandem("qubitCountProperty") }),
    });
  }

  public reset(): void {
    this.qubitCountProperty.reset();
  }
}

QubitSketchNamespace.register("QubitSketchPreferencesModel", QubitSketchPreferencesModel);
