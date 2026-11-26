// drizzle-kit settings. Used only to generate SQL migrations from db/schema.ts
// (`npm run db:generate`). Migrations are applied by the app (PGlite, automatically) or by
// `npm run db:migrate` (Neon), so no database credentials are needed here.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  strict: true,
});
