/**
 * MeasurementHistogramNode.ts
 *
 * A "Measure" button that samples a single outcome from the current probability
 * distribution and tallies it into a histogram, plus a "Clear" button to reset
 * the tally. With enough shots the histogram approaches the probability bars —
 * the link between amplitudes and what you'd actually observe.
 *
 * Pedagogical simplification: this samples the DISPLAYED statevector (the
 * inspect-mode prefix state when inspect is active, the final state otherwise)
 * for display only. It does NOT collapse the state or affect any gates (no
 * mid-circuit measurement). See README limitations. Whenever that distribution
 * changes — a circuit edit, a qubit-count change, or an inspect scrub — the
 * tally is cleared, so the histogram never mixes shots from different
 * distributions.
 */
import { Property, type ReadOnlyProperty } from "scenerystack/axon";
import { dotRandom } from "scenerystack/dot";
import { Node, Rectangle, Text } from "scenerystack/scenery";
import { FlatAppearanceStrategy, RectangularPushButton } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { FONTS } from "../../QubitSketchFonts.js";
import { basisRowFont, ketLabel } from "./displayUtils.js";

const MAX_ROW_HEIGHT = 16;
const LABEL_WIDTH = 52;
const COUNT_WIDTH = 44;

/** Samples an index from a probability distribution via cumulative sum. */
function sampleOutcome(probabilities: number[]): number {
  const r = dotRandom.nextDouble();
  let acc = 0;
  for (let i = 0; i < probabilities.length; i++) {
    acc += probabilities[i] ?? 0;
    if (r < acc) {
      return i;
    }
  }
  return probabilities.length - 1; // numerical fallback
}

export class MeasurementHistogramNode extends Node {
  public constructor(probabilitiesProperty: ReadOnlyProperty<number[]>, width: number, boxHeight: number) {
    super();

    const labels = StringManager.getInstance().getButtonLabels();
    const shotsProperty = new Property<number[]>(new Array(probabilitiesProperty.value.length).fill(0));

    // Any change to the sampled distribution (circuit edit, qubit-count change, inspect scrub)
    // invalidates the old tally, so clear it rather than mixing shots from different circuits.
    probabilitiesProperty.lazyLink((probabilities) => {
      shotsProperty.value = new Array(probabilities.length).fill(0);
    });

    const measureButton = new RectangularPushButton({
      content: new Text(labels.measureStringProperty, {
        font: FONTS.body,
        fill: QubitSketchColors.onGateTextColorProperty,
      }),
      baseColor: QubitSketchColors.histogramBarColorProperty,
      buttonAppearanceStrategy: FlatAppearanceStrategy,
      listener: () => {
        const idx = sampleOutcome(probabilitiesProperty.value);
        const next = shotsProperty.value.slice();
        next[idx] = (next[idx] ?? 0) + 1;
        shotsProperty.value = next;
      },
    });

    const clearButton = new RectangularPushButton({
      content: new Text(labels.clearShotsStringProperty, {
        font: FONTS.body,
        fill: QubitSketchColors.onGateTextColorProperty,
      }),
      baseColor: QubitSketchColors.eraserColorProperty,
      buttonAppearanceStrategy: FlatAppearanceStrategy,
      left: measureButton.right + 8,
      listener: () => {
        shotsProperty.value = new Array(shotsProperty.value.length).fill(0);
      },
    });

    this.addChild(measureButton);
    this.addChild(clearButton);

    const totalText = new Text("", {
      font: FONTS.monoCaption,
      fill: QubitSketchColors.textColorProperty,
      left: clearButton.right + 12,
      centerY: measureButton.centerY,
    });
    this.addChild(totalText);

    const bars = new Node({ y: measureButton.bottom + 8 });
    this.addChild(bars);

    const trackLeft = LABEL_WIDTH;
    const trackWidth = width - LABEL_WIDTH - COUNT_WIDTH;

    shotsProperty.link((shots) => {
      bars.removeAllChildren();
      const total = shots.reduce((a, b) => a + b, 0);
      totalText.string = `${total} shot${total === 1 ? "" : "s"}`;
      const n = Math.round(Math.log2(shots.length));
      const rowHeight = Math.min(MAX_ROW_HEIGHT, boxHeight / shots.length);
      const font = basisRowFont(rowHeight);

      for (let i = 0; i < shots.length; i++) {
        const count = shots[i] ?? 0;
        const fraction = total > 0 ? count / total : 0;
        const y = i * rowHeight;

        bars.addChild(
          new Text(ketLabel(i, n), {
            font,
            fill: QubitSketchColors.textColorProperty,
            right: LABEL_WIDTH - 6,
            centerY: y + rowHeight / 2,
          }),
        );
        bars.addChild(
          new Rectangle(trackLeft, y + 1, trackWidth, rowHeight - 2, {
            fill: QubitSketchColors.slotBackgroundColorProperty,
            cornerRadius: 2,
          }),
        );
        if (count > 0) {
          bars.addChild(
            new Rectangle(trackLeft, y + 1, Math.max(1, trackWidth * fraction), rowHeight - 2, {
              fill: QubitSketchColors.histogramBarColorProperty,
              cornerRadius: 2,
            }),
          );
        }
        bars.addChild(
          new Text(`${count}`, {
            font,
            fill: QubitSketchColors.textColorProperty,
            left: trackLeft + trackWidth + 6,
            centerY: y + rowHeight / 2,
          }),
        );
      }
    });
  }
}
