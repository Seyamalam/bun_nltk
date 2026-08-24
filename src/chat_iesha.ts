/** NLTK chat.iesha — Teen chatbot (interactive demo). */
import { Chat } from "./chat_util.ts";
export const reflections: Record<string, string> = {
  am: "r", was: "were", i: "u", "i'd": "u'd", "i've": "u'v", ive: "u'v",
  "i'll": "u'll", my: "ur", are: "am", "you're": "im", "you've": "ive",
  "you'll": "i'll", your: "my", yours: "mine", you: "me", u: "me",
  ur: "my", urs: "mine", me: "u",
};
export const pairs: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [];
export const iesha_chatbot = new Chat(pairs, reflections);
export function iesha_chat(..._a: unknown[]): never {
  throw new Error(
    "nltk.chat.iesha.iesha_chat requires interactive terminal I/O — not available in JS runtime (use Chat.respond for programmatic use)",
  );
}
export function demo(..._a: unknown[]): never {
  throw new Error("nltk.chat.iesha.demo requires interactive terminal I/O — not available in JS runtime");
}
