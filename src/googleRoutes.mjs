import { metersToMiles } from "./mileage.mjs";

const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

export async function getGoogleRouteMiles(addresses, apiKey) {
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  }

  const cleaned = addresses.map((address) => String(address || "").trim()).filter(Boolean);
  if (cleaned.length < 2) return 0;

  const response = await fetch(ROUTES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration"
    },
    body: JSON.stringify({
      origin: { address: cleaned[0] },
      destination: { address: cleaned[cleaned.length - 1] },
      intermediates: cleaned.slice(1, -1).map((address) => ({ address })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      routeModifiers: {
        avoidTolls: true
      },
      units: "IMPERIAL"
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || response.statusText;
    throw new Error(`Google Routes request failed: ${detail}`);
  }

  const distanceMeters = body?.routes?.[0]?.distanceMeters;
  if (!Number.isFinite(distanceMeters)) {
    throw new Error("Google Routes did not return a route distance.");
  }

  return metersToMiles(distanceMeters);
}
