import { database } from "./database";
import { HttpError } from "./http";

/**
 * The account's one-time AI consent ("AI writing help" in Account settings,
 * Data & privacy). Off until the person turns it on.
 */
export async function getAiConsent(owner: string) {
  const row = (
    await database().client.execute({
      sql: "SELECT enabled, consented_at FROM ai_settings WHERE owner_id=?",
      args: [owner],
    })
  ).rows[0];
  return {
    enabled: Number(row?.enabled ?? 0) === 1,
    consentedAt: row?.consented_at ? Number(row.consented_at) : null,
  };
}

export async function setAiConsent(owner: string, enabled: boolean) {
  const now = Date.now();
  await database().client.execute({
    sql: `INSERT INTO ai_settings(owner_id,enabled,consented_at,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(owner_id) DO UPDATE SET enabled=excluded.enabled,
          consented_at=CASE WHEN excluded.enabled=1 THEN excluded.consented_at ELSE ai_settings.consented_at END,
          updated_at=excluded.updated_at`,
    args: [owner, enabled ? 1 : 0, enabled ? now : null, now],
  });
  return getAiConsent(owner);
}

/** Refuses an AI request until the account has turned on AI writing help. */
export async function requireAiConsent(owner: string) {
  if (!(await getAiConsent(owner)).enabled)
    throw new HttpError(
      403,
      "AI_CONSENT_REQUIRED",
      "Turn on AI writing help first. Your CV text and notes are sent to OpenAI; contact details are not.",
    );
}
