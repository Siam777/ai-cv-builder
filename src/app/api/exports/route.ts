import { handleExport } from "@/lib/server/export-service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleExport(request);
}
