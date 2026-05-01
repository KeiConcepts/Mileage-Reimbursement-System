import test from "node:test";
import assert from "node:assert/strict";
import { getGoogleRouteMiles } from "../src/googleRoutes.mjs";

test("Google Routes requests avoid toll roads", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;

  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        routes: [{ distanceMeters: 1609.344 }]
      })
    };
  };

  try {
    const miles = await getGoogleRouteMiles(["17011 Beach Blvd, Huntington Beach, CA", "16161 Brookhurst St, Fountain Valley, CA"], "test-key");

    assert.equal(miles, 1);
    assert.deepEqual(requestBody.routeModifiers, { avoidTolls: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
