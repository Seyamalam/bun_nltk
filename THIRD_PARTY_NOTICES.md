# Third-party notices

## NLTK algorithm ports

Punkt training/inference, Treebank tokenization, VADER rules, and named-entity
feature extraction/inference, categorical Naive Bayes, IIS maximum entropy,
decision-tree training, and language-model smoothing are adapted from NLTK 3.10.3, copyright 2001–2026
NLTK Project, under Apache License 2.0 (see LICENSE). NLTK contributors include
Tibor Kiss, Jan Strunk, Joel Nothman, Edward Loper, Steven Bird, C. J. Hutto,
Ewan Klein, Pierpaolo Pantone, and Eric Kafe.

Source: https://github.com/nltk/nltk/tree/3.10.3/nltk

## Model data

`scripts/export-nltk-models.py` exports the full NLTK VADER lexicon, English Punkt
parameters, and binary/multiclass maximum-entropy NE models into JSON without
pickle. `models/nltk-models.manifest.json` pins SHA-256 digests and NLTK version.
The NE assets are loaded lazily from gzip files on Bun/Node; Python and network
access are unnecessary at runtime.

- VADER lexicon: C. J. Hutto, MIT license reproduced below. Reference: Hutto,
  C. J. & Gilbert, E. E. (2014), *VADER: A Parsimonious Rule-based Model for
  Sentiment Analysis of Social Media Text*, ICWSM-14.
- English Punkt model: contributed by Jan Strunk / Tibor Kiss, trained on Wall
  Street Journal text. Reference: Kiss & Strunk (2006), *Unsupervised Multilingual
  Sentence Boundary Detection*, Computational Linguistics 32:485–525.
- Maximum-entropy NE model: NLTK ACE Named Entity Chunker (`maxent_ne_chunker_tab`).
- NE basic-English word list: C. K. Ogden, *The ABC of Basic English* (1932),
  distributed in NLTK's `words` package, whose index labels it public domain.

Upstream NLTK Data does not specify a separate license for the Punkt and NE
model packages. The repository's Apache license must not be read as an explicit
license grant for those datasets. See the upstream package metadata and license
inventory:
https://github.com/nltk/nltk_data/blob/gh-pages/DATASET-LICENSES.md
https://github.com/nltk/nltk_data/blob/gh-pages/index.xml

## Differential test excerpts (excluded from the npm package)

Fixtures use public-domain texts by Jane Austen, Lewis Carroll, and Herman
Melville from NLTK's Gutenberg corpus, and excerpts from the Brown Corpus.
Brown Corpus: W. N. Francis and H. Kucera (1964), Department of Linguistics,
Brown University; revised 1971 and 1979. Its distributed README states:
“Distributed with the permission of the copyright holder, redistribution permitted.”
Fixtures also contain synthetic text and NLTK-generated predictions. They do
not contain Penn Treebank excerpts. These data retain their source terms.

## VADER MIT license

The MIT License (MIT)

Copyright (c) 2016 C.J. Hutto

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.