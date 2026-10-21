# Portable root declarations

`bun run build:portable` emits the Node and browser source graphs with the pinned
`tsrs` compiler, then links the **emitted declarations only** using pinned Rollup
and `rollup-plugin-dts`. The plugin's TypeScript dependency is used for declaration
syntax/linking, not source type inference or NLP implementation.

Multiple declaration entrypoints preserve private/nominal class identity across
the root, WASM, and classifier subpaths. Root declarations take their values from
their respective source roots, not a hand-maintained export list or an `any`
facade. Previously published classifier option types remain type-only exports;
browser runtime exports are not expanded.

The linker can lose a type-only alias to a value (currently `SnowballLanguages`).
`scripts/link-portable-types.mjs` uses tsrs's original module namespace to restore
export kinds and compares **all** original and linked export names, both values
and types. It runs under Node because the pinned tsrs synchronous API requires
Node child-process descriptors. Thus portable builds require Node as well as Bun.

Source declaration emit can use the repository's Bun types to check implementation
loading code. The published declaration-only graph has no Bun/Node imports or
ambient references. Consumer checks use `types: []`, `strict: true`,
`verbatimModuleSyntax: true`, and `skipLibCheck: false` with ESNext + DOM libraries.

## Verification

```sh
bun run build:portable
bun pm pack --ignore-scripts --destination /tmp/opencode
bun run verify:packaged-portable /tmp/opencode/bun_nltk-1.0.0.tgz
bun run package:size:check
```

The packaged verifier installs the tarball separately using npm and Bun. For each
installation it checks NodeNext, bundler/default, and bundler/browser resolution;
compile-time negative fixtures; an unsuppressed wrong-argument compilation that
must fail; every runtime root/subpath declaration export; namespace members; and
absence of root-level `any` values. Browser resolution is exercised through an
actual package-root browser bundle, not Node's earlier `node` export condition.
The existing packaged Node/Bun classifier/WASM runtime smoke assertions remain.
These are packaging/type contracts and runtime smoke checks, **not NLTK behavioral
parity evidence**.

The existing 400-file / 13,000,000-byte package limits are unchanged. Linking avoids
publishing hundreds of extra per-source declarations. The full precise Node root
adds about 248 KB over the former facades while retaining the same 263 packaged
implementation/data files (264 including this document). `dist/portable` is
build-owned and cleaned to prevent stale chunk leakage.

## Boundaries

This change does not improve NLP algorithms or implement external-tool stubs.
Declarations reflect existing APIs, including methods that throw and return
`never`. The existing probability factory's variadic `any[]` parameters are
source signatures, not generated root facades; tightening their generic contract
is separate API work. Raw TS subpaths such as `native`, `reference`, `wordnet`, and
`classify` are unchanged; only the portable root/WASM/feature-classifier packaging
is covered here.
