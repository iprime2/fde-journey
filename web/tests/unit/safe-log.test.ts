// lib/safe-log.ts, lib/error-chain.mjs and the scripts' errorSummary: logs carry error names and
// codes, never a message, parameter, token, email or address. All values here are made up.
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { makeUntrackedHangingPromise } from "next/dist/server/dynamic-rendering-utils";
import {
  SafeError,
  betterAuthLog,
  describeError,
  errorChain,
  isNextControl,
  rethrowNextControl,
  safeText,
  withSafeErrors,
} from "@/lib/safe-log";
import { ScriptError, errorSummary } from "@/scripts/lib/db.mjs";

const TOKEN = "fakeSessionTokenAb12Cd34Ef56Gh78";

/** Shaped like the production chain: Neon keeps the fetch error on `sourceError`, not `cause`. */
function neonChain(inner: unknown) {
  const neon = Object.assign(new Error(`Error connecting to database: ${String(inner)}`), { name: "NeonDbError", sourceError: inner });
  class DrizzleQueryError extends Error {
    params = [TOKEN];
  }
  const drizzle = new DrizzleQueryError(`Failed query: select "token" from "session" where "token" = $1\nparams: ${TOKEN}`, { cause: neon });
  return Object.assign(new Error("Failed to get session", { cause: drizzle }), {
    name: "APIError",
    body: { code: "FAILED_TO_GET_SESSION", message: "Failed to get session" },
  });
}

async function hangingRejection(): Promise<unknown> {
  const controller = new AbortController();
  const pending = makeUntrackedHangingPromise(controller.signal, "/roadmap", "fetch()");
  controller.abort();
  return pending.catch((error: unknown) => error);
}

function redirectError(): unknown {
  try {
    redirect("/login");
  } catch (error) {
    return error;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorChain", () => {
  it("follows cause and Neon's sourceError, outermost first", () => {
    const inner = new TypeError("x");
    const chain = errorChain(neonChain(inner));
    expect(chain.map((e) => (e as Error).name)).toEqual(["APIError", "Error", "NeonDbError", "TypeError"]);
  });

  it("stops on cycles and after eight links", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    (a as Error & { cause?: unknown }).cause = b;
    expect(errorChain(a)).toHaveLength(2);
    let deep: Error = new Error("0");
    for (let i = 1; i < 20; i++) deep = new Error(String(i), { cause: deep });
    expect(errorChain(deep)).toHaveLength(8);
    expect(errorChain(undefined)).toEqual([]);
  });
});

describe("describeError", () => {
  it("names each link with its code, never a message", () => {
    const text = describeError(neonChain(Object.assign(new Error(`connect to ${TOKEN}`), { code: "ECONNREFUSED" })));
    expect(text).toBe("APIError FAILED_TO_GET_SESSION < DrizzleQueryError < NeonDbError < Error ECONNREFUSED");
    expect(text).not.toContain(TOKEN);
  });

  it("drops names and codes that don't look like identifiers", () => {
    const odd = Object.assign(new Error("m"), { name: `owner@example.com ${TOKEN}`, code: "has spaces and @" });
    expect(describeError(odd)).toBe("Error");
    expect(describeError(Object.assign(new Error("m"), { code: 23505 }))).toBe("Error 23505");
    expect(describeError("a string")).toBe("string");
    expect(describeError(undefined)).toBe("unknown");
  });
});

