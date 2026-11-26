import { trackerContent } from "@/content/tracker-data";
import { getProgress } from "@/lib/data";
import { type SectionKey, navCounts } from "@/lib/summary";
import { Count } from "../ui";

/** The done count beside a sidebar item. Reads saved progress, so it sits in <Suspense>. */
export async function NavCount({ section }: { section: SectionKey }) {
  const counts = navCounts(trackerContent, await getProgress());
  const c = counts[section];
  return <Count done={c.done} total={c.total} />;
}
