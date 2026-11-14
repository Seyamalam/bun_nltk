/** NLTK chat.rude — Rude chatbot. */
import { Chat, reflections, rude_pairs, rude_chat } from "./chat";
export { Chat, reflections, rude_chat };
export const pairs = rude_pairs;
export const rude_chatbot = new Chat(pairs, reflections);
export function demo(...args: Parameters<typeof rude_chat>): void { rude_chat(...args); }
