import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterEmpty } from "@/components/filter/Filtered";
import { FilterProvider } from "@/components/filter/FilterProvider";
import { Toolbar } from "@/components/filter/Toolbar";
import { PageBanners } from "@/components/PageBanners";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCards";
import { ListSkeleton } from "@/components/Skeleton";
import { READING_DESCRIPTION, SEARCH_PLACEHOLDERS } from "@/content/page-copy";
import { trackerContent } from "@/content/tracker-data";
import { filterFromRecord } from "@/lib/filter";
import { getProgress } from "@/lib/data";
import { isReadOnly } from "@/lib/mode";
import { getTodayIst } from "@/lib/today";
import { filterEntries, readingView } from "@/lib/views";

export const metadata: Metadata = { title: "Reading" };

export default function ReadingPage({ searchParams }: PageProps<"/reading">) {
  return (
    <>
      <PageHeader title="Reading" description={READING_DESCRIPTION} />
      <PageBanners />
      <Suspense fallback={<ListSkeleton />}>
        <ReadingContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ReadingContent({ searchParams }: Pick<PageProps<"/reading">, "searchParams">) {
  const [sp, progress, today, readOnly] = await Promise.all([searchParams, getProgress(), getTodayIst(), isReadOnly()]);
  const cards = readingView(trackerContent, progress, today);
  return (
    <FilterProvider path="/reading" entries={filterEntries(cards)} initial={filterFromRecord(sp)}>
      <Toolbar placeholder={SEARCH_PLACEHOLDERS.reading} />
      <div className="grid gap-3">
        {cards.map((card) => (
          <SectionCard key={card.key} card={card} readOnly={readOnly} />
        ))}
        <FilterEmpty />
      </div>
    </FilterProvider>
  );
}
