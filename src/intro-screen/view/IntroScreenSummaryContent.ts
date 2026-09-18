/**
 * IntroScreenSummaryContent.ts
 *
 * Accessible screen summary (SceneryStack Interactive Description) for Intro.
 * Mirrors GateLabScreenSummaryContent.ts / CircuitScreenSummaryContent.ts — see
 * CircuitScreenSummaryContent.ts for the shared OpenLyceum accessibility convention
 * this follows.
 */
import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { IntroModel } from "../model/IntroModel.js";

export class IntroScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: IntroModel) {
    const a11y = StringManager.getInstance().getIntroStrings().a11y;

    const currentDetailsProperty = new DerivedProperty(
      [a11y.currentDetailsStringProperty, model.boxesProperty],
      (template, boxes) => StringUtils.fillIn(template, { count: boxes.length }),
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
