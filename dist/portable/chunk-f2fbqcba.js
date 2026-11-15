import{k}from"./chunk-pzf4bdrz.js";var n=typeof process<"u"&&!!(process.versions?.node||process.versions?.bun),i=n?(await import("node:fs")).readFileSync:void 0,s=n?void 0:await k.init();function t(){let e=import.meta.url.includes("/dist/portable/")?"../../native/bun_nltk.wasm":"../native/bun_nltk.wasm";return s??=k.initSync(i(new URL(e,import.meta.url)))}
export{t};
