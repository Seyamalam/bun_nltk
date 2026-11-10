import nltk
assert nltk.__version__ == "3.10.3"
from nltk.sentiment.vader import SentimentIntensityAnalyzer, SentiText, VaderConstants

sia = SentimentIntensityAnalyzer()
assert sia.polarity_scores("VADER is smart, handsome, and funny.") == \
    {"neg": 0.0, "neu": 0.254, "pos": 0.746, "compound": 0.8316}
assert sia.polarity_scores("VADER is VERY SMART, handsome, and FUNNY.") == \
    {"neg": 0.0, "neu": 0.246, "pos": 0.754, "compound": 0.9227}
assert sia.polarity_scores("The book was good.") == \
    {"neg": 0.0, "neu": 0.508, "pos": 0.492, "compound": 0.4404}
assert sia.polarity_scores("At least it isnt a horrible place.") == \
    {"neg": 0.0, "neu": 0.637, "pos": 0.363, "compound": 0.431}
assert sia.polarity_scores("Make sure you :) or D today") == \
    {"neg": 0.0, "neu": 0.43, "pos": 0.57, "compound": 0.6486}
st = SentiText("VADER is smart, handsome, and funny.", sia.constants.PUNC_LIST,
               sia.constants.REGEX_REMOVE_PUNCTUATION)
assert st.words_and_emoticons == ["VADER", "is", "smart", "handsome", "and", "funny"]
assert st.is_cap_diff is True
vc = VaderConstants()
assert [vc.negated(w.split()) for w in ["not good", "the least bad", "at least ok", "isnt fine"]] == \
    [True, True, False, True]
assert abs(vc.normalize(3.5) - 0.670478) < 1e-6
assert abs(vc.scalar_inc_dec("very", 1.0, True) - 0.293) < 1e-10
assert sia.score_valence([0.5, -1.2, 0, 0.9], "x y z") == \
    {"neg": 0.333, "neu": 0.152, "pos": 0.515, "compound": 0.0516}
assert sia.score_valence([], "") == {"neg": 0.0, "neu": 0.0, "pos": 0.0, "compound": 0.0}
sv = []
sia.sentiment_valence(0, st, "smart", 2, sv)
assert sv == [1.7]
assert sia.make_lex_dict()["good"] == 1.9
assert len(sia.lexicon) == 7502
