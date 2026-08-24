/** NLTK chat package — interactive chatbots (terminal I/O). */
function err(name: string): never {
  throw new Error(
    `nltk.chat.${name} requires interactive terminal I/O — not available in JS runtime (use Chat class from chat_util directly)`,
  );
}
export function eliza_chat(..._a: unknown[]): never { return err("eliza.eliza_chat"); }
export function iesha_chat(..._a: unknown[]): never { return err("iesha.iesha_chat"); }
export function rude_chat(..._a: unknown[]): never { return err("rude.rude_chat"); }
export function suntsu_chat(..._a: unknown[]): never { return err("suntsu.suntsu_chat"); }
export function zen_chat(..._a: unknown[]): never { return err("zen.zen_chat"); }
export function chatbots(..._a: unknown[]): never { return err("chatbots"); }
export const bots: never[] = [];
// re-export Chat for convenience — real impl lives in chat_util
export { Chat } from "./chat_util.ts";
