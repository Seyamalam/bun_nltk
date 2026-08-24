/** NLTK chat.zen — Zen chatbot (interactive demo). */
import { Chat, reflections } from "./chat_util.ts";
export { reflections };
export const responses: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [];
export const pairs = responses;
export const zen_chatbot = new Chat(responses, reflections);
export function zen_chat(..._a: unknown[]): never {
  throw new Error(
    "nltk.chat.zen.zen_chat requires interactive terminal I/O — not available in JS runtime (use Chat.respond for programmatic use)",
  );
}
export function demo(..._a: unknown[]): never {
  throw new Error("nltk.chat.zen.demo requires interactive terminal I/O — not available in JS runtime");
}
