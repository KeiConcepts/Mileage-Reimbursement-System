import { calculateWithConfiguredProvider } from "../../../src/serverConfig.mjs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const payload = await request.json();
    const calculation = await calculateWithConfiguredProvider(payload);
    return Response.json({ calculation });
  } catch (error) {
    return Response.json({ error: error.message || "Unexpected server error" }, { status: error.statusCode || 500 });
  }
}
