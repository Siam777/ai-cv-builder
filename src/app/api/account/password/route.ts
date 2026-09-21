import { z } from "zod";
import { passwordSchema } from "@/lib/cloud-contract";
import { handle, readJson, requireSameOrigin } from "@/lib/server/http";
import { auth, authorized, origin } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    await authorized(request);
    const body = z
      .strictObject({
        password: passwordSchema,
        currentPassword: z.string().min(1).max(128),
      })
      .parse(await readJson(request, 4096));
    const response = await auth().api.changePassword({
      headers: request.headers,
      body: {
        newPassword: body.password,
        currentPassword: body.currentPassword,
        revokeOtherSessions: true,
      },
      asResponse: true,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}
