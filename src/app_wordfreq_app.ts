/** NLTK app.wordfreq_app — Tkinter/matplotlib GUI not available in JS runtime. */
function err(): never {
  throw new Error(
    "nltk.app.wordfreq_app requires Tkinter/matplotlib GUI — not available in JS runtime (use programmatic FreqDist API)",
  );
}
export function plot_word_freq_dist(..._a: unknown[]): never { return err(); }
export function app(..._a: unknown[]): never { return err(); }
