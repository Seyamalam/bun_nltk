// NLTK jsontags — lightweight JS port
// Original: nltk/jsontags.py

export const TAG_PREFIX = "!";
export const jsonTags: Record<string, unknown> = {};

export function registerTag<T extends { jsonTag: string }>(cls: T): T {
  jsonTags[TAG_PREFIX + cls.jsonTag] = cls;
  return cls;
}
export const register_tag = registerTag;

export class JSONTaggedEncoder {
  encode(obj: unknown): string {
    const tag = (obj as Record<string, unknown>)["jsonTag"] as string | undefined
      ?? (obj as { json_tag?: string }).json_tag;
    if (!tag) return JSON.stringify(obj);
    const encoded = (obj as { encodeJsonObj: ()=> unknown }).encodeJsonObj();
    return JSON.stringify({ [TAG_PREFIX + tag]: encoded });
  }
  static stringify(obj: unknown): string { return new JSONTaggedEncoder().encode(obj); }
}

export class JSONTaggedDecoder {
  static MAX_DECODE_DEPTH = 200;
  decode(s: string): unknown { return JSONTaggedDecoder.decodeObj(JSON.parse(s)); }
  static decodeObj(obj: unknown, depth = 0): unknown {
    if (depth > JSONTaggedDecoder.MAX_DECODE_DEPTH) throw new Error("JSON nesting too deep");
    if (Array.isArray(obj)) return obj.map(v => JSONTaggedDecoder.decodeObj(v, depth+1));
    if (obj !== null && typeof obj === "object") {
      const rec = obj as Record<string, unknown>;
      const mapped: Record<string, unknown> = {};
      for (const [k,v] of Object.entries(rec)) mapped[k] = JSONTaggedDecoder.decodeObj(v, depth+1);
      if (Object.keys(mapped).length === 1) {
        const tag = Object.keys(mapped)[0] as string;
        if (tag.startsWith("!") && tag in jsonTags) {
          const cls = jsonTags[tag] as { decodeJsonObj: (o: unknown)=> unknown };
          return cls.decodeJsonObj(mapped[tag]);
        }
        if (tag.startsWith("!")) throw new Error(`Unknown tag ${tag}`);
      }
      return mapped;
    }
    return obj;
  }
}
