/**
 * GateLabScreenSummaryContent.ts
 *
 * Accessible screen summary (SceneryStack Interactive Description) for Gate Lab.
 * Mirrors CircuitScreenSummaryContent.ts — see that file for the shared OpenPhysics
 * accessibility convention this follows.
 */
import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { GateLabModel } from "../model/GateLabModel.js";

export class GateLabScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: GateLabModel) {
    const a11y = StringManager.getInstance().getGateLabStrings().a11y;

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
