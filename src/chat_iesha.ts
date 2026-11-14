/** NLTK chat.iesha — Iesha the TeenBoT (own reflections table). */
import { Chat, iesha_reflections, iesha_pairs, iesha_chat } from "./chat";
export { Chat, iesha_chat };
export const reflections = iesha_reflections;
export const pairs = iesha_pairs;
export const iesha_chatbot = new Chat(pairs, reflections);
export function demo(...args: Parameters<typeof iesha_chat>): void { iesha_chat(...args); }
