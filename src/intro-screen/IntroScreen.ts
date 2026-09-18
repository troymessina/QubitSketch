/**
 * IntroScreen.ts
 *
 * Wires together IntroModel and IntroScreenView as a SceneryStack Screen — mirrors
 * GateLabScreen.ts / CircuitScreen.ts. No URL sync or QASM (like Gate Lab): this is
 * a teaching sandbox, not a shareable-circuit tool.
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import QubitSketchColors from "../QubitSketchColors.js";
import { IntroModel } from "./model/IntroModel.js";
import { IntroKeyboardHelpContent } from "./view/IntroKeyboardHelpContent.js";
import { IntroScreenView } from "./view/IntroScreenView.js";

type IntroScreenOptions = ScreenOptions & { tandem: Tandem };

export class IntroScreen extends Screen<IntroModel, IntroScreenView> {
  public constructor(options: IntroScreenOptions) {
    super(
      () => new IntroModel(),
      (model) =>
        new IntroScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<IntroScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: QubitSketchColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new IntroKeyboardHelpContent(),
        },
        options,
      ),
    );
  }
}
