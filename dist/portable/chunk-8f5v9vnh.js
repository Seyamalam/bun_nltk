import{b}from"./chunk-er8dwpzv.js";var n=typeof process<"u"&&!!(process.versions?.node||process.versions?.bun),i=n?(await import("node:fs")).readFileSync:void 0,s=n?void 0:await b.init();function e(){let t=import.meta.url.includes("/dist/portable/")?"../../native/bun_nltk.wasm":"../native/bun_nltk.wasm";return s??=b.initSync(i(new URL(t,import.meta.url)))}
export{e};
