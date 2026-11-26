// Captures everything server code prints during a test: console methods and direct writes to
// stdout and stderr. Call in beforeEach; vi.restoreAllMocks() in afterEach puts them back.
import { inspect } from "node:util";
import { vi } from "vitest";

export function captureOutput(): string[] {
  const output: string[] = [];
  const capture =
    (stream: string) =>
    (...args: unknown[]) => {
      output.push(`${stream}: ${args.map((a) => (typeof a === "string" ? a : inspect(a, { depth: 10 }))).join(" ")}`);
    };
  for (const method of ["error", "warn", "log", "info", "debug"] as const) vi.spyOn(console, method).mockImplementation(capture(method));
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    output.push(`stdout: ${String(chunk)}`);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
    output.push(`stderr: ${String(chunk)}`);
    return true;
  });
  return output;
}
