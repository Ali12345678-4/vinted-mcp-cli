import http from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = process.env.PORT || 3000;
const MCP_API_KEY = process.env.MCP_API_KEY;

async function loadVintedApi() {
  try {
    const mod = await import("./dist/index.js");
    return mod;
  } catch (error) {
    console.error("Could not import ./dist/index.js", error);
    return {};
  }
}

function toText(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function isAuthorized(req) {
  if (!MCP_API_KEY) return true;

  const authHeader = req.headers.authorization || "";
  const apiKeyHeader = req.headers["x-api-key"] || "";

  if (authHeader === `Bearer ${MCP_API_KEY}`) return true;
  if (apiKeyHeader === MCP_API_KEY) return true;

  return false;
}

async function createServer() {
  const api = await loadVintedApi();

  const server = new McpServer({
    name: "vinted-remote",
    version: "1.1.4"
  });

  server.registerTool(
    "health_check",
    {
      title: "Health Check",
      description: "Check whether the Vinted MCP remote server is running.",
      inputSchema: {}
    },
    async () => {
      return {
        content: [{ type: "text", text: "ok" }],
        structuredContent: { ok: true }
      };
    }
  );

  server.registerTool(
    "search_items",
    {
      title: "Search Vinted Items",
      description: "Search Vinted listings by query and optional filters.",
      inputSchema: {
        query: z.string().min(1),
        country: z.string().optional(),
        page: z.number().int().positive().optional(),
        perPage: z.number().int().positive().max(100).optional(),
        brand: z.string().optional(),
        catalog: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional()
      }
    },
    async ({ query, country, page, perPage, brand, catalog, minPrice, maxPrice }) => {
      if (typeof api.searchItems !== "function") {
        return {
          content: [
            {
              type: "text",
              text: "searchItems is not exported from dist/index.js yet."
            }
          ]
        };
      }

      const result = await api.searchItems({
        query,
        country,
        page,
        perPage,
        brand,
        catalog,
        minPrice,
        maxPrice
      });

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: result
      };
    }
  );

  server.registerTool(
    "get_item",
    {
      title: "Get Vinted Item",
      description: "Get a single Vinted item by item ID.",
      inputSchema: {
        itemId: z.union([z.string(), z.number()])
      }
    },
    async ({ itemId }) => {
      if (typeof api.getItem !== "function") {
        return {
          content: [
            {
              type: "text",
              text: "getItem is not exported from dist/index.js yet."
            }
          ]
        };
      }

      const result = await api.getItem(itemId);

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: result
      };
    }
  );

  server.registerTool(
    "get_seller",
    {
      title: "Get Vinted Seller",
      description: "Get seller information by seller/member ID.",
      inputSchema: {
        sellerId: z.union([z.string(), z.number()])
      }
    },
    async ({ sellerId }) => {
      if (typeof api.getSeller !== "function") {
        return {
          content: [
            {
              type: "text",
              text: "getSeller is not exported from dist/index.js yet."
            }
          ]
        };
      }

      const result = await api.getSeller(sellerId);

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: result
      };
    }
  );

  server.registerTool(
    "compare_prices",
    {
      title: "Compare Vinted Prices",
      description: "Compare Vinted prices across countries for a search query.",
      inputSchema: {
        query: z.string().min(1),
        countries: z.array(z.string()).min(1)
      }
    },
    async ({ query, countries }) => {
      if (typeof api.comparePrices !== "function") {
        return {
          content: [
            {
              type: "text",
              text: "comparePrices is not exported from dist/index.js yet."
            }
          ]
        };
      }

      const result = await api.comparePrices({ query, countries });

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: result
      };
    }
  );

  server.registerTool(
    "get_trending",
    {
      title: "Get Trending Listings",
      description: "Fetch trending or popular Vinted listings for a country.",
      inputSchema: {
        country: z.string().optional()
      }
    },
    async ({ country }) => {
      if (typeof api.getTrending !== "function") {
        return {
          content: [
            {
              type: "text",
              text: "getTrending is not exported from dist/index.js yet."
            }
          ]
        };
      }

      const result = await api.getTrending({ country });

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: result
      };
    }
  );

  return server;
}

const transports = new Map();

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/mcp" && !isAuthorized(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    if (req.method === "GET") {
      const server = await createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });

      await server.connect(transport);

      if (transport.sessionId) {
        transports.set(transport.sessionId, { transport, server });
      }

      transport.onclose = async () => {
        if (transport.sessionId) transports.delete(transport.sessionId);
      };

      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "POST") {
      const sessionId = req.headers["mcp-session-id"];
      let entry = sessionId ? transports.get(sessionId) : undefined;

      if (!entry) {
        const server = await createServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID()
        });

        await server.connect(transport);

        if (transport.sessionId) {
          transports.set(transport.sessionId, { transport, server });
        }

        transport.onclose = async () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };

        entry = { transport, server };
      }

      await entry.transport.handleRequest(req, res);
      return;
    }

    if (req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"];

      if (sessionId && transports.has(sessionId)) {
        const entry = transports.get(sessionId);
        await entry.transport.close();
        transports.delete(sessionId);
      }

      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
  } catch (error) {
    console.error("MCP HTTP error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Internal server error",
        message: error?.message ?? String(error)
      })
    );
  }
});

httpServer.listen(PORT, () => {
  console.log(`Vinted MCP HTTP server listening on port ${PORT}`);
});