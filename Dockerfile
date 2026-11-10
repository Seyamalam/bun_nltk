# bun_nltk — reproducible container
#
# Builds the Rust native library, installs JS deps, and runs the full test
# suite as the default command. Python (with nltk) is included so the
# parity baselines can run too.
#
#   docker build -t bun_nltk .
#   docker run --rm bun_nltk

FROM python:3.14.4-slim-trixie AS py-oracle

FROM oven/bun:1
# Build tooling for native builds; git for provenance tests
RUN apt-get update && apt-get install -y --no-install-recommends \
    clang libclang-dev build-essential git \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/opencode
# Pinned oracle interpreter: parity tests assert Python 3.14.4 exactly
COPY --from=py-oracle /usr/local /usr/local
# Rust toolchain for build:rust
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
COPY --from=rust:1-slim /usr/local/rustup /usr/local/rustup
COPY --from=rust:1-slim /usr/local/cargo /usr/local/cargo

WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY bench/ ./bench/
COPY test/ ./test/
COPY index.ts ./
COPY rust/ ./rust/
COPY native/ ./native/
COPY models/ ./models/
COPY corpora/ ./corpora/
COPY compatibility/ ./compatibility/
COPY dist/ ./dist/

RUN bun install --frozen-lockfile \
  && python3 -m pip install --break-system-packages nltk==3.10.3 regex==2026.9.29 numpy scipy \
  && bun run build:rust

# Checksum-locked NLTK resources for parity oracles (mirrors NLTK_DATA contract)
ENV NLTK_DATA=/opt/nltk-data
RUN python3 scripts/nltk-resources.py prepare --data-dir "$NLTK_DATA" \
      --resources treebank,movie_reviews,brown,punkt_tab,averaged_perceptron_tagger_eng,vader_lexicon,maxent_ne_chunker_tab,words,wordnet,wordnet_ic,stopwords

CMD ["bun", "test"]
