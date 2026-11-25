import type { Metadata } from "next";
import { Fragment, Suspense } from "react";
import { NextClass } from "@/components/clock";
import { FilterEmpty, FilterGroupLabel } from "@/components/filter/Filtered";
import { FilterProvider } from "@/components/filter/FilterProvider";
import { Toolbar } from "@/components/filter/Toolbar";
import { PageBanners } from "@/components/PageBanners";
import { PageHeader } from "@/components/PageHeader";
import { ModuleCard } from "@/components/SectionCards";
import { ListSkeleton } from "@/components/Skeleton";
import { SCALER_DESCRIPTION, SEARCH_PLACEHOLDERS } from "@/content/page-copy";
import { CLASS_SCHEDULE_LABEL } from "@/content/schedule";
import { trackerContent } from "@/content/tracker-data";
import { filterFromRecord } from "@/lib/filter";
import { READ_ONLY_PREVIEW } from "@/lib/mode";
import { getProgress } from "@/lib/progress";
import { filterEntries, scalerView } from "@/lib/views";

export const metadata: Metadata = { title: "Scaler course" };

export default function ScalerPage({ searchParams }: PageProps<"/scaler">) {
  return (
    <>
      <PageHeader
        title="Scaler course"
        description={SCALER_DESCRIPTION}
        facts={[
          { label: "Classes", value: CLASS_SCHEDULE_LABEL },
          { label: "Next class", value: <NextClass /> },
        ]}
      />
      <PageBanners />
      <Suspense fallback={<ListSkeleton />}>
        <ScalerContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const GROUPS = [
  { kind: "core", label: "Core modules" },
  { kind: "elective", label: "Elective modules" },
] as const;

async function ScalerContent({ searchParams }: Pick<PageProps<"/scaler">, "searchParams">) {
  const [sp, progress] = await Promise.all([searchParams, getProgress()]);
  const cards = scalerView(trackerContent, progress);
  const current = cards.find((m) => m.isCurrent)?.n ?? cards[0].n;
  return (
    <FilterProvider path="/scaler" entries={filterEntries(cards)} initial={filterFromRecord(sp)}>
      <Toolbar placeholder={SEARCH_PLACEHOLDERS.scaler} />
      <div className="grid gap-3">
        {GROUPS.map((g) => (
          <Fragment key={g.kind}>
            <FilterGroupLabel group={g.kind}>{g.label}</FilterGroupLabel>
            {cards
              .filter((m) => m.kind === g.kind)
              .map((m) => (
                <ModuleCard key={m.key} card={m} currentModule={current} readOnly={READ_ONLY_PREVIEW} />
              ))}
          </Fragment>
        ))}
        <FilterEmpty />
      </div>
    </FilterProvider>
  );
}
