import { handleRequest } from "./http.js";

const port = Number(Bun.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const server = Bun.serve({
  port,
  fetch: handleRequest,
});

console.log(`bun_nltk document API listening on ${server.url}`);

