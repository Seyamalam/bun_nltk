import {
  computeAsciiMetrics as computeJsMetrics,
  normalizeTokensAscii,
  tokenizeAscii as tokenizeJs,
} from "bun_nltk/reference";
import "./styles.css";
import { WasmNltk } from "bun_nltk/wasm";

const encoder = new TextEncoder();
async function instantiateWasm() {
  const wasmUrl = `${import.meta.env.BASE_URL}bun_nltk.wasm`;
  return WasmNltk.init({ wasmUrl });
}

function createAnalyzer(wasm) {
  function analyze(text, n) {
    const started = performance.now();
    return {
      ...wasm.computeAsciiMetrics(text, n),
      tokenList: wasm.tokenizeAscii(text),
      sentenceList: wasm.sentenceTokenizePunktAscii(text),
      elapsedMs: performance.now() - started,
    };
  }

  function benchmark(text, n, rounds) {
    for (let index = 0; index < 5; index += 1) wasm.computeAsciiMetrics(text, n);
    const started = performance.now();
    for (let index = 0; index < rounds; index += 1) wasm.computeAsciiMetrics(text, n);
    return (performance.now() - started) / rounds;
  }

  window.addEventListener("pagehide", () => wasm.dispose(), { once: true });
  return { analyze, benchmark, inputCapacity: 128 * 1024 * 1024 };
}

function rankedTerms(tokens, limit = 12) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([leftToken, leftCount], [rightToken, rightCount]) => rightCount - leftCount || leftToken.localeCompare(rightToken))
    .slice(0, limit)
    .map(([token, count]) => ({ token, count }));
}

function benchmarkReference(text, n, rounds) {
  for (let index = 0; index < 5; index += 1) computeJsMetrics(text, n);
  const started = performance.now();
  for (let index = 0; index < rounds; index += 1) computeJsMetrics(text, n);
  return (performance.now() - started) / rounds;
}

const elements = {
  form: document.querySelector("#analyzer-form"),
  source: document.querySelector("#source-text"),
  ngramSize: document.querySelector("#ngram-size"),
  rounds: document.querySelector("#benchmark-rounds"),
  analyze: document.querySelector("#analyze-button"),
  benchmark: document.querySelector("#benchmark-button"),
  export: document.querySelector("#export-button"),
  fileInput: document.querySelector("#file-input"),
  fileDrop: document.querySelector("#file-drop"),
  fileName: document.querySelector("#file-name"),
  search: document.querySelector("#token-search"),
  error: document.querySelector("#error-message"),
  tokenTape: document.querySelector("#token-tape"),
  frequencyList: document.querySelector("#frequency-list"),
  sentenceList: document.querySelector("#sentence-list"),
};

let analyzer;
let currentReport;

function setText(selector, value) {
  document.querySelector(selector).textContent = String(value);
}

function showError(error) {
  elements.error.textContent = error instanceof Error ? error.message : String(error);
  elements.error.hidden = false;
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
}

function invalidateReport() {
  currentReport = undefined;
  elements.export.disabled = true;
  setText("#parity-status", "Analyze to refresh");
  document.querySelector("#parity-status").className = "";
  setText("#speedup", "Not run");
}

function updateDocumentSize() {
  setText("#document-size", `${encoder.encode(elements.source.value).length.toLocaleString()} bytes`);
}

function renderTokens(tokens, query = "") {
  const needle = query.trim().toLowerCase();
  const indexedTokens = tokens.map((token, index) => ({ token, index }));
  const matches = needle ? indexedTokens.filter(({ token }) => token.includes(needle)) : indexedTokens;
  elements.tokenTape.replaceChildren();

  if (matches.length === 0) {
    const placeholder = document.createElement("span");
    placeholder.className = "token-placeholder";
    placeholder.textContent = tokens.length === 0 ? "No ASCII tokens found." : `No tokens match “${query}”.`;
    elements.tokenTape.append(placeholder);
  } else {
    for (const { token, index } of matches) {
      const chip = document.createElement("span");
      chip.className = "token-chip";
      const position = document.createElement("small");
      position.textContent = String(index + 1).padStart(2, "0");
      const value = document.createElement("span");
      value.textContent = token;
      chip.append(position, value);
      elements.tokenTape.append(chip);
    }
  }

  setText("#token-match-count", needle ? `${matches.length} of ${tokens.length} tokens match.` : `${tokens.length} tokens in source order.`);
  elements.tokenTape.classList.remove("refreshed");
  requestAnimationFrame(() => elements.tokenTape.classList.add("refreshed"));
}

