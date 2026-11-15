import{P}from"./chunk-75d1pt02.js";var n=typeof process<"u"&&!!(process.versions?.node||process.versions?.bun),t=n?(await import("node:fs")).readFileSync:void 0,s=n?void 0:await P.init();function i(){let e=import.meta.url.includes("/dist/portable/")?"../../native/bun_nltk.wasm":"../native/bun_nltk.wasm";return s??=P.initSync(t(new URL(e,import.meta.url)))}
export{i};
