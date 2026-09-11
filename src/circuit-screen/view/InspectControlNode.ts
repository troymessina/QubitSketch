/**
 * InspectControlNode.ts
 *
 * Transport control for the step-through "inspect" mode. It scrubs the model's
 * inspectStepProperty (number of circuit columns applied) so the live displays show
 * the intermediate state after each column:
 *
 *   ◀  step one column back (entering inspect from the live/final state)
 *   ▶  step one column forward (stepping past the last column returns to live)
 *   Live  jump back to the final state (inspect off)
 *
 * "Live" (inspectStep === null) is treated as sitting at the end of the circuit, so the
 * readout shows `k / depth` while inspecting and "Live" otherwise.
 *
 * Shared by CircuitScreen and GateLabScreen — it only reads CircuitEditingModel's base
 * inspect-step/circuit-depth API.
 */
import { DerivedProperty } from "scenerystack/axon";
import { HBox, Text } from "scenerystack/scenery";
import { FlatAppearanceStrategy, RectangularPushButton } from "scenerystack/sun";
import type { CircuitEditingModel } from "../../common/CircuitEditingModel.js";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { FONTS } from "../../QubitSketchFonts.js";

export class InspectControlNode extends HBox {
  public constructor(model: CircuitEditingModel) {
    const { inspectStepProperty: stepProperty, circuitDepthProperty: depthProperty } = model;
    const strings = StringManager.getInstance().getInspectStrings();
    const a11yControls = StringManager.getInstance().getA11yStrings().controls;

    // The column the readout/playhead currently sits at: the cursor, or the full depth when live.
    const shownColumn = (): number => stepProperty.value ?? depthProperty.value;

    // Shared button styling: a flat (un-gradiented) look, a vivid enabled fill that stands out
    // from the background, and a dark disabled fill so the (often-disabled) transport buttons
    // stay muted instead of glaring white the way the sun default light-gray disabled color does.
    const buttonAppearance = {
      baseColor: QubitSketchColors.buttonColorProperty,
      disabledColor: QubitSketchColors.buttonDisabledColorProperty,
      buttonAppearanceStrategy: FlatAppearanceStrategy,
    } as const;

    const prevButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text("◀", { font: FONTS.transportGlyph, fill: QubitSketchColors.textColorProperty }),
      listener: () => {
        const k = shownColumn();
        if (k > 0) {
          model.setInspectStep(k - 1);
        }
      },
      enabledProperty: new DerivedProperty(
        [stepProperty, depthProperty],
        (step, depth) => depth > 0 && (step ?? depth) > 0,
      ),
      accessibleName: a11yControls.previousStepStringProperty,
    });

    const nextButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text("▶", { font: FONTS.transportGlyph, fill: QubitSketchColors.textColorProperty }),
      listener: () => {
        const next = shownColumn() + 1;
        // Stepping past the last column returns to the live (final) state.
        model.setInspectStep(next >= depthProperty.value ? null : next);
      },
      // Forward only makes sense while inspecting (live already sits at the end).
      enabledProperty: new DerivedProperty([stepProperty], (step) => step !== null),
      accessibleName: a11yControls.nextStepStringProperty,
    });

    const readout = new Text("", {
      font: FONTS.transportReadout,
      fill: QubitSketchColors.textColorProperty,
    });
    new DerivedProperty([stepProperty, depthProperty, strings.liveStringProperty], (step, depth, live) =>
      step === null ? live : `${step} / ${depth}`,
    ).link((text) => {
      readout.string = text;
    });

    const liveButton = new RectangularPushButton({
      ...buttonAppearance,
      content: new Text(strings.liveStringProperty, {
        font: FONTS.caption,
        fill: QubitSketchColors.textColorProperty,
      }),
      listener: () => {
        model.setInspectStep(null);
      },
      enabledProperty: new DerivedProperty([stepProperty], (step) => step !== null),
    });

    super({
      spacing: 6,
      align: "center",
      children: [prevButton, readout, nextButton, liveButton],
    });
  }
}
