// Vitest setup for every unit test file. Unit tests call server code outside Next's renderer, as a
// real request would: `connection()` (which waits for one) resolves at once here. Without Next's
// request scope the real one throws. A test can still make it hang, as it does in a prerender:
//   vi.mocked(connection).mockReturnValueOnce(new Promise(() => {}))
import { vi } from "vitest";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => {}),
}));
