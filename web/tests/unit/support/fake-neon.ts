// A fake Neon HTTP endpoint backed by an in-memory PGlite, for the real Neon driver
// (drizzle-orm/neon-http, as in production) without a network. Set it as
// `neonConfig.fetchFunction`. `failWhen` picks queries that fail as a network error would.
// Every request is recorded, so a test knows the parameters a failed query carried.
// A batch (`db.batch`, Neon's `transaction()`) arrives as `{ queries: [...] }` and runs in one
// PGlite transaction, as Neon runs it; its queries are recorded with `batch` set to the request's
// number.
import type { PGlite } from "@electric-sql/pglite";

export interface NeonRequest {
  query: string;
  params: unknown[];
  failed: boolean;
  /** Which request a batched query came in (1, 2, …); undefined for a single query. */
  batch?: number;
}

// Type ids whose text Neon's driver parses itself: PGlite must hand it the raw text.
const RAW_TEXT_TYPES = [16, 20, 21, 23, 25, 114, 700, 701, 1043, 1082, 1114, 1184, 1700, 2950, 3802];
const rawText = Object.fromEntries(RAW_TEXT_TYPES.map((id) => [id, (value: string) => value]));

type Runner = Pick<PGlite, "query">;

async function runOne(pg: Runner, query: string, params: unknown[]) {
  const result = await pg.query(query, params, { rowMode: "array", parsers: rawText });
  const command = query.trim().split(/\s+/, 1)[0].toUpperCase();
  return {
    command,
    rowCount: command === "SELECT" ? result.rows.length : (result.affectedRows ?? result.rows.length),
    fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: result.rows,
  };
}

export function fakeNeon(pg: PGlite, failWhen: (query: string) => Error | null = () => null) {
  const requests: NeonRequest[] = [];
  let batches = 0;
  const fetchFunction = async (_url: string, init: { body: string }): Promise<Response> => {
    const body = JSON.parse(init.body) as { query: string; params: unknown[] } | { queries: { query: string; params: unknown[] }[] };
    if ("queries" in body) {
      const batch = ++batches;
      for (const q of body.queries) requests.push({ query: q.query, params: q.params, failed: false, batch });
      try {
        const results = await pg.transaction(async (tx) => {
          const out = [];
          for (const q of body.queries) out.push(await runOne(tx, q.query, q.params));
          return out;
        });
        return Response.json({ results });
      } catch (error) {
        const e = error as { message?: string; code?: string };
        return Response.json({ message: e.message ?? "error", code: e.code }, { status: 400 });
      }
    }
    const failure = failWhen(body.query);
    requests.push({ query: body.query, params: body.params, failed: failure !== null });
    if (failure) throw failure;
    try {
      return Response.json(await runOne(pg, body.query, body.params));
    } catch (error) {
      const e = error as { message?: string; code?: string };
      return Response.json({ message: e.message ?? "error", code: e.code }, { status: 400 });
    }
  };
  return { fetchFunction, requests };
}
