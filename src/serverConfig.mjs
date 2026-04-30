import { calculateMileageSubmission } from "./mileage.mjs";
import { getGoogleRouteMiles } from "./googleRoutes.mjs";
import { mondayIsConfigured } from "./monday.mjs";

const routeCache = new Map();

export async function calculateWithConfiguredProvider(payload) {
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

export function getClientConfig() {
  return {
    googleMapsBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || "",
    routesConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    mondayConfigured: mondayIsConfigured(),
    workplaceNames: getWorkplaceNames(),
    locationPresets: getLocationPresets()
  };
}

export function getWorkplaceNames() {
  const fallback = getLocationPresets()
    .map((location) => location.name)
    .join(",");
  const value = process.env.WORKPLACE_NAMES || fallback;
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function getLocationPresets() {
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
