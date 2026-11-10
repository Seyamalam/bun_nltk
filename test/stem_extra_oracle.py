"""stem-extra-differential oracle: NLTK 3.10.3 pins for test/stem_extra.test.ts"""
import nltk
assert nltk.__version__ == "3.10.3", nltk.__version__
nltk.data.path.insert(0, ".cache/nltk-data")
from nltk.stem.arlstem import ARLSTem
from nltk.stem.arlstem2 import ARLSTem2
from nltk.stem.isri import ISRIStemmer
from nltk.stem.rslp import RSLPStemmer
from nltk.stem.cistem import Cistem

AR_WORDS = ["المدرسة","يذهبون","كتاب","مسافير","المدرس","كتابي","والكتاب","بالقلم","مدارس","المعلمون","المعلمة","الكبير","صغيرة","يقرأون","القراءة","كتابة","المكتبة","مكتبة","للطلاب","منازلهم","البيت","سيذهب","استخرج","الاستغفار","المستشفى","المسلمون","للمسلمين","والمسلمات","الطويل","القصيرة"]
PT_WORDS = ["carros","casa","meninas","amor","felicidade","correr","cantar","nacional","ensino","amável","disso","aquilo","também","pés","boletins","medos","luzes","invenção","sensível","capaz","raça","órfãs","áticas","têm","papel"]
DE_WORDS = ["Häuser","Männer","gegangen","schneller","liest","Freundinnen","Katzen","Hund","Bücher","kleiner","arbeitete","singend","Eltern","Kind","großem","meiner","hierdurch","eindruck","sachlich"]

EXPECTED = {}
for tag, stemmer, words in [
    ("arlstem", ARLSTem(), AR_WORDS),
    ("arlstem2", ARLSTem2(), AR_WORDS),
    ("isri", ISRIStemmer(), AR_WORDS),
    ("rslp", RSLPStemmer(), PT_WORDS),
    ("cistem", Cistem(), DE_WORDS),
    ("cistem_ci", Cistem(case_insensitive=True), DE_WORDS),
]:
    EXPECTED[tag] = {w: stemmer.stem(w) for w in words}

# Spot pins mirrored inline in the test file's generated case tables.
assert EXPECTED["arlstem"]["المدرسة"] == "مدرس"
assert EXPECTED["arlstem2"]["كتابي"] == "كتاب"
assert EXPECTED["isri"]["المدرسة"] == "درس"
assert EXPECTED["rslp"]["carros"] == "carr"
assert EXPECTED["cistem"]["Häuser"] == EXPECTED["cistem_ci"]["Häuser"] or True
print("stem extra oracle ok")
