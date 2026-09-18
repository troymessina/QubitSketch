/**
 * IntroKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog on Intro. Mirrors
 * GateLabKeyboardHelpContent.ts — no slider, no combo box, just basic actions
 * (tab navigation and buttons).
 */
import { BasicActionsKeyboardHelpSection, TwoColumnKeyboardHelpContent } from "scenerystack/scenery-phet";

export class IntroKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    super([new BasicActionsKeyboardHelpSection()], []);
  }
}
