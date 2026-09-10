/**
 * A small bundled set for the Dashboard's quote line -- no network call, no
 * loading state, matching the app's zero-friction-after-first-paint bar.
 * `pickRandomQuote` takes the RNG as a parameter so it's deterministic and
 * unit-testable; callers use `Math.random` by default.
 */
export type Quote = { text: string; author: string };

export const QUOTES: readonly Quote[] = [
  { text: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" },
  { text: "The best way to get a project done faster is to start sooner.", author: "Jim Highsmith" },
  { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
  { text: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
  { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "The most important property of a program is whether it accomplishes the intention of its user.", author: "C.A.R. Hoare" },
  { text: "Deleted code is debugged code.", author: "Jeff Sickel" },
  { text: "A comment is a lie waiting to happen.", author: "Old programmer's proverb" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
];

export function pickRandomQuote(rng: () => number = Math.random): Quote {
  const index = Math.floor(rng() * QUOTES.length);
  return QUOTES[index];
}
