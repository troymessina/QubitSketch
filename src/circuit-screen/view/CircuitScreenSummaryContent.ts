/**
 * CircuitScreenSummaryContent.ts
 *
 * Accessible screen summary (SceneryStack Interactive Description). Describes the
 * circuit play area and controls, gives an interaction hint, and exposes a LIVE
 * "current details" paragraph derived from the model (the number of qubits).
 *
 * Follows the OpenLyceum accessibility convention; see the canonical
 * SceneryStackTemplate/SimScreenSummaryContent.ts.
 */
import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { QubitSketchModel } from "../model/QubitSketchModel.js";

export class CircuitScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: QubitSketchModel) {
    const a11y = StringManager.getInstance().getA11yStrings();

    const currentDetailsProperty = new DerivedProperty(
      [a11y.currentDetailsStringProperty, model.qubitCountProperty],
      (template, qubits) => StringUtils.fillIn(template, { qubits: qubits }),
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
