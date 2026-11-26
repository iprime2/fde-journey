import { type Page, type TestInfo, expect } from "@playwright/test";

/** Open a page and wait until it is interactive (hydrated), so typing and toggles are not lost. */
export async function gotoReady(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState("networkidle");
  return response;
}

export const isPhone = (testInfo: TestInfo) => testInfo.project.name === "phone";

export const READ_ONLY_TEXT = "Read-only preview. Ticks and notes can't be saved yet.";

export const SECTION_PAGES = [
  { path: "/", h1: "FDE Journey", title: "FDE Journey" },
  { path: "/roadmap", h1: "Roadmap", title: "Roadmap · FDE Journey" },
  { path: "/reading", h1: "Reading", title: "Reading · FDE Journey" },
  { path: "/scaler", h1: "Scaler course", title: "Scaler course · FDE Journey" },
  { path: "/certs", h1: "Certifications", title: "Certifications · FDE Journey" },
  { path: "/projects", h1: "Projects", title: "Projects · FDE Journey" },
  { path: "/career", h1: "Career", title: "Career · FDE Journey" },
] as const;

/** The page's single visible h1. */
export const pageHeading = (page: Page) => page.getByRole("heading", { level: 1 });

export async function expectNoSidewaysScroll(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(innerWidth);
}
