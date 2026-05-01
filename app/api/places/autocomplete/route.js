import { getPlaceAutocompleteSuggestions } from "../../../../src/googlePlaces.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input") || "";
    const suggestions = await getPlaceAutocompleteSuggestions(input, process.env.GOOGLE_MAPS_API_KEY);
    return Response.json({ suggestions });
  } catch (error) {
    return Response.json({ error: error.message || "Unexpected server error" }, { status: error.statusCode || 500 });
  }
}
