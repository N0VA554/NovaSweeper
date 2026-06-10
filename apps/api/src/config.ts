import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../../../.env") });

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://novasweeper:novasweeper@127.0.0.1:55432/novasweeper",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000"
};
