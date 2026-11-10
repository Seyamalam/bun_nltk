import { describe, expect, test } from "bun:test";
import { ARLSTem } from "../src/stem_arlstem";
import { ARLSTem2 } from "../src/stem_arlstem2";
import { ISRIStemmer } from "../src/stem_isri";
import { RSLPStemmer } from "../src/stem_rslp";
import { CistemStemmer } from "../src/stem_cistem";

// stem-extra-differential: values pinned against Python NLTK 3.10.3
// (test/stem_extra_oracle.py; rslp rules provisioned into .cache/nltk-data).

const ARLSTEM_CASES: Array<[string, string]> = [["المدرسة","مدرس"],["يذهبون","يذهب"],["كتاب","كتاب"],["مسافير","مسافير"],["المدرس","مدرس"],["كتابي","كتابي"],["والكتاب","كتاب"],["بالقلم","قلم"],["مدارس","مدارس"],["المعلمون","معلم"],["المعلمة","معلم"],["الكبير","كبير"],["صغيرة","صغير"],["يقرأون","يقرا"],["القراءة","قراء"],["كتابة","كتاب"],["المكتبة","مكتب"],["مكتبة","مكتب"],["للطلاب","طلاب"],["منازلهم","منازل"],["البيت","بيت"],["سيذهب","ذهب"],["استخرج","ستخرج"],["الاستغفار","ستغفر"],["المستشفى","مستشفي"],["المسلمون","مسلم"],["للمسلمين","مسلم"],["والمسلمات","مسلم"],["الطويل","طويل"],["القصيرة","قصير"]];
describe("ARLSTem", () => {
  const s = new ARLSTem();
  for (const [word, want] of ARLSTEM_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }
});

const ARLSTEM2_CASES: Array<[string, string]> = [["المدرسة","مدرس"],["يذهبون","يذهب"],["كتاب","كتاب"],["مسافير","مسافير"],["المدرس","مدرس"],["كتابي","كتاب"],["والكتاب","كتاب"],["بالقلم","قلم"],["مدارس","مدارس"],["المعلمون","علم"],["المعلمة","معلم"],["الكبير","كبير"],["صغيرة","صغير"],["يقرأون","يقرا"],["القراءة","قراء"],["كتابة","كتاب"],["المكتبة","مكتب"],["مكتبة","مكتب"],["للطلاب","طلاب"],["منازلهم","منازل"],["البيت","بيت"],["سيذهب","ذهب"],["استخرج","ستخرج"],["الاستغفار","ستغفر"],["المستشفى","مستشف"],["المسلمون","سلم"],["للمسلمين","مسلم"],["والمسلمات","مسلم"],["الطويل","طويل"],["القصيرة","قصير"]];
describe("ARLSTem2", () => {
  const s = new ARLSTem2();
  for (const [word, want] of ARLSTEM2_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }
});

const ISRI_CASES: Array<[string, string]> = [["المدرسة","درس"],["يذهبون","ذهب"],["كتاب","كتب"],["مسافير","مسافير"],["المدرس","درس"],["كتابي","كتب"],["والكتاب","كتب"],["بالقلم","قلم"],["مدارس","درس"],["المعلمون","علم"],["المعلمة","علم"],["الكبير","كبر"],["صغيرة","صغر"],["يقرأون","قرأ"],["القراءة","قرء"],["كتابة","كتب"],["المكتبة","كتب"],["مكتبة","كتب"],["للطلاب","طلب"],["منازلهم","نزل"],["البيت","بيت"],["سيذهب","ذهب"],["استخرج","خرج"],["الاستغفار","غفر"],["المستشفى","شفى"],["المسلمون","سلم"],["للمسلمين","سلم"],["والمسلمات","سلم"],["الطويل","طول"],["القصيرة","قصر"]];
describe("ISRIStemmer", () => {
  const s = new ISRIStemmer();
  for (const [word, want] of ISRI_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }
});

const RSLP_CASES: Array<[string, string]> = [["carros","carr"],["casa","cas"],["meninas","menin"],["amor","am"],["felicidade","felic"],["correr","corr"],["cantar","cant"],["nacional","nacion"],["ensino","ensin"],["amável","am"],["disso","diss"],["aquilo","aquil"],["também","também"],["pés","pé"],["boletins","boletim"],["medos","med"],["luzes","luz"],["invenção","invenç"],["sensível","sens"],["capaz","capaz"],["raça","raç"],["órfãs","órfã"],["áticas","átic"],["têm","têm"],["papel","papel"]];
describe("RSLPStemmer", () => {
  const s = new RSLPStemmer();
  for (const [word, want] of RSLP_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }
});

const CISTEM_CASES: Array<[string, string]> = [["Häuser","hau"],["Männer","mann"],["gegangen","gang"],["schneller","schnell"],["liest","lies"],["Freundinnen","freundinn"],["Katzen","katz"],["Hund","hund"],["Bücher","buch"],["kleiner","klei"],["arbeitete","arbei"],["singend","sing"],["Eltern","elter"],["Kind","kind"],["großem","gross"],["meiner","meiner"],["hierdurch","hierdurch"],["eindruck","eindruck"],["sachlich","sachlich"]];
describe("CistemStemmer", () => {
  const s = new CistemStemmer();
  for (const [word, want] of CISTEM_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }
});

const CISTEM_CI_CASES: Array<[string, string]> = [["Häuser","hau"],["Männer","mann"],["gegangen","gang"],["schneller","schnell"],["liest","lies"],["Freundinnen","freundinn"],["Katzen","katz"],["Hund","hund"],["Bücher","buch"],["kleiner","klei"],["arbeitete","arbei"],["singend","sing"],["Eltern","elter"],["Kind","kind"],["großem","gross"],["meiner","meiner"],["hierdurch","hierdurch"],["eindruck","eindruck"],["sachlich","sachlich"]];
describe("CistemStemmer(ci)", () => {
  const s = new CistemStemmer(true);
  for (const [word, want] of CISTEM_CI_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }
});

