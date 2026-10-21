import type { SocialTokenizerRequest } from "../src/tokenizers_social.ts";

export function socialCases(): SocialTokenizerRequest[] {
  const texts = [
    "", "a \t b\r\n c", "café naïve 你好 Привет فارسی", "e\u0301 a\u200c_b \u{1e6c0} ² Ⅳ ٣",
    "a &amp; b &lt;3 &gt; &nbsp; &pound;100 &copy; &apos; &unknown; &#128; &#129; &#x1F600; &#X41; &#0;",
    "foo@example.com foo.na@example.com @a@b a@b.co a@_gmail.com", "#a #ab ##abc #foo-bar #don't #café @你好",
    "Hi!!! :D <3 :-P <:| >:) 8o) (-: :@ =| :O </3 :o 8D :*", "<html> <a href=x> <tag> -> <--",
    "HTTP://example.com/a(b(c)d). https:/abc.co/a https:a.co http://a.co http://a.co/x? foo.co/ foo.co/a",
    "https://en.wikipedia.org/wiki/Foo_(bar) www.example.com x.co@foo.com", "601-984-4813 +1 (800) 555-1212 1234567 ١٢٣٤٥٦٧ 123.45 12/34 -1:2+",
    "👩🏽‍💻 🇺🇸 🇦🇧 🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f} ❤️ 👨‍👩‍👧‍👦 a‍b a🏽",
    "ΣΟΣ İ K ſ ẞ AΣ' Σ'A ΟΣ\u0301", "@remy: waaaaayyyy!!!!!! aaAAAaaa éééé 111111 ____", 
    "@abcdefghijklmnop @abcdefghijklmn@x @@abc !@abc $@abc a@abc .@abc @éclair @a_ @ab-c",
    "The https://github.com/jonsafari/tok-tok/blob/master/tok-tok.pl with/and/or weird : things",
    "¡This, is weird» symbols… ¿ 9.5 525,600 ١,٢ ،، a،b a,,b a,,,3 a,٣ , ,,",
    "word. word.\n word.\n\n word.' word.\" word.’ word.. word... a . . . b",
    "a\tb|c & d &amp; x--y x---y x–y x—y a?b a? b? /abc a/b ://a/abc",
    "isn't can't l'amour O’Reilly ` ` ' ' \"hi\" 「你好」 ⟨x⟩ ₹100 €20",
    "a\u001cb\u001dc\u0085d\u00a0e\ufefff",
    "\u{1e6c0}\u{1e6c0}\u{1e6c0}\u{1e6c0} \u{a7ce} \u{16ea0} \u0301\u0301\u0301\u0301 ²²²² __.__ _Σ_",
    "example.com/a example.com/ab a.com@foo.com a.com/@foo.com ab.cdefghijklmnop x.co_ x.coé",
    "&#x+41; &#x0_041; &#+65; &#-1; &#999999999999999999999; &frac12; &Alpha; &NotEqualTilde;",
    "a?\u001cb ://\u001d/x .\u001f\"",
    "&x41; &x0x41; &#x0x41; &#-0; &#x-0; &#+-0; &#x_41; &#x0x_41; &#１２３; &x; &#; x.co/@ x.co/@foo x.co/@foo.com x.co_ x.co/@/",
    "httpſ:/abſ.co/path K.co/path İ.co/path ı.co/path K.ſſ/a https:aab http:ab",
  ];
  let seed = 31;
  const atoms = ["café", "a", "b", "@a", "@ab@c", "foo.na", "example.com", "foo@example.com", "&amp;", "!", "'", ".", ",", ":D", "<3", "--", "?", ":", "/", "٣", "_", "\t", "\n", " ", "👩🏽‍💻", "\u0301"];
  for (let i = 0; i < 100; i++) {
    let text = "";
    for (let j = 0; j < 8; j++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; text += atoms[seed % atoms.length]; }
    texts.push(text);
  }
  const cases: SocialTokenizerRequest[] = [];
  for (const text of texts) {
    for (let mask = 0; mask < 16; mask++) cases.push({ kind: "tweet", text, preserve_case: !!(mask & 1), reduce_len: !!(mask & 2), strip_handles: !!(mask & 4), match_phone_numbers: !!(mask & 8) });
    cases.push({ kind: "toktok", text }, { kind: "toktok", text, return_str: true });
  }
  const lexicons = [[], [[]], [["a"]], [[" a", "b "]], [["", "b"]], [["a_b", "c"]], [["a", "b_c"]], [["a", "b"], ["a", "b", "c"], ["a", "b", "c", "d"]], [["a", "b"], ["a", "b", "x"]], [["__proto__", "constructor"]]];
  const inputs = [[], ["a"], ["a", "b"], ["a", "b", "c"], ["a", "b", "c", "z", "a", "b", "x"], [" a", "b "], ["", "b"], ["a_b", "c"], ["a", "b_c"], ["__proto__", "constructor"]];
  for (const mwes of lexicons) for (const tokens of inputs) for (const separator of ["_", "", " / "]) cases.push({ kind: "mwe", tokens, mwes, separator });
  const ranges = [[0, 255], [0x300, 0x36f], [0x2000, 0x206f], [0xa7c0, 0xa7ff], [0x16e90, 0x16ed4], [0x1e6c0, 0x1e6ff]];
  for (const [a, b] of ranges) {
    const text = Array.from({ length: b! - a! + 1 }, (_, i) => String.fromCodePoint(a! + i).repeat(4)).join(" ");
    cases.push({ kind: "tweet", text, preserve_case: false }, { kind: "tweet", text, reduce_len: true });
    cases.push({ kind: "toktok", text }, { kind: "toktok", text, return_str: true });
  }
  return cases;
}
