/**
 * CircuitUrlSync.ts
 *
 * Two-way sync between the model's circuit and the URL hash (`#circuit=<encoded>`),
 * so a circuit is shareable just by copying the address bar. On load the hash is
 * parsed into the model; on every edit the model is written back to the hash via
 * history.replaceState (no new browser-history entries — in-app undo handles that).
 */
import { QueryStringMachine } from "scenerystack/query-string-machine";
import { CIRCUIT_QUERY_KEY, qubitSketchQueryParameterSchema } from "../../preferences/qubitSketchQueryParameters.js";
import { deserialize, serialize } from "./CircuitSerializer.js";
import type { QubitSketchModel } from "./QubitSketchModel.js";

function isEmptyCircuit(circuit: ReadonlyArray<ReadonlyArray<{ kind: string }>>): boolean {
  return circuit.every((row) => row.every((cell) => cell.kind === "empty"));
}

/**
 * The encoded circuit in a `#circuit=` hash, parsed with the sim's query schema.
 * Returns null when the hash has no circuit parameter.
 */
function circuitFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, "");
  if (raw === "") {
    return null;
  }
  const parameterString = raw.startsWith("?") ? raw : `?${raw}`;
  if (!QueryStringMachine.containsKeyForString(CIRCUIT_QUERY_KEY, parameterString)) {
    return null;
  }
  const value = QueryStringMachine.getAllForString(qubitSketchQueryParameterSchema, parameterString).circuit;
  return value !== null && value.length > 0 ? value : null;
}

/** Parses the current URL hash into the model, if it carries a valid circuit. */
function load(model: QubitSketchModel): void {
  const encoded = circuitFromHash(window.location.hash);
  if (encoded === null) {
    return;
  }
  const parsed = deserialize(encoded);
  if (parsed === null) {
    return;
  }
  // restoreCircuit applies the grid + qubit count without creating undo history.
  model.restoreCircuit(parsed.circuit, parsed.qubitCount);
}

/**
 * Wires URL ↔ model syncing. Safe to call once at model creation.
 *
 * Returns a disposer that removes the global `hashchange` listener and unlinks
 * the model Property listeners. The `hashchange` listener lives on `window`,
 * which never releases it on its own and whose closure captures the model, so
 * the disposer MUST be called when the model is torn down — otherwise `window`
 * retains the model for the lifetime of the page (a leak whenever a new model is
 * created, e.g. tests or hot-reload). No-op (returns a no-op disposer) outside a
 * browser.
 */
export function attachUrlSync(model: QubitSketchModel): () => void {
  if (typeof window === "undefined") {
    return () => {
      /* no window to detach from */
    };
  }

  let suppress = false;

  const save = (): void => {
    if (suppress) {
      return;
    }
    const { pathname, search } = window.location;
    if (isEmptyCircuit(model.circuitProperty.value)) {
      // Keep a clean URL for an empty circuit.
      window.history.replaceState(null, "", pathname + search);
      return;
    }
    const encoded = encodeURIComponent(serialize(model.circuitProperty.value, model.qubitCountProperty.value));
    window.history.replaceState(null, "", `${pathname}${search}#${CIRCUIT_QUERY_KEY}=${encoded}`);
  };

  // Initial load must not echo back out as a save.
  suppress = true;
  load(model);
  suppress = false;

  // Mirror every subsequent change to the URL. circuitProperty.link fires immediately,
  // publishing the just-loaded circuit to the hash.
  model.circuitProperty.link(save);
  model.qubitCountProperty.lazyLink(save);

  // A hash edit from outside the app (pasting a shared #circuit= link into this tab, or
  // back/forward across hashes) should load that circuit. Our own writes use replaceState,
  // which never fires hashchange. Loading via loadCircuit keeps the previous circuit
  // recoverable with undo.
  const onHashChange = (): void => {
    const encoded = circuitFromHash(window.location.hash);
    if (encoded === null || encoded === serialize(model.circuitProperty.value, model.qubitCountProperty.value)) {
      return;
    }
    const parsed = deserialize(encoded);
    if (parsed !== null) {
      model.loadCircuit(parsed.circuit, parsed.qubitCount);
    }
  };
  window.addEventListener("hashchange", onHashChange);

  return () => {
    window.removeEventListener("hashchange", onHashChange);
    model.circuitProperty.unlink(save);
    model.qubitCountProperty.unlink(save);
  };
}