function renderFrequencies(terms) {
  elements.frequencyList.replaceChildren();
  if (terms.length === 0) {
    const row = document.createElement("li");
    row.className = "empty-row";
    row.textContent = "No terms to rank.";
    elements.frequencyList.append(row);
    return;
  }

  const maximum = terms[0].count;
  for (const { token, count } of terms) {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = token;
    const bar = document.createElement("span");
    bar.className = "frequency-bar";
    bar.style.setProperty("--frequency", `${(count / maximum) * 100}%`);
    const value = document.createElement("strong");
    value.textContent = String(count);
    row.append(label, bar, value);
    elements.frequencyList.append(row);
  }
}

function renderSentences(sentences) {
  elements.sentenceList.replaceChildren();
  setText("#sentence-summary", `${sentences.length} boundaries`);
  if (sentences.length === 0) {
    const row = document.createElement("li");
    row.className = "empty-row";
    row.textContent = "No sentences found.";
    elements.sentenceList.append(row);
    return;
  }

  for (const [index, sentence] of sentences.entries()) {
    const row = document.createElement("li");
    const number = document.createElement("span");
    number.className = "sentence-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const text = document.createElement("p");
    text.textContent = sentence;
    const count = document.createElement("small");
    count.textContent = `${tokenizeJs(sentence).length} tokens`;
    row.append(number, text, count);
    elements.sentenceList.append(row);
  }
}

function runAnalysis() {
  if (!analyzer) return;
  clearError();
  invalidateReport();
  const text = elements.source.value;
  const n = Number(elements.ngramSize.value);
  try {
    const wasm = analyzer.analyze(text, n);
    const jsStarted = performance.now();
    const js = computeJsMetrics(text, n);
    const jsElapsedMs = performance.now() - jsStarted;
    const parity = ["tokens", "uniqueTokens", "ngrams", "uniqueNgrams"].every((key) => wasm[key] === js[key]);
    const terms = rankedTerms(normalizeTokensAscii(text, true));

    currentReport = {
      generatedAt: new Date().toISOString(),
      source: { bytes: encoder.encode(text).length, text },
      options: { ngramSize: n },
      metrics: {
        tokens: wasm.tokens,
        uniqueTokens: wasm.uniqueTokens,
        ngrams: wasm.ngrams,
        uniqueNgrams: wasm.uniqueNgrams,
        sentences: wasm.sentenceList.length,
        lexicalDiversity: wasm.tokens === 0 ? 0 : wasm.uniqueTokens / wasm.tokens,
      },
      parity: { matched: parity, wasm: { ...wasm, tokenList: undefined, sentenceList: undefined }, js },
      timing: { wasmMs: wasm.elapsedMs, jsMs: jsElapsedMs },
      topTerms: terms,
      tokens: wasm.tokenList,
      sentences: wasm.sentenceList,
    };

    setText("#token-count", wasm.tokens);
    setText("#unique-count", wasm.uniqueTokens);
    setText("#ngram-count", wasm.ngrams);
    setText("#unique-ngram-count", wasm.uniqueNgrams);
    setText("#sentence-count", wasm.sentenceList.length);
    setText("#lexical-diversity", wasm.tokens === 0 ? "0%" : `${((wasm.uniqueTokens / wasm.tokens) * 100).toFixed(1)}%`);
    setText("#wasm-time", `${wasm.elapsedMs.toFixed(3)} ms`);
    setText("#js-time", `${jsElapsedMs.toFixed(3)} ms`);
    setText("#parity-status", parity ? "JS/WASM match" : "Parity mismatch");
    document.querySelector("#parity-status").className = parity ? "parity-pass" : "parity-fail";
    setText("#ngram-label", n === 2 ? "Bigrams" : n === 3 ? "Trigrams" : "Four-grams");
    setText("#speedup", "Not run");

    renderTokens(wasm.tokenList, elements.search.value);
    renderFrequencies(terms);
    renderSentences(wasm.sentenceList);
    elements.export.disabled = false;
    return currentReport;
  } catch (error) {
    showError(error);
  }
}

