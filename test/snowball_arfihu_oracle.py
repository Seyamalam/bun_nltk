"""Pinned NLTK 3.10.3 oracle for the Arabic/Finnish/Hungarian Snowball stemmers.

Regenerate the expected tables in test/snowball_arfihu.test.ts with:

    NLTK_DATA=$PWD/.cache/nltk-data .venv/bin/python3 test/snowball_arfihu_oracle.py
"""

import nltk
from nltk.stem.snowball import (
    ArabicStemmer,
    FinnishStemmer,
    HungarianStemmer,
    SnowballStemmer,
)

assert nltk.__version__ == "3.10.3", nltk.__version__

WORDS = {
    "arabic": (
        "الكتاب المكتبة كتب يكتب الطلاب معلمات سيذهب تستعملون بالبيت كالرجل "
        "والمكتبات فالكتاب مكة إن هذا الذي ببعضهم ككم سياسة تفاحة مستشفى "
        "المدارس كم كما علماً استطاعوا المدرسة المعلمون يكتبون سيكتب نستطيع "
        "التجربة وكالة البنات لاعبون مشكلة السعادة تقدمت انطلقت المعرفة "
        "استعملها القاهرة فلسطين الصحافة تحياتي"
    ).split(),
    "finnish": (
        "taloissa talon taloja kirjani kirjasi kirjamme koirassa lapsille "
        "nähdä juokseminen kauneimpi hyvin menemme ollaan tulee sanottu "
        "tietokone ystävällisesti kävellä koirat kissanpentujen autossani "
        "taloillenne juoksentelisit tyttöjen vaikeudessa kirjoittamalla "
        "opiskelijat mieluummin aikaisemmin suomalaisuudesta ystävyyttä "
        "menivätkin tullessaan olemattomuus päivällinen keskusteleminen "
        "todennäköisesti ilmeisesti keltaisessa"
    ).split(),
    "hungarian": (
        "abroncsokkal álmok almában barátaim házakban könyveket szeretem "
        "beszélgetés embernek játszottam legjobb folyóiratok visszük "
        "orvoshoz képeket asztal szék kutya macska ember házzal várjuk "
        "könyv gyalogosoknak tanították elmondhatatlan közlemények "
        "beszélgetéseinkben megérkezésükkor virágokkal társaságokban "
        "előadásokat szemüvegeim felfedezése hálószobáink ajándékokat "
        "kocsijaim gondolkodásuk hallgatóink munkásokkal személyzetünk "
        "felfedezőink vízcseppek"
    ).split(),
}

STEMMERS = {
    "arabic": ArabicStemmer,
    "finnish": FinnishStemmer,
    "hungarian": HungarianStemmer,
}


def main() -> None:
    for language, stemmer_cls in STEMMERS.items():
        stemmer = stemmer_cls()
        for word in WORDS[language]:
            print(f"{language}\t{word}\t{stemmer.stem(word)}")

    sw_ar = SnowballStemmer("arabic", ignore_stopwords=True)
    assert sw_ar.stem("هذا") == "هذا"
    assert sw_ar.stem("هَذَا") == "هذا"  # checked post-normalization
    sw_fi = SnowballStemmer("finnish", ignore_stopwords=True)
    assert sw_fi.stem("aika") == "aika"
    assert sw_fi.stem("taloissa") == "talo"
    assert " ".join(SnowballStemmer.languages) == (
        "arabic danish dutch english finnish french german hungarian "
        "italian norwegian porter portuguese romanian russian spanish swedish"
    )


if __name__ == "__main__":
    main()
