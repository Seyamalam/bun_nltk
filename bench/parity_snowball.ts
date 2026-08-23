import { resolve } from "node:path";
import {
  SNOWBALL_LANGUAGES,
  snowballStem,
} from "../src/snowball";

// Base words per language (mix of regular and irregular forms; cyrillic for russian).
const BASES: Record<string, string[]> = {
  danish: ["arbejd", "børn", "køb", "smuk", "dyr", "lejlighed", "regnskab", "udvikling", "virksom", "samarbejd", "mulighed", "beslutning", "undersøg", "forbindelse", "uddannelse", "hjem", "interessant", "vanskelig", "vigtig", "studere", "forening", "kontor", "retning", "styrke", "ånd", "jagt", "erobring", "tilbage", "hunde", "katte"],
  dutch: ["aanschouw", "geleerdheid", "mogelijkheid", "ontwikkeling", "bedrijf", "samenwerking", "beslissing", "onderzoek", "verbinding", "regering", "universiteit", "student", "probleem", "oplossing", "verandering", "belangrijk", "verschillend", "bijzonder", "algemeen", "eigenlijk", "reizen", "werken", "lopen", "zien", "huizen", "mensen", "kinderen", "vrouwen", "mannen", "steden"],
  english: ["generous", "agree", "run", "study", "fly", "die", "deny", "sky", "news", "howe", "atlas", "cosmos", "bias", "proceed", "exceed", "succeed", "inning", "gentle", "early", "only", "single", "ugly", "lie", "tie", "nation", "rational", "valence", "hesitancy", "digitizer", "conformable", "radical", "different", "analogous", "operator", "feudal", "decisive", "hopeful", "callous", "formal", "sensitive", "sensible", "triplicate", "formative", "electricity", "goodness", "revival", "allowance", "inference", "airliner", "gyroscopic", "adjustable", "defensible", "irritant", "replacement", "adjustment", "dependent", "adoption", "communism", "activate", "angularity", "effective", "probate", "rate", "cease", "control", "roll", "consign"],
  french: ["général", "établissement", "national", "développement", "entreprise", "coopération", "possibilité", "décision", "recherche", "gouvernement", "université", "étudiant", "problème", "solutionner", "changement", "important", "différent", "particulier", "cheval", "hibou", "canot", "solitaire", "confiance", "négligent", "vif", "beau", "grand", "petit", "meilleur", "premier", "dernier", "français", "guérison", "courageux", "disposition", "constitutionnel", "monopole", "spécification", "justification", "publication", "manifestation", "attestation", "fin", "content"],
  german: ["strauß", "maus", "haus", "groß", "deutsch", "entwicklung", "unternehmen", "zusammenarbeit", "entscheidung", "forschung", "regierung", "universität", "student", "problem", "lösung", "veränderung", "wichtig", "verschieden", "besondere", "allgemein", "eigentlich", "möglichkeit", "beziehung", "kirche", "fenster", "kopfkissen", "zusammenhang", "wahrscheinlich", "geschwindigkeit", "angehörigkeit", "verantwortlichkeit", "versicherung", "krankenkasse", "einkommen", "niederschlag", "ausbildung", "arbeit", "leben", "liebe", "freude"],
  italian: ["generale", "stabilimento", "nazionale", "sviluppo", "impresa", "cooperazione", "possibilità", "decisione", "ricerca", "governo", "università", "studente", "problema", "soluzione", "cambiamento", "importanza", "diverso", "particolare", "metropolitana", "abbandonato", "attivo", "relazione", "produzione", "consumo", "posizione", "distinzione", "educazione", "attenzione", "informazione", "società", "qualità", "città", "attività", "facoltà", "libertà", "autorità", "popolazione", "costituzione", "evoluzione", "amore"],
  norwegian: ["jakt", "etter", "erobring", "tilbake", "arbeid", "smukk", "hjem", "leilighet", "barn", "regnskap", "utvikling", "bedrift", "samarbeid", "mulighet", "beslutning", "undersøkelse", "forbindelse", "utdanning", "interessant", "vanskelig", "viktig", "student", "forening", "kontor", "retning", "styrke", "ånd", "hus", "bil", "vei"],
  portuguese: ["normal", "estabelecimento", "nacional", "desenvolvimento", "empresa", "cooperação", "possibilidade", "decisão", "pesquisa", "governo", "universidade", "estudante", "problema", "solução", "mudança", "importância", "diferente", "particular", "pão", "irmão", "capitão", "alemão", "nação", "coração", "educação", "atenção", "informação", "sociedade", "qualidade", "cidade", "atividade", "faculdade", "liberdade", "autoridade", "população", "constituição", "evolução", "produção", "esperança", "importância"],
  romanian: ["general", "stabiliment", "naţional", "dezvoltare", "întreprindere", "cooperare", "posibilitate", "decizie", "cercetare", "guvern", "universitate", "student", "problemă", "soluţie", "schimbare", "importanţă", "diferit", "particular", "român", "limbă", "cultură", "istorie", "ţărăn", "copil", "om", "lume", "ziuă", "casă", "muncitor", "scriitor", "carte", "frumuseţi", "libertate", "activitate", "realizare", "iubire", "prieten", "bătrân", "tinereţ", "fericit"],
  russian: ["времени", "работа", "развитие", "компания", "возможность", "решение", "наука", "правительство", "университет", "студенты", "проблема", "изменение", "важность", "различный", "особенный", "общий", "действительно", "человек", "жизнь", "любовь", "счастье", "свобода", "деятельность", "образование", "производство", "экономика", "политика", "культура", "история", "молодость", "красота", "дружба", "надежда", "мечта", "цель", "задача", "вопрос", "ответ", "помощь", "поддержка"],
  spanish: ["normalmente", "establecimiento", "nacional", "desarrollo", "empresa", "cooperación", "posibilidad", "decisión", "investigación", "gobierno", "universidad", "estudiante", "problema", "solución", "cambio", "importancia", "diferente", "avión", "camión", "millón", "señor", "niño", "árbol", "corazón", "educación", "atención", "información", "sociedad", "calidad", "ciudad", "actividad", "facultad", "libertad", "autoridad", "población", "constitución", "evolución", "producción", "caminando", "comiéndoselo"],
  swedish: ["jakt", "efter", "erövring", "tillbaka", "arbete", "vacker", "hem", "lägenhet", "barn", "räkning", "utveckling", "företag", "samarbete", "möjlighet", "beslut", "undersökning", "förbindelse", "utbildning", "intressant", "svårighet", "viktighet", "student", "förening", "kontor", "riktning", "styrka", "anda", "hus", "bil", "väg"],
};

