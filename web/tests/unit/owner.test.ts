import { describe, expect, it } from "vitest";
import { NOT_OWNER, isOwnerGithubId, ownerGate, ownerGithubId } from "@/lib/owner";

const OWNER = "900000000001";
const github = (id: unknown, action = "sign-in") => ({ source: { method: "oauth", action, oauth: { providerId: "github", profile: { id, login: "renamed-login" } } } });

describe("ownerGithubId", () => {
  it("accepts a plain number only", () => {
    expect(ownerGithubId({ OWNER_GITHUB_ID: OWNER })).toBe(OWNER);
    expect(ownerGithubId({ OWNER_GITHUB_ID: ` ${OWNER} ` })).toBe(OWNER);
    for (const bad of [undefined, "", "abc", "12a", "-5", "0", "1.5", "octocat"]) expect(ownerGithubId({ OWNER_GITHUB_ID: bad }), String(bad)).toBeNull();
  });
});

describe("isOwnerGithubId", () => {
  it("compares the numeric id, as a number or as text", () => {
    expect(isOwnerGithubId(900000000001, OWNER)).toBe(true);
    expect(isOwnerGithubId(OWNER, OWNER)).toBe(true);
    expect(isOwnerGithubId(900000000002, OWNER)).toBe(false);
    expect(isOwnerGithubId(`${OWNER} `, OWNER)).toBe(false);
    expect(isOwnerGithubId(null, OWNER)).toBe(false);
    expect(isOwnerGithubId(900000000001, null)).toBe(false);
  });
});

describe("ownerGate (Better Auth validateUserInfo)", () => {
  it("lets only the owner's GitHub id through, whatever the login is called", () => {
    for (const action of ["create-user", "link-account", "sign-in"]) {
      expect(ownerGate(github(900000000001, action), OWNER)).toBeUndefined();
      expect(ownerGate(github(900000000002, action), OWNER)).toEqual(NOT_OWNER);
    }
  });

  it("rejects everyone when OWNER_GITHUB_ID is missing", () => {
    expect(ownerGate(github(900000000001), null)).toEqual(NOT_OWNER);
  });

  it("rejects other providers, other methods and missing profiles", () => {
    expect(ownerGate({ source: { method: "oauth", oauth: { providerId: "google", profile: { id: 900000000001 } } } }, OWNER)).toEqual(NOT_OWNER);
    expect(ownerGate({ source: { method: "email-password" } }, OWNER)).toEqual(NOT_OWNER);
    expect(ownerGate({ source: { method: "oauth", oauth: { providerId: "github" } } }, OWNER)).toEqual(NOT_OWNER);
  });

  it("uses the error code the sign-in page understands", () => {
    expect(NOT_OWNER.error).toBe("not_owner");
  });
});
