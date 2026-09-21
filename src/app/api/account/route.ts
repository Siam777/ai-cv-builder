import { z } from "zod";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { auth, authorized, origin } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    const value = await auth().api.getSession({ headers: request.headers });
    return json({
      configured: true,
      user: value ? { id: value.user.id, email: value.user.email } : null,
      canDeleteAccount: true,
    });
  });
}
export async function DELETE(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    await authorized(request);
    const body = z
      .strictObject({
        password: z.string().min(1).max(128),
        confirmation: z.literal("DELETE MY ACCOUNT"),
      })
      .parse(await readJson(request, 4096));
    const response = await auth().api.deleteUser({
      headers: request.headers,
      body: { password: body.password },
      asResponse: true,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}