async function runBenchmark() {
  if (!analyzer || !elements.source.value) return;
  clearError();
  elements.benchmark.disabled = true;
  setText("#speedup", "Running…");
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    const report = runAnalysis();
    if (!report) {
      setText("#speedup", "Failed");
      return;
    }
    const text = report.source.text;
    const n = report.options.ngramSize;
    const rounds = Number(elements.rounds.value);
    const wasmMs = analyzer.benchmark(text, n, rounds);
    const jsMs = benchmarkReference(text, n, rounds);
    const ratio = wasmMs > 0 && jsMs > 0 ? jsMs / wasmMs : null;
    setText("#benchmark-label", `${rounds}-run comparison`);
    setText("#speedup", ratio === null ? "Below timer resolution" : ratio >= 1 ? `${ratio.toFixed(2)}× faster WASM` : `${(1 / ratio).toFixed(2)}× faster JS`);
    report.benchmark = { rounds, wasmMeanMs: wasmMs, jsMeanMs: jsMs, wasmSpeedup: ratio };
  } catch (error) {
    showError(error);
    setText("#speedup", "Failed");
  } finally {
    elements.benchmark.disabled = false;
  }
}

async function importFile(file) {
  if (!file) return;
  clearError();
  try {
    if (!analyzer) throw new Error("Wait for WASM to finish loading before importing a file.");
    if (file.size > analyzer.inputCapacity) {
      throw new Error(`“${file.name}” is larger than the ${analyzer.inputCapacity.toLocaleString()} byte WASM input limit.`);
    }
    const text = await file.text();
    if (encoder.encode(text).length > analyzer.inputCapacity) {
      throw new Error(`“${file.name}” is larger than the ${analyzer.inputCapacity.toLocaleString()} byte WASM input limit.`);
    }
    elements.source.value = text;
    elements.fileName.textContent = `${file.name} · ${file.size.toLocaleString()} bytes`;
    updateDocumentSize();
    runAnalysis();
  } catch (error) {
    showError(error);
  }
}

function exportReport() {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bun-nltk-report-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runAnalysis();
});
elements.benchmark.addEventListener("click", runBenchmark);
elements.export.addEventListener("click", exportReport);
elements.source.addEventListener("input", () => {
  updateDocumentSize();
  invalidateReport();
});
elements.ngramSize.addEventListener("change", runAnalysis);
elements.search.addEventListener("input", () => currentReport && renderTokens(currentReport.tokens, elements.search.value));
elements.fileInput.addEventListener("change", () => importFile(elements.fileInput.files?.[0]));
for (const eventName of ["dragenter", "dragover"]) {
  elements.fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.fileDrop.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  elements.fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.fileDrop.classList.remove("dragging");
  });
}
elements.fileDrop.addEventListener("drop", (event) => importFile(event.dataTransfer?.files?.[0]));
updateDocumentSize();

try {
  analyzer = createAnalyzer(await instantiateWasm());
  setText("#runtime-status", "WASM ready");
  document.querySelector(".runtime-state").classList.add("ready");
  elements.analyze.disabled = false;
  elements.benchmark.disabled = false;
  runAnalysis();
} catch (error) {
  setText("#runtime-status", "WASM failed to load");
  document.querySelector(".runtime-state").classList.add("failed");
  showError(error);
}
