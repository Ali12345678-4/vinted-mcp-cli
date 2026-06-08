import http from "node:http";
import { URL } from "node:url";

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = process.env.PORT || 3000;
const MCP_API_KEY = process.env.MCP_API_KEY;

let _api = null;
async function loadVintedApi() {
  if (_api) return _api;
  try {
    _api = await import("./dist/index.js");
    return _api;
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
  const xApiKey = req.headers["x-api-key"] || "";
  const apiKey = req.headers["api-key"] || "";
  const apiKeyNoDash = req.headers["apikey"] || "";
  if (authHeader === `Bearer ${MCP_API_KEY}`) return true;
  if (authHeader === MCP_API_KEY) return true;
  if (xApiKey === MCP_API_KEY) return true;
  if (apiKey === MCP_API_KEY) return true;
  if (apiKeyNoDash === MCP_API_KEY) return true;
  return false;
}

async function getClient(country = "uk") {
  const api = await loadVintedApi();
  return new api.VintedClient({ country });
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
    async () => ({
      content: [{ type: "text", text: "ok" }],
      structuredContent: { ok: true }
    })
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
    async ({ query, country = "uk", page, perPage, brand, catalog, minPrice, maxPrice }) => {
      try {
        const client = await getClient(country);
        const result = await api.opSearch(client, {
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
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
  );

  server.registerTool(
    "get_item",
    {
      title: "Get Vinted Item",
      description: "Get a single Vinted item by item ID.",
      inputSchema: {
        itemId: z.union([z.string(), z.number()]),
        country: z.string().optional()
      }
    },
    async ({ itemId, country = "uk" }) => {
      try {
        const client = await getClient(country);
        const result = await api.opGetItem(client, { itemId });
        return {
          content: [{ type: "text", text: toText(result) }],
          structuredContent: result
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
  );

  server.registerTool(
    "get_seller",
    {
      title: "Get Vinted Seller",
      description: "Get seller information by seller/member ID.",
      inputSchema: {
        sellerId: z.union([z.string(), z.number()]),
        country: z.string().optional()
      }
    },
    async ({ sellerId, country = "uk" }) => {
      try {
        const client = await getClient(country);
        const result = await api.opGetSeller(client, { sellerId });
        return {
          content: [{ type: "text", text: toText(result) }],
          structuredContent: result
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
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
      try {
        const results = await Promise.all(
          countries.map(async (country) => {
            const client = await getClient(country);
            const result = await api.opSearch(client, { query, country, perPage: 20 });
            return { country, items: result.items };
          })
        );
        return {
          content: [{ type: "text", text: toText(results) }],
          structuredContent: results
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
  );

  server.registerTool(
    "get_trending",
    {
      title: "Get Trending Listings",
      description: "Fetch trending or popular Vinted listings for a country.",
      inputSchema: {
        country: z.string().optional(),
        limit: z.number().int().positive().optional()
      }
    },
    async ({ country = "uk", limit = 20 }) => {
      try {
        const client = await getClient(country);
        const result = await api.opTrending(client, { country, limit });
        return {
          content: [{ type: "text", text: toText(result) }],
          structuredContent: result
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
  );

  return server;
}

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

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const server = await createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("MCP HTTP error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Internal server error",
      message: error?.message ?? String(error)
    }));
  }
});

httpServer.listen(PORT, () => {
  console.log(`Vinted MCP HTTP server listening on port ${PORT}`);
});