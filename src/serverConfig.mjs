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
            address: String(location.address),
            mondayLabel: location.mondayLabel ? String(location.mondayLabel) : String(location.name),
            aliases: Array.isArray(location.aliases) ? location.aliases.map((alias) => String(alias)) : []
          }));
      }
    } catch {
      console.warn("LOCATION_PRESETS_JSON is not valid JSON. Using default location presets.");
    }
  }

  return [
    { name: "KEI HQ", address: "17011 Beach Blvd Unit 676, Huntington Beach, CA 92647", mondayLabel: "KEI HQ" },
    { name: "VOX Fountain Valley", address: "16161 Brookhurst St, Fountain Valley, CA 92708", mondayLabel: "VOX FV", aliases: ["VOX FV"] },
    { name: "VOX South Coast Plaza", address: "3333 Bear St #118, Costa Mesa, CA 92626", mondayLabel: "VOX SCP", aliases: ["VOX SCP"] },
    { name: "SUP Buena Park", address: "5141 Beach Blvd Unit B, Buena Park, CA 90621", mondayLabel: "SUP BP", aliases: ["SUP BP"] },
    { name: "SUP Irvine", address: "14370 Culver Dr Unit 2H, Irvine, CA 92604", mondayLabel: "SUP IR", aliases: ["SUP IR"] },
    { name: "NEP Irvine", address: "14346 Culver Dr, Irvine, CA 92604", mondayLabel: "NEP IR" },
    { name: "NEP Fountain Valley", address: "10836 Warner Ave, Fountain Valley, CA 92708", mondayLabel: "NEP FV" },
    { name: "ROL Fountain Valley", address: "16173 Brookhurst St, Fountain Valley, CA 92708", mondayLabel: "ROL FV" },
    { name: "ROL Irvine", address: "14370 Culver Dr Suite 2G, Irvine, CA 92604", mondayLabel: "ROL IR" },
    { name: "KIN", address: "16185 Brookhurst St, Fountain Valley, CA 92708", mondayLabel: "KIN" },
    { name: "Qua", address: "16121 Brookhurst St, Fountain Valley, CA 92708", mondayLabel: "QUA" },
    { name: "Kei Coffee House", address: "15691 Brookhurst St, Westminster, CA 92683", mondayLabel: "KCH" }
  ];
}
