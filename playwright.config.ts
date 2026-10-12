import { defineConfig } from "@playwright/test";
const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: origin,
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1440, height: 1050 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/start-e2e-server.mjs",
    url: origin,
    reuseExistingServer: false,
    env: {
      APP_ORIGIN: origin,
      AUTH_EMAIL_MODE: "file",
      TURSO_DATABASE_URL: "file:./data/e2e.db",
      TURSO_AUTH_TOKEN: "",
      BETTER_AUTH_SECRET: "Synthetic-e2e-secret-for-local-tests-only-42",
      RESEND_API_KEY: "",
      AUTH_EMAIL_FROM: "",
      OPENAI_API_KEY:
        process.env.E2E_OPENAI === "1" ? "synthetic-openai-key" : "",
      E2E_OPENAI: process.env.E2E_OPENAI || "0",
      STRIPE_SECRET_KEY: "",
      GOOGLE_CLIENT_ID:
        process.env.E2E_GOOGLE === "1" ? "synthetic-google-client" : "",
      GOOGLE_CLIENT_SECRET:
        process.env.E2E_GOOGLE === "1" ? "synthetic-google-secret" : "",
      E2E_GOOGLE: process.env.E2E_GOOGLE || "0",
    },
    timeout: 120000,
  },
});
