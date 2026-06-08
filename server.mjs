// server.mjs
import http from "node:http";
import { URL } from "node:url";
// If the project exports a server factory from dist/index.js, import it here.
// We'll wire the MCP logic in after we know what dist/index exposes.

// Basic HTTP MCP stub: responds OK on GET /health and 404 otherwise.
//
// Later we'll implement Streamable HTTP MCP per MCP spec, but this
// gets you something that can run on Railway with HTTPS in front.

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Placeholder: MCP endpoint (e.g. /mcp) to be implemented
  if (url.pathname === "/mcp") {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "MCP over HTTP not implemented yet" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Vinted MCP HTTP server listening on port ${PORT}`);
});