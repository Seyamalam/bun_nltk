import { describe, expect, test } from "bun:test";
import {
  ArabicStemmer,
  FinnishStemmer,
  HungarianStemmer,
  SnowballStemmer,
} from "../src/stemmers";
import { snowballStem, SNOWBALL_LANGUAGES } from "../src/snowball";

// Values pinned from Python NLTK 3.10.3 (see test/snowball_arfihu_oracle.py).

const ARABIC_PINS: [string, string][] = [
  ["الكتاب", "كتاب"],
  ["المكتبة", "مكتب"],
  ["كتب", "كتب"],
  ["يكتب", "يكتب"],
  ["الطلاب", "طلاب"],
  ["معلمات", "معلم"],
  ["سيذهب", "سيذهب"],
  ["تستعملون", "تستعمل"],
  ["بالبيت", "الب"],
  ["كالرجل", "رجل"],
  ["والمكتبات", "مكتب"],
  ["فالكتاب", "كتاب"],
  ["مكة", "مك"],
  ["إن", "إن"],
  ["هذا", "هذا"],
  ["الذي", "الذ"],
  ["ببعضهم", "بعض"],
  ["ككم", "ككم"],
  ["سياسة", "سياس"],
  ["تفاحة", "تفاح"],
  ["مستشفى", "مستشفى"],
  ["المدارس", "مدارس"],
  ["كم", "كم"],
  ["كما", "كما"],
  ["علماً", "علم"],
  ["استطاعوا", "استطاع"],
  ["المدرسة", "مدرس"],
  ["المعلمون", "معلم"],
  ["يكتبون", "يكتب"],
  ["سيكتب", "سيكتب"],
  ["نستطيع", "نستطيع"],
  ["التجربة", "تجرب"],
  ["وكالة", "كال"],
  ["البنات", "البن"],
  ["لاعبون", "لاعب"],
  ["مشكلة", "مشكل"],
  ["السعادة", "سعاد"],
  ["تقدمت", "تقدم"],
  ["انطلقت", "انطلق"],
  ["المعرفة", "معرف"],
  ["استعملها", "استعمل"],
  ["القاهرة", "قاهر"],
  ["فلسطين", "لسط"],
  ["الصحافة", "صحاف"],
  ["تحياتي", "تح"],
];

const FINNISH_PINS: [string, string][] = [
  ["taloissa", "talo"],
  ["talon", "talo"],
  ["taloja", "talo"],
  ["kirjani", "kirj"],
  ["kirjasi", "kirj"],
  ["kirjamme", "kirj"],
  ["koirassa", "koira"],
  ["lapsille", "laps"],
  ["nähdä", "nähd"],
  ["juokseminen", "juoksemin"],
  ["kauneimpi", "kauneimp"],
  ["hyvin", "hyv"],
  ["menemme", "mene"],
  ["ollaan", "ol"],
  ["tulee", "tule"],
  ["sanottu", "sanotu"],
  ["tietokone", "tietokon"],
  ["ystävällisesti", "ystävällis"],
  ["kävellä", "käve"],
  ["koirat", "koira"],
  ["kissanpentujen", "kissanpentu"],
  ["autossani", "auto"],
  ["taloillenne", "talo"],
  ["juoksentelisit", "juoksentelis"],
  ["tyttöjen", "tyttöj"],
  ["vaikeudessa", "vaikeud"],
  ["kirjoittamalla", "kirjoittam"],
  ["opiskelijat", "opiskelij"],
  ["mieluummin", "mieluum"],
  ["aikaisemmin", "aikais"],
  ["suomalaisuudesta", "suomalaisuud"],
  ["ystävyyttä", "ystävyyt"],
  ["menivätkin", "meniv"],
  ["tullessaan", "tul"],
  ["olemattomuus", "olemattomuus"],
  ["päivällinen", "päivällin"],
  ["keskusteleminen", "keskustelemin"],
  ["todennäköisesti", "todennäköis"],
  ["ilmeisesti", "ilmeis"],
  ["keltaisessa", "keltais"],
];

