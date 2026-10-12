import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
await mkdir("data", { recursive: true });
const setup = spawn(process.execPath, ["scripts/setup-db.mjs"], {
  stdio: "inherit",
});
await new Promise((resolve, reject) =>
  setup.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error("E2E migration failed")),
  ),
);
const port = new URL(process.env.APP_ORIGIN).port;
const imports = [
  ...(process.env.E2E_GOOGLE === "1" ? ["./e2e-google-fetch.mjs"] : []),
  ...(process.env.E2E_OPENAI === "1" ? ["./e2e-openai-fetch.mjs"] : []),
].map((path) => `--import=${new URL(path, import.meta.url).href}`);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-e2e",
      ...(imports.length
        ? {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} ${imports.join(" ")}`,
          }
        : {}),
    },
  },
);
server.on("exit", (code) => process.exit(code || 0));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
