const AUTOCOMPLETE_ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";

export async function getPlaceAutocompleteSuggestions(input, apiKey) {
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  }

  const query = String(input || "").trim();
  if (query.length < 3) return [];

  const response = await fetch(AUTOCOMPLETE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text"
    },
    body: JSON.stringify({
      input: query,
      includedRegionCodes: ["us"],
      languageCode: "en-US",
      regionCode: "us"
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || response.statusText;
    throw new Error(`Google Places autocomplete failed: ${detail}`);
  }

  return (body.suggestions || [])
    .map((suggestion) => suggestion.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      id: prediction.placeId,
      address: prediction.text?.text || "",
      mainText: prediction.structuredFormat?.mainText?.text || prediction.text?.text || "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text || ""
    }))
    .filter((suggestion) => suggestion.address);
}