const SUFFIXES: Record<string, string[]> = {
  danish: ["", "erne", "erende", "endes", "hedens", "ethed", "erede", "heden", "heder", "ernes", "erets", "ered", "ende", "eren", "erer", "heds", "enes", "eres", "eret", "hed", "ene", "ere", "ens", "ers", "ets", "en", "er", "es", "et", "e", "s", "gd", "elig", "løst", "igst", "ig"],
  dutch: ["", "heden", "ene", "en", "se", "s", "e", "heid", "end", "ing", "ig", "lijk", "baar", "bar", "ste", "je", "tje", "pje", "kje"],
  english: ["", "s", "es", "ed", "ies", "ied", "sses", "us", "ss", "ing", "ingly", "edly", "eed", "eedly", "y", "i", "ational", "tional", "ization", "ations", "ator", "alism", "fulness", "ousness", "iveness", "tionally", "biliti", "lessli", "entli", "ation", "aliti", "ousli", "iviti", "fulli", "enci", "anci", "abli", "izer", "alli", "bli", "ogi", "li", "'s'", "'s", "'", "ate", "ive", "ize", "ion", "al", "er", "ic", "ement", "ance", "ence", "able", "ible", "ment", "ant", "ent", "ism", "iti", "ous", "ness", "ful"],
  french: ["", "ements", "ement", "amment", "emment", "ances", "ance", "ismes", "isme", "ables", "iste", "ateurs", "ateur", "ations", "ation", "logies", "logie", "usions", "ution", "ences", "ence", "euses", "euse", "ments", "ment", "ités", "ité", "ives", "ive", "ifs", "if", "eaux", "eux", "aux", "iqUes", "iqUe", "issaIent", "issantes", "eraIent", "assions", "erions", "aient", "ions", "ées", "ée", "és", "é", "ière", "ier", "e", "ë", "s", "ç"],
  german: ["", "ern", "em", "er", "en", "es", "e", "s", "est", "st", "isch", "lich", "heit", "keit", "end", "ung", "ig", "ik"],
  italian: ["", "azione", "azioni", "uzione", "uzioni", "usione", "usioni", "amento", "amenti", "imento", "imenti", "amente", "abile", "abili", "ibile", "ibili", "mente", "atore", "atori", "logia", "logie", "anza", "anze", "iche", "ichi", "ismo", "ismi", "ista", "iste", "isti", "istà", "ante", "anti", "enza", "enze", "ico", "ici", "ica", "ice", "oso", "osi", "osa", "ose", "ità", "ivo", "ivi", "iva", "ive", "erebbero", "irebbero", "assero", "assimo", "eranno", "erebbe", "eremmo", "ereste", "eresti", "essero", "iranno", "irebbe", "iremmo", "ireste", "iresti", "iscano", "iscono", "issero", "arono", "avamo", "avano", "avate", "eremo", "erete", "erono", "evamo", "evano", "evate", "iamo", "immo", "ano", "are", "ata", "ate", "ati", "ato", "ava", "avi", "avo", "erà", "ere", "erò", "ete", "eva", "evi", "evo", "irà", "ire", "irò", "ita", "ite", "iti", "ito", "ono", "uta", "ute", "uti", "uto", "ar", "ir", "gliela", "glielo", "sene", "mela", "meli", "tela", "cela", "vela", "gli", "ci", "la", "le", "lo", "mi", "ne", "si", "ti", "vi", "a", "e", "i", "o", "à", "è", "ì", "ò"],
  norwegian: ["", "hetenes", "hetene", "hetens", "heter", "heten", "endes", "ande", "ede", "anes", "enes", "erte", "ane", "ene", "ens", "ers", "ets", "het", "ast", "ert", "en", "ar", "er", "as", "es", "et", "a", "e", "s", "dt", "hetslov", "eleg", "elig", "elov", "slov", "leg", "eig", "lig", "els", "lov", "ig"],
  portuguese: ["", "amentos", "imento", "adora", "adores", "aça~o", "aço~es", "logias", "âncias", "ências", "amente", "idades", "anças", "ismos", "istas", "ante", "ância", "ência", "logia", "mente", "idade", "ança", "ezas", "icos", "icas", "ismo", "ável", "ível", "ista", "osos", "osas", "ador", "ivas", "ivos", "iras", "eza", "ico", "ica", "oso", "osa", "iva", "ivo", "ira", "aríamos", "ássemos", "aremos", "ariam", "arias", "ardes", "asses", "astes", "áreis", "áveis", "armos", "aria", "asse", "aste", "arei", "aram", "avam", "arem", "ando", "adas", "aras", "avas", "ares", "ados", "amos", "iras", "ada", "ará", "ara", "ava", "iam", "ado", "ias", "ais", "eis", "ia", "ei", "am", "em", "ar", "as", "eu", "iu", "ou", "os", "a", "i", "o", "á", "í", "ó", "e", "ç"],
  romanian: ["", "abilitate", "abilitati", "abilităţi", "ibilitate", "abilităi", "ivitate", "icitate", "icatori", "aţiune", "atoare", "ătoare", "iţiune", "itoare", "icator", "ativ", "atori", "itiv", "itori", "abila", "ibile", "abilă", "ibila", "atori", "itate", "itati", "ităţi", "abil", "ibil", "oasa", "oasă", "anta", "ante", "antă", "ităi", "iune", "iuni", "isme", "ista", "iste", "isti", "istă", "işti", "ata", "ată", "ati", "ate", "ita", "ită", "iti", "ite", "ica", "ice", "ici", "ică", "osi", "oşi", "ant", "iva", "ive", "ivi", "ivă", "ism", "ist", "at", "ut", "it", "ic", "os", "iv", "seserăţi", "aserăm", "iserăţi", "âserăm", "userăm", "serăţi", "seseşi", "seseră", "ească", "arăţi", "aseşi", "aseră", "iseşi", "âseşi", "useşi", "indu", "ându", "ează", "eşti", "eşte", "ăşti", "ăşte", "eaţi", "iaţi", "asem", "isem", "âsem", "usem", "seşi", "seră", "sese", "are", "ere", "ire", "âre", "ind", "ând", "eze", "ezi", "esc", "ăsc", "eam", "eai", "eau", "iam", "iai", "iau", "aşi", "ară", "uşi", "ură", "işi", "iră", "âşi", "âră", "ase", "ise", "âse", "use", "aţi", "eţi", "iţi", "âţi", "sei", "ez", "am", "ai", "au", "ea", "ia", "ui", "âi", "ăm", "em", "im", "âm", "se", "iilor", "ului", "elor", "iile", "ilor", "atei", "aţie", "aţia", "aua", "ele", "iua", "iei", "ile", "ul", "ea", "ii", "ie", "a", "e", "i", "ă"],
  russian: ["", "ами", "ях", "ям", "ию", "ья", "ий", "ем", "ом", "ам", "ом", "ью", "я", "а", "е", "и", "й", "о", "у", "ы", "ь", "ив", "ыв", "в", "вши", "шись", "ся", "сь", "ла", "на", "ло", "но", "ли", "ет", "ют", "ат", "ять", "овать", "ировать", "ост", "ость", "ейше", "ейш", "нн", "нный", "нная", "нное", "нные", "ющий", "ющая", "ющее", "ющие", "шегося", "ющему", "ющими", "ющийся", "щая", "щее", "щие", "вшего", "вшему", "вшие", "вшая", "вшее", "ший", "щая"],
  spanish: ["", "amiento", "imientos", "acion", "aciones", "uciones", "adoras", "adores", "ancias", "logías", "encias", "amente", "idades", "anzas", "ismos", "ables", "ibles", "istas", "adora", "ación", "antes", "ancia", "logía", "ución", "encia", "mente", "anza", "icos", "icas", "ismo", "able", "ible", "ista", "osos", "osas", "ador", "ante", "idad", "ivas", "ivos", "ico", "ica", "oso", "osa", "iva", "ivo", "yeron", "yendo", "yamos", "yan", "yas", "yó", "aríamos", "iéramos", "asteis", "ábamos", "arán", "ieran", "iendo", "ieron", "iera", "iese", "aste", "iste", "aban", "aran", "asen", "aron", "ando", "abas", "adas", "idos", "amos", "ará", "aré", "aba", "ada", "ara", "ase", "ado", "ías", "ía", "ad", "ed", "id", "an", "ió", "ar", "er", "ir", "as", "en", "es", "os", "a", "e", "o", "á", "é", "í", "ó"],
  swedish: ["", "heterna", "hetens", "heter", "heten", "anden", "arnas", "ernas", "ornas", "andes", "andet", "arens", "arna", "erna", "orna", "ande", "arne", "aste", "aren", "ades", "erns", "ade", "are", "ern", "ens", "het", "ast", "ad", "en", "ar", "er", "or", "as", "es", "at", "a", "e", "s", "dd", "gd", "nn", "dt", "gt", "kt", "tt", "fullt", "löst", "els", "lig", "ig"],
};

