// Provider-only transport fixture, loaded by the isolated test server, never by the app.
import { createHash, generateKeyPairSync, sign } from "node:crypto";
if (
  process.env.E2E_GOOGLE !== "1" ||
  process.env.NODE_ENV === "production" ||
  process.env.TURSO_DATABASE_URL !== "file:./data/e2e.db" ||
  !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.APP_ORIGIN || "")
)
  throw new Error(
    "Google transport fixture requires an isolated local test server.",
  );

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "synthetic-google-key",
  alg: "RS256",
  use: "sig",
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url === "https://www.googleapis.com/oauth2/v3/certs")
    return Response.json({ keys: [jwk] });
  if (url !== "https://oauth2.googleapis.com/token")
    return originalFetch(input, init);
  const request = new Request(input, init);
  const params = new URLSearchParams(await request.text());
  try {
    const code = JSON.parse(
      Buffer.from(params.get("code") || "", "base64url").toString(),
    );
    const challenge = createHash("sha256")
      .update(params.get("code_verifier") || "")
      .digest("base64url");
    if (
      code.challenge !== challenge ||
      code.redirect !== params.get("redirect_uri") ||
      params.get("client_id") !== "synthetic-google-client" ||
      params.get("client_secret") !== "synthetic-google-secret"
    )
      throw new Error("invalid grant");
    const time = Math.floor(Date.now() / 1000);
    const payload = `${encode({ alg: "RS256", kid: jwk.kid })}.${encode({
      iss: "https://accounts.google.com",
      aud: "synthetic-google-client",
      iat: time,
      exp: time + 300,
      sub: code.sub,
      email: code.email,
      email_verified: code.verified,
      name: "Synthetic Google candidate",
      ...(code.nonce ? { nonce: code.nonce } : {}),
    })}`;
    const idToken = `${payload}.${sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url")}`;
    return Response.json({
      access_token: "synthetic-access-token",
      token_type: "Bearer",
      expires_in: 300,
      scope: "openid email profile",
      id_token: idToken,
    });
  } catch {
    return Response.json({ error: "invalid_grant" }, { status: 400 });
  }
};