const HUNGARIAN_PINS: [string, string][] = [
  ["abroncsokkal", "abroncs"],
  ["álmok", "álm"],
  ["almában", "alm"],
  ["barátaim", "barát"],
  ["házakban", "ház"],
  ["könyveket", "könyv"],
  ["szeretem", "szeret"],
  ["beszélgetés", "beszélgetés"],
  ["embernek", "ember"],
  ["játszottam", "játszott"],
  ["legjobb", "legjobb"],
  ["folyóiratok", "folyóirat"],
  ["visszük", "vissz"],
  ["orvoshoz", "orvos"],
  ["képeket", "kép"],
  ["asztal", "asztal"],
  ["szék", "szék"],
  ["kutya", "kuty"],
  ["macska", "macs"],
  ["ember", "ember"],
  ["házzal", "ház"],
  ["várjuk", "vár"],
  ["könyv", "könyv"],
  ["gyalogosoknak", "gyalogos"],
  ["tanították", "tanította"],
  ["elmondhatatlan", "elmondhatatl"],
  ["közlemények", "közlemény"],
  ["beszélgetéseinkben", "beszélgetés"],
  ["megérkezésükkor", "megérkezés"],
  ["virágokkal", "virág"],
  ["társaságokban", "társaság"],
  ["előadásokat", "előadás"],
  ["szemüvegeim", "szemüveg"],
  ["felfedezése", "felfedezés"],
  ["hálószobáink", "hálószoba"],
  ["ajándékokat", "ajándék"],
  ["kocsijaim", "kocsi"],
  ["gondolkodásuk", "gondolkodás"],
  ["hallgatóink", "hallgató"],
  ["munkásokkal", "munkás"],
  ["személyzetünk", "személyzet"],
  ["felfedezőink", "felfedező"],
  ["vízcseppek", "vízcsepp"],
];

describe("ArabicStemmer (NLTK 3.10.3)", () => {
  const stemmer = new ArabicStemmer();
  test.each(ARABIC_PINS)("%s -> %s", (word, expected) => {
    expect(stemmer.stem(word)).toBe(expected);
  });

  test("stem() does not lowercase or strip nothing for short words", () => {
    expect(stemmer.stem("كم")).toBe("كم");
    expect(stemmer.stem("أب")).toBe("أب");
  });
});

describe("FinnishStemmer (NLTK 3.10.3)", () => {
  const stemmer = new FinnishStemmer();
  test.each(FINNISH_PINS)("%s -> %s", (word, expected) => {
    expect(stemmer.stem(word)).toBe(expected);
  });
});

describe("HungarianStemmer (NLTK 3.10.3)", () => {
  const stemmer = new HungarianStemmer();
  test.each(HUNGARIAN_PINS)("%s -> %s", (word, expected) => {
    expect(stemmer.stem(word)).toBe(expected);
  });
});

describe("SnowballStemmer ar/fi/hu integration", () => {
  test("SnowballStemmer languages tuple matches NLTK", () => {
    expect([...SnowballStemmer.languages]).toEqual([
      "arabic", "danish", "dutch", "english", "finnish", "french", "german",
      "hungarian", "italian", "norwegian", "porter", "portuguese",
      "romanian", "russian", "spanish", "swedish",
    ]);
    expect([...SNOWBALL_LANGUAGES]).toEqual([
      "arabic", "danish", "dutch", "english", "finnish", "french", "german",
      "hungarian", "italian", "norwegian", "portuguese", "romanian",
      "russian", "spanish", "swedish",
    ]);
  });

  test("ignore_stopwords returns stopwords unchanged", () => {
    const ar = new SnowballStemmer("arabic", true);
    // NLTK checks the post-normalization token, so a vocalized form of a
    // stopword is also returned (in its normalized spelling).
    expect(ar.stem("هذا")).toBe("هذا");
    expect(ar.stem("هَذَا")).toBe("هذا");
    const fi = new SnowballStemmer("finnish", true);
    expect(fi.stem("aika")).toBe("aika");
    expect(fi.stem("taloissa")).toBe("talo");
    const hu = new SnowballStemmer("hungarian", true);
    expect(hu.stem("a")).toBe("a");
    expect(hu.stem("könyveket")).toBe("könyv");
  });

  test("snowballStem dispatches the new languages", () => {
    expect(snowballStem("الكتاب", "arabic")).toBe("كتاب");
    expect(snowballStem("taloissa", "finnish")).toBe("talo");
    expect(snowballStem("házakban", "hungarian")).toBe("ház");
  });
});
