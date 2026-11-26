// lib/safe-log.ts and the scripts' errorSummary: logs carry error names and codes, never a
// message, parameter, token or email. All values here are made up.
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
import { errorSummary } from "@/scripts/lib/db.mjs";

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
  it("matches describeError's rules: names and codes, never a message", () => {
    const text = errorSummary(neonChain(Object.assign(new Error(TOKEN), { code: "42P07" })));
    expect(text).toBe("APIError < DrizzleQueryError < NeonDbError < Error 42P07");
    expect(errorSummary("text")).toBe("unknown");
  });
});
