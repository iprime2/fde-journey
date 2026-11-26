// A made-up avatar for the end-to-end tests. The seeded owner's image points at GitHub's avatar
// host (u/0, not a real account), and tests/e2e/fixtures.ts answers every request to that host with
// this solid-colour PNG, so no test ever reaches GitHub or shows a real photo.
import { crc32, deflateSync } from "node:zlib";

export const AVATAR_ORIGIN = "https://avatars.githubusercontent.com";
/** Every avatar request, for page.route and context.route. */
export const AVATAR_ROUTE = `${AVATAR_ORIGIN}/**`;

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A `size` by `size` PNG of one colour (8-bit RGB, no transparency). */
export function solidPng([r, g, b]: [number, number, number], size = 64): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // colour type: RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const pixels = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The test avatar: a warm amber square, clearly not a photo. */
export const TEST_AVATAR_PNG = solidPng([0xf0, 0xb3, 0x5a]);
