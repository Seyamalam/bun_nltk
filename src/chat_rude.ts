/** NLTK chat.rude — Rude chatbot (interactive demo). */
import { Chat, reflections } from "./chat_util.ts";
export { reflections };
export const pairs: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [];
export const rude_chatbot = new Chat(pairs, reflections);
export function rude_chat(..._a: unknown[]): never {
  throw new Error(
    "nltk.chat.rude.rude_chat requires interactive terminal I/O — not available in JS runtime (use Chat.respond for programmatic use)",
  );
}
export function demo(..._a: unknown[]): never {
  throw new Error("nltk.chat.rude.demo requires interactive terminal I/O — not available in JS runtime");
}
