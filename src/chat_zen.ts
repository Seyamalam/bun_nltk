/** NLTK chat.zen — Zen chatbot (Python names the pair table `responses`). */
import { Chat, reflections, zen_pairs, zen_chat } from "./chat";
export { Chat, reflections, zen_chat };
export const responses = zen_pairs;
export const pairs = responses;
export const zen_chatbot = new Chat(responses, reflections);
export function demo(...args: Parameters<typeof zen_chat>): void { zen_chat(...args); }
