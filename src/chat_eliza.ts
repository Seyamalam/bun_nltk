/** NLTK chat.eliza — Eliza chatbot. */
import { Chat, reflections, eliza_pairs, eliza_chat } from "./chat";
export { Chat, reflections, eliza_chat };
export const pairs = eliza_pairs;
export const eliza_chatbot = new Chat(pairs, reflections);
export function demo(...args: Parameters<typeof eliza_chat>): void { eliza_chat(...args); }
