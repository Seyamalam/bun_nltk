/** cli — shim (requires click/tqdm — not available in JS). */
export function cli(): never { throw new Error("cli requires click/tqdm — not available in JS runtime"); }
export const CONTEXT_SETTINGS = {help_option_names: ["-h","--help"]};
