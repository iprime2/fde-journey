// The account menu's pure helpers: initials, the avatar URL check and size (lib/account.ts).
import { describe, expect, it } from "vitest";
import { AVATAR_HOST, FALLBACK_NAME, accountView, avatarSrc, initials } from "@/lib/account";

describe("initials", () => {
  it.each([
    ["Sam Example", "SE"],
    ["Samantha Example-Longname", "SE"],
    ["  sam   middle   example  ", "SE"],
    ["Sam", "S"],
    ["sam", "S"],
    ["Émile Zola", "ÉZ"],
    ["Łukasz Żak", "ŁŻ"],
    ["Ana María de la Cruz", "AC"],
    ["Иван Петров", "ИП"],
    ["山田 太郎", "山太"],
    ["(Sam) Example", "SE"],
    ["sam2 example", "SE"],
    ["42", "4"],
  ])("%s gives %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it("keeps a letter with a combining accent whole", () => {
    // "e" followed by a combining acute accent: one character on screen, two code points.
    expect(initials("émile zola")).toBe("ÉZ");
  });

  it.each([[""], ["   "], ["---"], ["🙂"], [null], [undefined]])("%j has no letters, so the icon shows", (name) => {
    expect(initials(name)).toBe("");
  });
});

describe("avatarSrc (only GitHub avatars, sized for 32 px at 2x)", () => {
  it("sets s=64 and keeps GitHub's other parameters", () => {
    expect(avatarSrc("https://avatars.githubusercontent.com/u/0?v=4")).toBe("https://avatars.githubusercontent.com/u/0?v=4&s=64");
    expect(avatarSrc("https://avatars.githubusercontent.com/u/0")).toBe("https://avatars.githubusercontent.com/u/0?s=64");
  });

  it("replaces a size that is already there, and drops a fragment", () => {
    expect(avatarSrc("https://avatars.githubusercontent.com/u/0?s=460&v=4#x")).toBe(
      "https://avatars.githubusercontent.com/u/0?s=64&v=4",
    );
  });

  it("takes another display size", () => {
    expect(avatarSrc("https://avatars.githubusercontent.com/u/0?v=4", 40)).toBe("https://avatars.githubusercontent.com/u/0?v=4&s=80");
  });

  it.each([
    ["nothing", null],
    ["undefined", undefined],
    ["empty", ""],
    ["not a string", 42],
    ["not a URL", "avatar.png"],
    ["relative path", "/u/0"],
    ["http", "http://avatars.githubusercontent.com/u/0"],
    ["another host", "https://example.com/u/0"],
    ["a look-alike host", "https://avatars.githubusercontent.com.example.com/u/0"],
    ["a subdomain trick", "https://evil.example/avatars.githubusercontent.com/u/0"],
    ["user name in the URL", "https://user@avatars.githubusercontent.com/u/0"],
    ["user and password", "https://a:b@avatars.githubusercontent.com/u/0"],
    ["a port", "https://avatars.githubusercontent.com:8443/u/0"],
    ["javascript", "javascript:alert(1)"],
    ["data URL", "data:image/png;base64,AAAA"],
    ["too long", `https://${AVATAR_HOST}/u/0?x=${"a".repeat(2100)}`],
  ])("refuses %s", (_label, image) => {
    expect(avatarSrc(image)).toBeNull();
  });
});

describe("avatarSrc and URL parsing tricks", () => {
  const OUT = "https://avatars.githubusercontent.com/u/0?v=4&s=64";

  it.each([
    ["a percent-encoded dot in the host", "https://avatars%2Egithubusercontent.com/u/0?v=4"],
    ["an upper-case host", "https://AVATARS.GitHubUserContent.COM/u/0?v=4"],
    ["the default port", "https://avatars.githubusercontent.com:443/u/0?v=4"],
    ["backslashes for slashes", "https:\\\\avatars.githubusercontent.com\\u\\0?v=4"],
    ["an empty user name", "https://@avatars.githubusercontent.com/u/0?v=4"],
  ])("normalises %s to the plain GitHub URL", (_label, image) => {
    expect(avatarSrc(image)).toBe(OUT);
  });

  it("never puts a port or an @ in the result", () => {
    for (const image of ["https://avatars.githubusercontent.com:443/u/0?v=4", "https://@avatars.githubusercontent.com/u/0?v=4"]) {
      const out = avatarSrc(image)!;
      expect(out).not.toContain(":443");
      expect(out).not.toContain("@");
    }
  });

  it.each([
    ["protocol-relative", "//avatars.githubusercontent.com/u/0"],
    ["a trailing dot on the host", "https://avatars.githubusercontent.com./u/0"],
  ])("refuses %s", (_label, image) => {
    expect(avatarSrc(image)).toBeNull();
  });
});

describe("accountView", () => {
  it("gives the name, its initials and a checked photo URL", () => {
    expect(accountView({ name: "Sam Example", image: "https://avatars.githubusercontent.com/u/0?v=4" })).toEqual({
      name: "Sam Example",
      initials: "SE",
      avatar: "https://avatars.githubusercontent.com/u/0?v=4&s=64",
    });
  });

  it("falls back to initials for any other image, and to a plain label (with the icon) for no name", () => {
    expect(accountView({ name: " Sam Example ", image: "https://example.com/me.png" })).toEqual({
      name: "Sam Example",
      initials: "SE",
      avatar: null,
    });
    expect(accountView({ name: "", image: null })).toEqual({ name: FALLBACK_NAME, initials: "", avatar: null });
  });
});
