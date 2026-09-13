import { analyzeDocument, limits } from "./analyzer.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function json(value, status = 200) {
  return Response.json(value, { status, headers: jsonHeaders });
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new TypeError("content-type must be application/json");
  }
  try {
    return await request.json();
  } catch {
    throw new SyntaxError("request body is not valid JSON");
  }
}

function errorResponse(error) {
  const status = error instanceof RangeError ? 413 : error instanceof TypeError || error instanceof SyntaxError ? 400 : 500;
  return json(
    {
      error: {
        code: status === 413 ? "PAYLOAD_TOO_LARGE" : status === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected analysis failure",
      },
    },
    status,
  );
}

export async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true, package: "bun_nltk", limits });
  }

  if (request.method === "GET" && url.pathname === "/") {
    return json({
      name: "bun_nltk document analysis API",
      endpoints: {
        analyze: "POST /api/analyze",
        batch: "POST /api/batch",
        health: "GET /health",
      },
      example: {
        text: "The release is fast and reliable. Setup was difficult, but the result is excellent!",
        ngramSize: 2,
        topK: 10,
      },
    });
  }

  try {
    if (request.method === "POST" && url.pathname === "/api/analyze") {
      return json(analyzeDocument(await readJson(request)));
    }

    if (request.method === "POST" && url.pathname === "/api/batch") {
      const body = await readJson(request);
      if (!body || !Array.isArray(body.documents)) {
        throw new TypeError("documents must be an array");
      }
      if (body.documents.length === 0 || body.documents.length > limits.maxBatchItems) {
        throw new TypeError(`documents must contain between 1 and ${limits.maxBatchItems} items`);
      }
      return json({ results: body.documents.map((document) => analyzeDocument(document)) });
    }
  } catch (error) {
    return errorResponse(error);
  }

  return json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404);
}
