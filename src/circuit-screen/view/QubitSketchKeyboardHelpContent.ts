/**
 * QubitSketchKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog (the "?" button in the navigation bar).
 * Composed from the standard scenery-phet help sections: sliders, the Bloch
 * sphere keyboard drag, the combo-box selectors, and basic actions.
 */

import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  MoveDraggableItemsKeyboardHelpSection,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";

export class QubitSketchKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    // The large Bloch sphere is a keyboard drag (RichDragListener in BlochSpheresNode).
    const blochDragSection = new MoveDraggableItemsKeyboardHelpSection({
      headingStringProperty: StringManager.getInstance().getDisplayTitles().blochStringProperty,
    });
    const leftSections = [new SliderControlsKeyboardHelpSection(), blochDragSection, new ComboBoxKeyboardHelpSection()];
    const rightSections = [new BasicActionsKeyboardHelpSection()];
    super(leftSections, rightSections);
  }
}
