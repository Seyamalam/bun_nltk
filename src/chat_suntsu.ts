/** NLTK chat.suntsu — Sun Tsu sayings chatbot. */
import { Chat, reflections, suntsu_pairs, suntsu_chat } from "./chat";
export { Chat, reflections, suntsu_chat };
export const pairs = suntsu_pairs;
export const suntsu_chatbot = new Chat(pairs, reflections);
export function demo(...args: Parameters<typeof suntsu_chat>): void { suntsu_chat(...args); }