describe("SafeError and withSafeErrors", () => {
  it("keeps names and codes only, and no reference to the original", async () => {
    const original = neonChain(new TypeError(`fetch failed ${TOKEN}`));
    const error = await withSafeErrors("Session check", async () => {
      throw original;
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SafeError);
    expect((error as SafeError).message).toBe(
      "Session check failed (APIError FAILED_TO_GET_SESSION < DrizzleQueryError < NeonDbError < TypeError)",
    );
    expect((error as SafeError).cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain(TOKEN);
    expect(describeError(error)).toBe("SafeError(APIError FAILED_TO_GET_SESSION < DrizzleQueryError < NeonDbError < TypeError)");
  });

  it("keeps the innermost error's stack frames and Postgres's schema names, never their text", () => {
    function failingDeepInside() {
      return Object.assign(new Error(`duplicate key: (email)=(owner@example.com) ${TOKEN}`), {
        name: "DatabaseError",
        code: "23505",
        table: "session",
        constraint: "session_token_unique",
        column: `token ${TOKEN}`,
        routine: "_bt_check_unique",
        detail: `Key (token)=(${TOKEN}) already exists.`,
      });
    }
    const error = new SafeError("Session check", new Error(`outer ${TOKEN}`, { cause: failingDeepInside() }));
    expect(error.stack?.split("\n")[0]).toBe("SafeError: Session check failed (Error < DatabaseError 23505)");
    expect(error.stack).toMatch(/\n\s+at failingDeepInside /);
    expect(error.table).toBe("session");
    expect(error.constraint).toBe("session_token_unique");
    // Not plain identifiers, so left out.
    expect(error.column).toBeUndefined();
    expect(error.routine).toBeUndefined();
    expect(error.detail).toBe("Error < DatabaseError 23505");
    const everything = `${error.stack} ${JSON.stringify(error)} ${inspect(error, { depth: 10 })}`;
    expect(everything).not.toMatch(new RegExp(`${TOKEN}|example\\.com|duplicate|already exists`));
  });

  it("keeps its own frames when no wrapped error has any", () => {
    const error = new SafeError("Reading", { name: "Odd", message: TOKEN });
    expect(error.stack).toMatch(/^SafeError: Reading failed \(Odd\)\n\s+at /);
    expect(error.stack).not.toContain(TOKEN);
  });

  it("passes the result through", async () => {
    expect(await withSafeErrors("Reading", async () => 42)).toBe(42);
  });

  it("rethrows Next's control errors untouched, even wrapped by a library", async () => {
    const hanging = await hangingRejection();
    await expect(
      withSafeErrors("Session check", async () => {
        throw neonChain(hanging);
      }),
    ).rejects.toBe(hanging);
    const control = redirectError();
    await expect(
      withSafeErrors("Session check", async () => {
        throw new Error("wrapped", { cause: control });
      }),
    ).rejects.toBe(control);
  });
});

describe("rethrowNextControl and isNextControl", () => {
  it("find Next's hanging-promise error behind Neon's sourceError", async () => {
    const hanging = await hangingRejection();
    expect(() => rethrowNextControl(neonChain(hanging))).toThrow(hanging as Error);
    expect(isNextControl(neonChain(hanging))).toBe(true);
    expect(isNextControl(redirectError())).toBe(true);
  });

  it("leave ordinary failures alone", () => {
    expect(() => rethrowNextControl(neonChain(new TypeError("x")))).not.toThrow();
    expect(isNextControl(new Error("x"))).toBe(false);
    expect(isNextControl("INTERNAL_SERVER_ERROR")).toBe(false);
    expect(isNextControl(null)).toBe(false);
  });
});

describe("safeText", () => {
  it("keeps the first line, cut before params", () => {
    expect(safeText(`Failed query: select 1\nparams: ${TOKEN}`)).toBe("Failed query: select 1");
    expect(safeText(`Failed query: select 1 params: ${TOKEN}`)).toBe("Failed query: select 1");
  });

  it("redacts emails and token-like runs, keeping UPPER_SNAKE codes", () => {
    const out = safeText(`INTERNAL_SERVER_ERROR FAILED_TO_CREATE_SESSION for owner@example.com cookie=${TOKEN}.c2lnbmF0dXJl%2Bpart`);
    expect(out).toBe("INTERNAL_SERVER_ERROR FAILED_TO_CREATE_SESSION for [email] [redacted]");
  });

  it("redacts URL-encoded emails", () => {
    expect(safeText("callback for owner%40example.com failed")).toBe("callback for [email] failed");
    expect(safeText("next=%2Flogin%3Fe%3Dfirst.last%2Btag%40example.co.uk")).not.toMatch(/example|first|last/);
  });

  it("redacts all-capital tokens: only codes made of words joined by _ are kept", () => {
    expect(safeText("token ABCDEFGHJKLMNPQRSTUVWXYZ23456789 seen")).toBe("token [redacted] seen");
    expect(safeText("token ABCDEFGHJKLMNPQRSTUVWXYZ_23456789 seen")).toBe("token [redacted] seen");
    expect(safeText("UNABLE_TO_CREATE_SESSION and STATE_NOT_FOUND")).toBe("UNABLE_TO_CREATE_SESSION and STATE_NOT_FOUND");
  });

  it("redacts shorter tokens (12 characters or more) but keeps plain words and paths", () => {
    expect(safeText("id Ab3dE6gH9jK2 and q1w2e3r4t5y6u7 and ZXCVBNMASDFG")).toBe("id [redacted] and [redacted] and [redacted]");
    expect(safeText("verification failed at /api/auth/callback/github")).toBe("verification failed at /api/auth/callback/github");
    expect(safeText("short abc123 kept")).toBe("short abc123 kept");
  });

  it("redacts IPv4 addresses", () => {
    expect(safeText("rate limit for 203.0.113.7 reached")).toBe("rate limit for [ip] reached");
    expect(safeText("from 10.0.0.1:443")).toBe("from [ip]:443");
  });

  it("caps the length", () => {
    expect(safeText("word ".repeat(100), 20)).toBe("word word word word …");
  });
});

describe("betterAuthLog", () => {
  it("prints the cleaned message and each error's names, at the right level", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    betterAuthLog("error", "INTERNAL_SERVER_ERROR", neonChain(new TypeError(TOKEN)));
    betterAuthLog("warn", `Something for owner@example.com`, { issues: [TOKEN] }, 3);
    betterAuthLog("info", "Error parsing JSON", { error: new SyntaxError(TOKEN) });
    expect(error).toHaveBeenCalledWith(
      "[Better Auth] error: INTERNAL_SERVER_ERROR APIError FAILED_TO_GET_SESSION < DrizzleQueryError < NeonDbError < TypeError",
    );
    expect(warn).toHaveBeenCalledWith("[Better Auth] warn: Something for [email] 3");
    expect(log).toHaveBeenCalledWith("[Better Auth] info: Error parsing JSON SyntaxError");
    expect(JSON.stringify([error.mock.calls, warn.mock.calls, log.mock.calls])).not.toContain(TOKEN);
  });

  it("describes an error passed as the message", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    betterAuthLog("error", Object.assign(new Error(TOKEN), { code: "57P01" }) as unknown as string);
    expect(error).toHaveBeenCalledWith("[Better Auth] error: Error 57P01");
  });

  it("prints nothing for Next's control errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    betterAuthLog("error", "INTERNAL_SERVER_ERROR", neonChain(await hangingRejection()));
    expect(error).not.toHaveBeenCalled();
  });
});

describe("errorSummary (scripts)", () => {
  it("is describeError (one implementation): names and codes, body.code, cycles", () => {
    const chain = neonChain(Object.assign(new Error(TOKEN), { code: "42P07" }));
    expect(errorSummary(chain)).toBe("APIError FAILED_TO_GET_SESSION < DrizzleQueryError < NeonDbError < Error 42P07");
    expect(errorSummary(chain)).toBe(describeError(chain));
    const a = new Error(TOKEN);
    const b = new Error(TOKEN, { cause: a });
    (a as Error & { cause?: unknown }).cause = b;
    expect(errorSummary(a)).toBe("Error < Error");
    expect(errorSummary("text")).toBe(describeError("text"));
  });

  it("prints the scripts' own messages, and only those", () => {
    expect(errorSummary(new ScriptError("DATABASE_URL is required on Vercel."))).toBe("DATABASE_URL is required on Vercel.");
    expect(errorSummary(new Error("DATABASE_URL leaked postgres://u:p@host"))).toBe("Error");
  });
});
