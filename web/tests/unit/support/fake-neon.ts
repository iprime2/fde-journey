// A fake Neon HTTP endpoint backed by an in-memory PGlite, for the real Neon driver
// (drizzle-orm/neon-http, as in production) without a network. Set it as
// `neonConfig.fetchFunction`. `failWhen` picks queries that fail as a network error would.
// Every request is recorded, so a test knows the parameters a failed query carried.
import type { PGlite } from "@electric-sql/pglite";

export interface NeonRequest {
  query: string;
  params: unknown[];
  failed: boolean;
}

// Type ids whose text Neon's driver parses itself: PGlite must hand it the raw text.
const RAW_TEXT_TYPES = [16, 20, 21, 23, 25, 114, 700, 701, 1043, 1082, 1114, 1184, 1700, 2950, 3802];
const rawText = Object.fromEntries(RAW_TEXT_TYPES.map((id) => [id, (value: string) => value]));

export function fakeNeon(pg: PGlite, failWhen: (query: string) => Error | null = () => null) {
  const requests: NeonRequest[] = [];
  const fetchFunction = async (_url: string, init: { body: string }): Promise<Response> => {
    const body = JSON.parse(init.body) as { query: string; params: unknown[] };
    const failure = failWhen(body.query);
    requests.push({ query: body.query, params: body.params, failed: failure !== null });
    if (failure) throw failure;
    try {
      const result = await pg.query(body.query, body.params, { rowMode: "array", parsers: rawText });
      const command = body.query.trim().split(/\s+/, 1)[0].toUpperCase();
      return Response.json({
        command,
        rowCount: command === "SELECT" ? result.rows.length : (result.affectedRows ?? result.rows.length),
        fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
        rows: result.rows,
      });
    } catch (error) {
      const e = error as { message?: string; code?: string };
      return Response.json({ message: e.message ?? "error", code: e.code }, { status: 400 });
    }
  };
  return { fetchFunction, requests };
}
