import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { calculateMileageSubmission } from "./src/mileage.mjs";
import { getGoogleRouteMiles } from "./src/googleRoutes.mjs";
import { mondayIsConfigured, submitMileageToMonday } from "./src/monday.mjs";

const root = process.cwd();
const publicDir = join(root, "public");
loadDotEnv();

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const routeCache = new Map();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/config") {
      return sendJson(response, getClientConfig());
    }

    if (request.method === "POST" && url.pathname === "/api/calculate") {
      const payload = await readJson(request);
      const calculation = await calculateWithConfiguredProvider(payload);
      return sendJson(response, { calculation });
    }

    if (request.method === "POST" && url.pathname === "/api/submit") {
      const payload = await readJson(request);
      const calculation = await calculateWithConfiguredProvider(payload);
      const item = await submitMileageToMonday(payload, calculation);
      return sendJson(response, { item, calculation });
    }

    if (request.method === "GET") {
      return serveStatic(url.pathname, response);
    }

    sendJson(response, { error: "Not found" }, 404);
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, { error: error.message || "Unexpected server error" }, status);
  }
});

server.listen(port, host, () => {
  console.log(`Mileage reimbursement tool running at http://${host}:${port}`);
});

async function calculateWithConfiguredProvider(payload) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const provider = apiKey
    ? async (addresses) => {
        const key = addresses.join("||").toLowerCase();
        if (!routeCache.has(key)) {
          routeCache.set(key, getGoogleRouteMiles(addresses, apiKey));
        }
        return routeCache.get(key);
      }
    : null;

  return calculateMileageSubmission(payload, provider);
}

function getClientConfig() {
  return {
    googleMapsBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || "",
    routesConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    mondayConfigured: mondayIsConfigured(),
    workplaceNames: getWorkplaceNames(),
    locationPresets: getLocationPresets()
  };
}

function getWorkplaceNames() {
  const fallback = getLocationPresets()
    .map((location) => location.name)
    .join(",");
  const value = process.env.WORKPLACE_NAMES || fallback;
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function getLocationPresets() {
  if (process.env.LOCATION_PRESETS_JSON) {
    try {
      const parsed = JSON.parse(process.env.LOCATION_PRESETS_JSON);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((location) => location?.name && location?.address)
          .map((location) => ({
            name: String(location.name),
            address: String(location.address)
          }));
      }
    } catch {
      console.warn("LOCATION_PRESETS_JSON is not valid JSON. Using default location presets.");
    }
  }

  return [
    { name: "KEI HQ", address: "17011 Beach Blvd Unit 676, Huntington Beach, CA 92647" },
    { name: "VOX FV", address: "16161 Brookhurst St, Fountain Valley, CA 92708" },
    { name: "VOX SCP", address: "3333 Bear St #118, Costa Mesa, CA 92626" },
    { name: "SUP BP", address: "5141 Beach Blvd Unit B, Buena Park, CA 90621" },
    { name: "SUP IR", address: "14370 Culver Dr Unit 2H, Irvine, CA 92604" }
  ];
}

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const normalizedPath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    return sendJson(response, { error: "Forbidden" }, 403);
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    response.end(file);
  } catch {
    sendJson(response, { error: "Not found" }, 404);
  }
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

function contentType(filePath) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  return types[extname(filePath)] || "application/octet-stream";
}

function loadDotEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
