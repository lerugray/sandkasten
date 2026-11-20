#!/usr/bin/env node
// Minimal static file server for the exported out/ directory. Serves directory
// index.html for clean URLs (/play -> play/index.html, /play/ -> play/index.html),
// keeps query strings untouched, and falls back to 404.html. Used to verify the
// release export on a host without `npx serve`.
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out"));
const port = Number(process.env.SAND_E2E_PORT ?? process.argv[3] ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webm": "video/webm",
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const rel = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const candidates = [];
  if (rel.endsWith("/")) {
    candidates.push(path.join(rel, "index.html"));
  } else {
    candidates.push(path.join(rel, "index.html"));
    candidates.push(`${rel}.html`);
    candidates.push(rel);
  }
  for (const c of candidates) {
    const abs = path.join(root, c);
    if (!abs.startsWith(root)) continue;
    try {
      if (existsSync(abs) && statSync(abs).isFile()) return abs;
    } catch {
      /* keep looking */
    }
  }
  const notFound = path.join(root, "404.html");
  return existsSync(notFound) ? notFound : null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url ?? "/");
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(file.endsWith("404.html") ? 404 : 200, {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`static ${root} on http://127.0.0.1:${port}`);
});
