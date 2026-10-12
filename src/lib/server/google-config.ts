// Keep the client secret server-side; account metadata exposes only availability.
export function googleProvider(env: NodeJS.ProcessEnv = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret
    ? { clientId, clientSecret, prompt: "select_account" as const }
    : undefined;
}
