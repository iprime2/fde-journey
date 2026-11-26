import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterEmpty } from "@/components/filter/Filtered";
import { FilterProvider } from "@/components/filter/FilterProvider";
import { Toolbar } from "@/components/filter/Toolbar";
import { PageBanners } from "@/components/PageBanners";
import { PageHeader } from "@/components/PageHeader";
import { JournalCard, SectionCard } from "@/components/SectionCards";
import { ListSkeleton } from "@/components/Skeleton";
import { SEARCH_PLACEHOLDERS } from "@/content/page-copy";
import { trackerContent } from "@/content/tracker-data";
import { filterFromRecord } from "@/lib/filter";
import { getProgress } from "@/lib/data";
import { isReadOnly } from "@/lib/mode";
import { JOURNAL_SUB, careerView, filterEntries, journalEntry } from "@/lib/views";
import { requireSection } from "@/components/nav/navData";

export const metadata: Metadata = { title: "Career" };

export default function CareerPage({ searchParams }: PageProps<"/career">) {
  return (
    <>
      <PageHeader title="Career" />
      <PageBanners />
      <Suspense fallback={<ListSkeleton />}>
        <CareerContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CareerContent({ searchParams }: Pick<PageProps<"/career">, "searchParams">) {
  await requireSection("career");
  const [sp, progress, readOnly] = await Promise.all([searchParams, getProgress(), isReadOnly()]);
  const { milestones, journalNote } = careerView(trackerContent, progress);
  const entries = [...filterEntries([milestones]), journalEntry(journalNote)];
  return (
    <FilterProvider path="/career" entries={entries} initial={filterFromRecord(sp)}>
      <Toolbar placeholder={SEARCH_PLACEHOLDERS.career} />
      <div className="grid gap-3">
        <SectionCard card={milestones} readOnly={readOnly} />
        <JournalCard note={journalNote} sub={JOURNAL_SUB} readOnly={readOnly} />
        <FilterEmpty />
      </div>
    </FilterProvider>
  );
}
