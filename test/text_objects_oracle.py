"""Oracle for TokenSearcher/TextCollection (NLTK 3.10.3)."""
from nltk.text import TokenSearcher, TextCollection
t = TokenSearcher(["the","quick","brown","fox","jumps","over","the","lazy","dog"])
print(t.findall("<a> (<.*>)"))
print(t.findall("<the> (<.*>)"))
tc = TextCollection([["the","quick","fox"],["the","lazy","dog"],["fox","runs","the","marathon"]])
print(tc.tf("the", ["the","quick","fox"]), tc.idf("the"), tc.idf("fox"))
