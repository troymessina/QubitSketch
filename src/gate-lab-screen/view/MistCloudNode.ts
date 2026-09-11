/**
 * MistCloudNode.ts
 *
 * Gate Lab's "mist" display — the book's picture of superposition (see doc/model.md
 * and src/gate-lab-screen/model/MistState.ts). Lists every surviving ball-color
 * configuration inside a drawn cloud, each row a "−" sign (if the amplitude is
 * negative) followed by one ball glyph per wire, big-endian like the ket displays
 * elsewhere in the sim (ketLabel in displayUtils.ts).
 *
 * A Peek button samples one outcome (the book's "observe the ball") and swaps the
 * mist for that single, deterministic result until Reset returns to the mist —
 * a single-shot reveal rather than MeasurementHistogramNode's accumulating tally,
 * matching the book's narrative device. Any change to the distribution (a circuit
 * edit, a qubit-count change, an input-ball flip, or an inspect scrub) invalidates a
 * peeked result, same trigger MeasurementHistogramNode uses to clear its tally.
 */
import { DerivedProperty, Property, type ReadOnlyProperty } from "scenerystack/axon";
import type { Complex } from "scenerystack/dot";
import { Circle, Node, Rectangle, Text } from "scenerystack/scenery";
import { FlatAppearanceStrategy, RectangularPushButton } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { FONTS, scaledFont } from "../../QubitSketchFonts.js";
import type { MistRow } from "../model/MistState.js";
import { computeMistRows } from "../model/MistState.js";

const MAX_BALL_RADIUS = 9;
const MIN_BALL_RADIUS = 4;
const BALL_GAP = 5;
const SIGN_COLUMN_WIDTH = 12;
const CLOUD_X_PADDING = 12;
const BUTTON_ROW_GAP = 8;

/** Samples an index from a probability distribution via cumulative sum (same approach as
 * MeasurementHistogramNode's sampleOutcome). */
function sampleOutcome(probabilities: readonly number[]): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < probabilities.length; i++) {
    acc += probabilities[i] ?? 0;
    if (r < acc) {
      return i;
    }
  }
  return probabilities.length - 1; // numerical fallback
}

/** One row: an optional leading "−" sign, then `n` ball glyphs, big-endian (qubit n−1 first). */
function buildBallRow(row: MistRow, n: number, ballRadius: number, rowCenterY: number): Node {
  const node = new Node();
  if (row.sign === -1) {
    node.addChild(
      new Text("−", {
        font: scaledFont(Math.round(ballRadius * 2.2), { bold: true }),
        fill: QubitSketchColors.textColorProperty,
        centerX: SIGN_COLUMN_WIDTH / 2,
        centerY: rowCenterY,
      }),
    );
  }
  let x = SIGN_COLUMN_WIDTH + ballRadius;
  for (let q = n - 1; q >= 0; q--) {
    const bit = (row.bits >> q) & 1;
    node.addChild(
      new Circle(ballRadius, {
        fill: bit === 1 ? QubitSketchColors.ballBlackColorProperty : QubitSketchColors.ballWhiteColorProperty,
        stroke: QubitSketchColors.ballStrokeColorProperty,
        lineWidth: 1.2,
        centerX: x,
        centerY: rowCenterY,
      }),
    );
    x += ballRadius * 2 + BALL_GAP;
  }
  return node;
}

export class MistCloudNode extends Node {
  public constructor(
    stateVectorProperty: ReadOnlyProperty<Complex[]>,
    probabilitiesProperty: ReadOnlyProperty<number[]>,
    qubitCountProperty: ReadOnlyProperty<number>,
    width: number,
    boxHeight: number,
  ) {
    super();

    const strings = StringManager.getInstance().getGateLabStrings().mist;
    /** null ⇒ showing the mist; otherwise the single basis index a Peek revealed. */
    const peekedProperty = new Property<number | null>(null);

    // Any change to the distribution invalidates a peeked result — back to the mist, same
    // trigger MeasurementHistogramNode uses to clear its tally.
    probabilitiesProperty.lazyLink(() => {
      peekedProperty.value = null;
    });

    const peekLabelProperty = new DerivedProperty(
      [peekedProperty, strings.peekStringProperty, strings.peekAgainStringProperty],
      (peeked, peek, peekAgain) => (peeked === null ? peek : peekAgain),
    );
    const peekButton = new RectangularPushButton({
      content: new Text(peekLabelProperty, { font: FONTS.body, fill: QubitSketchColors.onGateTextColorProperty }),
      baseColor: QubitSketchColors.histogramBarColorProperty,
      buttonAppearanceStrategy: FlatAppearanceStrategy,
      listener: () => {
        peekedProperty.value = sampleOutcome(probabilitiesProperty.value);
      },
    });
    const resetButton = new RectangularPushButton({
      content: new Text(strings.resetStringProperty, {
        font: FONTS.body,
        fill: QubitSketchColors.onGateTextColorProperty,
      }),
      baseColor: QubitSketchColors.eraserColorProperty,
      buttonAppearanceStrategy: FlatAppearanceStrategy,
      left: peekButton.right + 8,
      listener: () => {
        peekedProperty.value = null;
      },
    });
    peekedProperty.link((peeked) => {
      resetButton.visible = peeked !== null;
    });
    // peekButton's width tracks its label ("Peek" vs "Peek again"), so resetButton must
    // re-follow its right edge whenever that label changes.
    peekLabelProperty.link(() => {
      resetButton.left = peekButton.right + 8;
    });

    this.addChild(peekButton);
    this.addChild(resetButton);

    const cloudLayer = new Node({ y: peekButton.bottom + BUTTON_ROW_GAP });
    this.addChild(cloudLayer);
    const cloudAvailableHeight = Math.max(0, boxHeight - (peekButton.bottom + BUTTON_ROW_GAP));

    const rebuild = (): void => {
      cloudLayer.removeAllChildren();
      const n = qubitCountProperty.value;
      const peeked = peekedProperty.value;
      const rows: MistRow[] =
        peeked === null ? computeMistRows(stateVectorProperty.value) : [{ bits: peeked, sign: 1 }];

      const rowHeight = Math.max(
        MIN_BALL_RADIUS * 2,
        Math.min(MAX_BALL_RADIUS * 2, cloudAvailableHeight / Math.max(1, rows.length)),
      );
      const ballRadius = Math.max(MIN_BALL_RADIUS, Math.min(MAX_BALL_RADIUS, rowHeight / 2 - 1));
      const cloudHeight = Math.max(cloudAvailableHeight, rows.length * rowHeight);

      cloudLayer.addChild(
        new Rectangle(0, 0, width, cloudHeight, {
          fill: QubitSketchColors.mistCloudColorProperty,
          stroke: QubitSketchColors.mistCloudBorderColorProperty,
          lineWidth: 1.5,
          cornerRadius: 14,
        }),
      );

      for (const [i, row] of rows.entries()) {
        const rowNode = buildBallRow(row, n, ballRadius, i * rowHeight + rowHeight / 2);
        rowNode.x = CLOUD_X_PADDING;
        cloudLayer.addChild(rowNode);
      }
    };

    // qubitCountProperty is not linked separately: it is one of stateVectorProperty's own
    // DerivedProperty dependencies (see CircuitEditingModel), so a qubit-count change already
    // triggers a stateVectorProperty update, and by the time that listener runs
    // qubitCountProperty.value already reflects the new count.
    stateVectorProperty.link(rebuild);
    peekedProperty.link(rebuild);
  }
}
