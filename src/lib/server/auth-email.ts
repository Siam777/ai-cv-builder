import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HttpError } from "./http";

export function emailDeliveryMode() {
  if (
    process.env.AUTH_EMAIL_MODE === "file" &&
    process.env.NODE_ENV !== "production"
  )
    return "file";
  if (process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM)
    return "resend";
  return "unconfigured";
}

export function requireEmailDelivery() {
  if (emailDeliveryMode() === "unconfigured")
    throw new HttpError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "Email delivery is not configured. Your draft is kept; contact the installation owner.",
    );
}

export async function sendAuthEmail(
  to: string,
  url: string,
  kind: "verification" | "recovery",
) {
  requireEmailDelivery();
  const subject =
    kind === "verification"
      ? "Verify your AI CV Builder email"
      : "Reset your AI CV Builder password";
  const text = `${subject}\n\n${url}\n\nThis link expires in ${kind === "verification" ? "24 hours" : "30 minutes"}. If you did not request it, ignore this email.`;
  if (emailDeliveryMode() === "file") {
    const directory = join(process.cwd(), "data", "auth-email-outbox");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify({ to, url, kind, subject, text }),
      { mode: 0o600 },
    );
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new HttpError(
      503,
      "EMAIL_DELIVERY_FAILED",
      "Email could not be sent. Please retry later. Your draft is kept.",
    );
}
