import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterEmpty } from "@/components/filter/Filtered";
import { FilterProvider } from "@/components/filter/FilterProvider";
import { Toolbar } from "@/components/filter/Toolbar";
import { PageBanners } from "@/components/PageBanners";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCards";
import { ListSkeleton } from "@/components/Skeleton";
import { CERTS_DESCRIPTION, SEARCH_PLACEHOLDERS } from "@/content/page-copy";
import { trackerContent } from "@/content/tracker-data";
import { filterFromRecord } from "@/lib/filter";
import { getProgress } from "@/lib/data";
import { isReadOnly } from "@/lib/mode";
import { certsView, filterEntries } from "@/lib/views";

export const metadata: Metadata = { title: "Certifications" };

export default function CertsPage({ searchParams }: PageProps<"/certs">) {
  return (
    <>
      <PageHeader title="Certifications" description={CERTS_DESCRIPTION} />
      <PageBanners />
      <Suspense fallback={<ListSkeleton />}>
        <CertsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CertsContent({ searchParams }: Pick<PageProps<"/certs">, "searchParams">) {
  const [sp, progress, readOnly] = await Promise.all([searchParams, getProgress(), isReadOnly()]);
  const cards = certsView(trackerContent, progress);
  return (
    <FilterProvider path="/certs" entries={filterEntries(cards)} initial={filterFromRecord(sp)}>
      <Toolbar placeholder={SEARCH_PLACEHOLDERS.certs} />
      {/* Two columns only from 1280 px: at 768 and 1024 two columns gave cramped 350 px cards (design spec 3.4). */}
      <div className="grid gap-3 xl:grid-cols-2">
        {cards.map((card) => (
          <SectionCard key={card.key} card={card} readOnly={readOnly} />
        ))}
        <div className="xl:col-span-2 empty:hidden">
          <FilterEmpty />
        </div>
      </div>
    </FilterProvider>
  );
}
