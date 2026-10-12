/**
 * qubitSketchQueryParameters.ts
 *
 * Sim-specific startup query parameters. This is the single place where every
 * sim-specific query parameter is declared and documented. Public-facing
 * parameters (intended for end users / sharing links) must set `public: true`.
 *
 * ── How to add a query parameter ──────────────────────────────────────────────
 * 1. Add an entry below with a `type`, `defaultValue`, and (if user-facing)
 *    `public: true`. Add `isValidValue` to bound numeric ranges.
 * 2. If it should also be user-editable at runtime, surface it as a preference
 *    in QubitSketchPreferencesModel (initialize that Property from this query parameter).
 *
 * Usage: append e.g. `?qubits=4` to the sim URL.
 */

import { logGlobal } from "scenerystack/phet-core";
import { QueryStringMachine } from "scenerystack/query-string-machine";
import { DEFAULT_QUBITS, MAX_QUBITS, MIN_QUBITS } from "../circuit-screen/model/GateType.js";
import QubitSketchNamespace from "../QubitSketchNamespace.js";

/**
 * Hash key for a shareable circuit (`#circuit=<encoded>`). The live permalink
 * is a URL hash, not a search parameter; `CircuitUrlSync` parses that hash
 * with this same schema via `QueryStringMachine.getAllForString`.
 */
export const CIRCUIT_QUERY_KEY = "circuit";

export const qubitSketchQueryParameterSchema = {
  /** Initial number of visible qubit wires. */
  qubits: {
    type: "number" as const,
    defaultValue: DEFAULT_QUBITS,
    isValidValue: (value: number) => Number.isInteger(value) && value >= MIN_QUBITS && value <= MAX_QUBITS,
    public: true,
  },

  /**
   * Encoded circuit for a shared link. Empty when the circuit is blank.
   * Structure is checked by `deserialize`; any string is accepted here.
   */
  [CIRCUIT_QUERY_KEY]: {
    type: "string" as const,
    defaultValue: "",
    public: true,
  },
};

const qubitSketchQueryParameters = QueryStringMachine.getAll(qubitSketchQueryParameterSchema);

QubitSketchNamespace.register("qubitSketchQueryParameters", qubitSketchQueryParameters);

// Log query parameters (for the console / PhET-iO).
logGlobal("phet.chipper.queryParameters");

export default qubitSketchQueryParameters;
