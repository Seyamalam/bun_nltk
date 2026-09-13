import { describe, expect, test } from "bun:test";
import { analyzeDocument, validateAnalysisRequest } from "../src/analyzer.js";
import { handleRequest } from "../src/http.js";

describe("document analyzer", () => {
  test("returns structured document, sentiment, n-gram, and sentence data", () => {
    const result = analyzeDocument({
      text: "The release is excellent! The setup is difficult, but the tools are fast.",
      ngramSize: 2,
      topK: 5,
    });

    expect(result.document.sentences).toBe(2);
    expect(result.document.tokens).toBeGreaterThan(8);
    expect(result.ngrams.size).toBe(2);
    expect(result.ngrams.mostCommon.length).toBeLessThanOrEqual(5);
    expect(result.keywords.some((row) => row.value === "release")).toBe(true);
    expect(result.sentences).toHaveLength(2);
  });

  test("rejects empty text and invalid options", () => {
    expect(() => validateAnalysisRequest({ text: "" })).toThrow("non-empty");
    expect(() => validateAnalysisRequest({ text: "valid", ngramSize: 8 })).toThrow("ngramSize");
  });
});

describe("HTTP API", () => {
  test("analyzes JSON requests", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "Fast local text analysis is great." }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.document.tokens).toBe(6);
    expect(body.meta.backend).toContain("bun_nltk");
  });

  test("returns useful validation errors", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });
});
