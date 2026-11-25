import { trackerContent } from "@/content/tracker-data";
import { listItems } from "@/lib/ids";

// M1 skeleton: replaced by the dashboard built to docs/DESIGN-SPEC.md.
export default function Home() {
  const total = listItems(trackerContent).length;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">FDE Journey</h1>
      <p className="mt-2">{total} trackable items loaded from the roadmap content.</p>
    </main>
  );
}
