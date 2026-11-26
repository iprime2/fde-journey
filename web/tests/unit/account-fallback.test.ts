// The account area when the session can't be read (components/account/Account.tsx): a plain
// Sign out still shows, and Next's own control errors pass through untouched.
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ getOwnerSession: vi.fn() }));
vi.mock("@/lib/session", () => session);
// The real Server Action pulls in Better Auth and the database; only its identity matters here.
vi.mock("@/app/actions/auth", () => ({ signOut: async () => {} }));

import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { SheetAccount, SidebarAccount } from "@/components/account/Account";
import { AccountMenu } from "@/components/account/AccountMenu";
import { SignOutButton } from "@/components/account/SignOutButton";

type El = ReactElement<{ action?: unknown; children?: unknown; look?: string; account?: unknown }>;

/** A form for the sign-out action holding the SignOutButton, with the expected look. */
function expectSignOutForm(el: El, look: string) {
  expect(el.type).toBe("form");
  expect(el.props.action).toBe(signOut);
  const button = el.props.children as El;
  expect(button.type).toBe(SignOutButton);
  expect(button.props.look).toBe(look);
}

beforeEach(() => {
  session.getOwnerSession.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("account area fallback", () => {
  it("shows a plain Sign out when the session check fails, and logs only the error's name", async () => {
    session.getOwnerSession.mockRejectedValue(new TypeError("connection refused to db.internal:5432"));
    expectSignOutForm((await SidebarAccount()) as El, "ghost");
    expectSignOutForm((await SheetAccount()) as El, "secondary");
    expect(console.error).toHaveBeenCalledWith("Account menu: session check failed (TypeError)");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("db.internal");
  });

  it("shows a plain Sign out when there is no owner session", async () => {
    session.getOwnerSession.mockResolvedValue(null);
    expectSignOutForm((await SidebarAccount()) as El, "ghost");
    expectSignOutForm((await SheetAccount()) as El, "secondary");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rethrows Next's control errors (a redirect) instead of swallowing them", async () => {
    let control: unknown;
    try {
      redirect("/login");
    } catch (error) {
      control = error;
    }
    expect(control).toBeInstanceOf(Error);
    session.getOwnerSession.mockRejectedValue(control);
    await expect(SidebarAccount()).rejects.toBe(control);
    await expect(SheetAccount()).rejects.toBe(control);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("shows the account menu for the owner, with the avatar URL checked on the server", async () => {
    session.getOwnerSession.mockResolvedValue({
      userId: "owner",
      name: "Sam Example",
      image: "https://avatars.githubusercontent.com/u/0?v=4",
    });
    const el = (await SidebarAccount()) as El;
    expect(el.type).toBe(AccountMenu);
    expect(el.props.account).toEqual({
      name: "Sam Example",
      initials: "SE",
      avatar: "https://avatars.githubusercontent.com/u/0?v=4&s=64",
    });
  });
});
