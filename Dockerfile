# bun_nltk — reproducible container
#
# Builds the Rust native library, installs JS deps, and runs the full test
# suite as the default command. Python (with nltk) is included so the
# parity baselines can run too.
#
#   docker build -t bun_nltk .
#   docker run --rm bun_nltk

FROM oven/bun:1 AS js-base

FROM rust:1-slim AS rust-build
WORKDIR /app
COPY rust/ ./rust/
RUN cd rust && cargo build --release

FROM oven/bun:1
# Python 3 + build tooling for parity baselines and native builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv clang libclang-dev build-essential \
  && rm -rf /var/lib/apt/lists/*
# Rust toolchain for build:rust
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
COPY --from=rust:1-slim /usr/local/rustup /usr/local/rustup
COPY --from=rust:1-slim /usr/local/cargo /usr/local/cargo

WORKDIR /app
COPY --from=js-base /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY bench/ ./bench/
COPY test/ ./test/
COPY index.ts ./
COPY rust/ ./rust/

RUN bun install --frozen-lockfile \
  && python3 -m pip install --break-system-packages nltk numpy scipy \
  && bun run build:rust

CMD ["bun", "test"]
