/**
 * QubitCountControl.ts
 *
 * The −/＋ stepper above the circuit: a "−" button, an "N qubits" readout, and a "+" button.
 * Editing routes through model.setQubitCount (clamped, undoable); the readout tracks
 * qubitCountProperty and the active locale. Shared by CircuitScreen and GateLabScreen — it
 * only reads/writes CircuitEditingModel's base qubit-count API.
 */
import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { Node, Rectangle, Text } from "scenerystack/scenery";
import type { CircuitEditingModel } from "../../common/CircuitEditingModel.js";
import { StringManager } from "../../i18n/StringManager.js";
import QubitSketchColors from "../../QubitSketchColors.js";
import { QUBIT_COUNT_CONTROL } from "../../QubitSketchConstants.js";
import { FONTS } from "../../QubitSketchFonts.js";

export class QubitCountControl extends Node {
  public constructor(model: CircuitEditingModel) {
    super();

    const { BUTTON_SIZE, BUTTON_RADIUS, READOUT_WIDTH, READOUT_HEIGHT, SPACING } = QUBIT_COUNT_CONTROL;

    // "−" button
    const minusBox = new Rectangle(0, 0, BUTTON_SIZE, BUTTON_SIZE, {
      fill: QubitSketchColors.buttonColorProperty,
      stroke: QubitSketchColors.buttonStrokeColorProperty,
      lineWidth: 1,
      cornerRadius: BUTTON_RADIUS,
      cursor: "pointer",
    });
    const minusLabel = new Text("−", {
      font: FONTS.stepperButton,
      fill: QubitSketchColors.textColorProperty,
      centerX: BUTTON_SIZE / 2,
      centerY: BUTTON_SIZE / 2,
      pickable: false,
    });
    minusBox.addChild(minusLabel);
    minusBox.addInputListener({
      down: () => model.setQubitCount(model.qubitCountProperty.value - 1),
    });
    this.addChild(minusBox);

    // Count readout
    const readoutX = BUTTON_SIZE + SPACING;
    const readoutBox = new Rectangle(readoutX, 0, READOUT_WIDTH, READOUT_HEIGHT, {
      fill: QubitSketchColors.slotBackgroundColorProperty,
      stroke: QubitSketchColors.panelBorderColorProperty,
      lineWidth: 1,
      cornerRadius: BUTTON_RADIUS,
      pickable: false,
    });
    this.addChild(readoutBox);

    const qubitSelectorStrings = StringManager.getInstance().getQubitSelectorStrings();
    const readoutStringProperty = new DerivedProperty(
      [
        model.qubitCountProperty,
        qubitSelectorStrings.qubitCountSingularPatternStringProperty,
        qubitSelectorStrings.qubitCountPluralPatternStringProperty,
      ],
      (count, singular, plural) => StringUtils.fillIn(count === 1 ? singular : plural, { count }),
    );
    const readoutText = new Text(readoutStringProperty, {
      font: FONTS.control,
      fill: QubitSketchColors.textColorProperty,
      centerX: readoutX + READOUT_WIDTH / 2,
      centerY: BUTTON_SIZE / 2,
      pickable: false,
    });
    this.addChild(readoutText);

    // "+" button
    const plusX = readoutX + READOUT_WIDTH + SPACING;
    const plusBox = new Rectangle(plusX, 0, BUTTON_SIZE, BUTTON_SIZE, {
      fill: QubitSketchColors.buttonColorProperty,
      stroke: QubitSketchColors.buttonStrokeColorProperty,
      lineWidth: 1,
      cornerRadius: BUTTON_RADIUS,
      cursor: "pointer",
    });
    const plusLabel = new Text("+", {
      font: FONTS.stepperButton,
      fill: QubitSketchColors.textColorProperty,
      centerX: plusX + BUTTON_SIZE / 2,
      centerY: BUTTON_SIZE / 2,
      pickable: false,
    });
    plusBox.addChild(plusLabel);
    plusBox.addInputListener({
      down: () => model.setQubitCount(model.qubitCountProperty.value + 1),
    });
    this.addChild(plusBox);

    // Re-center the readout whenever its text changes (qubit count or locale).
    readoutStringProperty.link(() => {
      readoutText.centerX = readoutX + READOUT_WIDTH / 2;
    });
  }
}
