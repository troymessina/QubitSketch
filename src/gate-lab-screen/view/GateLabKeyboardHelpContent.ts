/**
 * GateLabKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog on Gate Lab. Unlike CircuitScreen, Gate Lab has no
 * slider (no rotation-angle inspector) and no combo box (no example-circuits dropdown), so
 * only the basic-actions section (tab navigation and buttons) applies.
 */
import { BasicActionsKeyboardHelpSection, TwoColumnKeyboardHelpContent } from "scenerystack/scenery-phet";

export class GateLabKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    super([new BasicActionsKeyboardHelpSection()], []);
  }
}
