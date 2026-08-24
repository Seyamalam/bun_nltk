// NLTK draw.dispersion — shim (requires matplotlib)
// Original: nltk/draw/dispersion.py

export function dispersionPlot(
  _text?: unknown,
  _words?: unknown,
  _ignoreCase?: boolean,
  _title?: string,
): never {
  throw new Error("draw.dispersion.dispersionPlot requires matplotlib — not available in JS");
}
export const dispersion_plot = dispersionPlot;
