/**
 * GateLabScreen.ts
 *
 * Wires together GateLabModel and GateLabScreenView as a SceneryStack Screen —
 * mirrors CircuitScreen.ts. No URL sync (unlike CircuitScreen): Gate Lab is a
 * teaching sandbox, not a shareable-circuit tool (see CLAUDE.md non-goals).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import QubitSketchColors from "../QubitSketchColors.js";
import { GateLabModel } from "./model/GateLabModel.js";
import { GateLabKeyboardHelpContent } from "./view/GateLabKeyboardHelpContent.js";
import { GateLabScreenView } from "./view/GateLabScreenView.js";

type GateLabScreenOptions = ScreenOptions & { tandem: Tandem };

export class GateLabScreen extends Screen<GateLabModel, GateLabScreenView> {
  public constructor(options: GateLabScreenOptions) {
    super(
      () => new GateLabModel(),
      (model) =>
        new GateLabScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<GateLabScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: QubitSketchColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new GateLabKeyboardHelpContent(),
        },
        options,
      ),
    );
  }
}
