/**
 * Once-per-session nudge when a vim user reaches for the mouse inside the
 * editor. sessionStorage (not localStorage's hasSeenOnboarding) on purpose --
 * this should needle again next session, not just once ever.
 */
const KEY = "rbnotes.mouse-nudge-shown";

const MESSAGES = [
  "That mouse reach was unnecessary. :cheat finds the motion you wanted.",
  "Hand left the keyboard. :cheat gets you back without it.",
  "Mouse detected. There's a vim way -- :cheat will find it.",
  "No judgment. Just know :cheat exists for next time.",
  "Your hand just left home row. :cheat, then never again.",
  "Clicking works. So does :cheat, and it's faster.",
  "The mouse is right there, sure. So is :cheat.",
  "A wild mouse movement appeared. :cheat is super effective.",
  "Somewhere, a vim elder felt that click.",
  "Cursor moved by hand. Ambitious. :cheat has a better way.",
  "Rest that hand. :cheat knows the motion in plain English.",
  "Mouse click logged. Motion suggestion filed under :cheat.",
  "That's one way to move the cursor. :cheat has quicker ones.",
  "Reaching for the mouse? Reach for :cheat instead.",
  "Point, click, sigh. Try :cheat next time.",
  "The keyboard missed you already. :cheat brings you back.",
  "Mouse: 1. You, if you use :cheat: many.",
  "That click could've been a motion. :cheat, then decide.",
  "Old habits. :cheat builds new, faster ones.",
  "You could've typed it. :cheat shows how.",
  "Detected: manual cursor placement. Suggested fix: :cheat.",
  "Every mouse click is a motion you haven't learned yet. :cheat helps.",
  "The trackpad noticed. So did we. :cheat is right there.",
  "Not a crime, just slower. :cheat speeds it up.",
  "Hand-eye coordination: great. Keyboard speed: better. :cheat bridges it.",
  "This is your quarterly mouse reminder. :cheat, always available.",
  "Vim purists are whispering. :cheat quiets them.",
  "Click acknowledged, judgment withheld. :cheat exists if curious.",
  "Somewhere a modal editor sheds a tear. :cheat wipes it.",
  "Mouse movement: unnecessary but valid. :cheat: also valid, faster.",
];

export function maybeShowMouseNudge(show: (message: string) => void): void {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(KEY) === "1") return;
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    return;
  }
  show(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
}
