import{I}from"./chunk-hajjjdrj.js";var e=typeof process<"u"&&!!(process.versions?.node||process.versions?.bun),i=e?(await import("node:fs")).readFileSync:void 0,s=e?void 0:await I.init();function n(){let t=import.meta.url.includes("/dist/portable/")?"../../native/bun_nltk.wasm":"../native/bun_nltk.wasm";return s??=I.initSync(i(new URL(t,import.meta.url)))}
export{n};