function buildWords(language: string): string[] {
  const bases = BASES[language] ?? [];
  const suffixes = SUFFIXES[language] ?? [""];
  const set = new Set<string>();
  for (const base of bases) {
    for (const suffix of suffixes) {
      set.add(base + suffix);
    }
  }
  return [...set];
}

function main() {
  const langWords: Record<string, string[]> = {};
  for (const language of SNOWBALL_LANGUAGES) {
    langWords[language] = buildWords(language);
  }

  const payload = JSON.stringify({ lang_words: langWords });
  const proc = Bun.spawnSync(["python3", "bench/python_snowball_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python snowball baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as Record<string, string[]>;

  const js: Record<string, string[]> = {};
  let wordCount = 0;
  for (const language of SNOWBALL_LANGUAGES) {
    js[language] = langWords[language]!.map((word) => snowballStem(word, language));
    wordCount += langWords[language]!.length;
  }

  const parity = JSON.stringify(js) === JSON.stringify(py);
  if (!parity) {
    for (const language of Object.keys(js)) {
      const j = js[language]!;
      const p = py[language]!;
      if (JSON.stringify(j) !== JSON.stringify(p)) {
        console.error(`snowball parity failed for ${language}`);
        for (let i = 0; i < j.length; i++) {
          if (j[i] !== p[i]) console.error(`  ${langWords[language]![i]}: js=${j[i]} py=${p[i]}`);
        }
      }
    }
    throw new Error("snowball parity failed");
  }

  console.log(
    JSON.stringify(
      {
        parity,
        languages: SNOWBALL_LANGUAGES.length,
        words: wordCount,
      },
      null,
      2,
    ),
  );
}

main();
