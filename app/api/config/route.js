import { getClientConfig } from "../../../src/serverConfig.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getClientConfig());
}
