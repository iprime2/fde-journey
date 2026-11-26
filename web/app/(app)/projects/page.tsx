import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterEmpty } from "@/components/filter/Filtered";
import { FilterProvider } from "@/components/filter/FilterProvider";
import { Toolbar } from "@/components/filter/Toolbar";
import { PageBanners } from "@/components/PageBanners";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCards";
import { ListSkeleton } from "@/components/Skeleton";
import { PROJECTS_DESCRIPTION, SEARCH_PLACEHOLDERS } from "@/content/page-copy";
import { trackerContent } from "@/content/tracker-data";
import { filterFromRecord } from "@/lib/filter";
import { getProgress } from "@/lib/data";
import { isReadOnly } from "@/lib/mode";
import { filterEntries, projectsView } from "@/lib/views";
import { requireSection } from "@/components/nav/navData";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <>
      <PageHeader title="Projects" description={PROJECTS_DESCRIPTION} />
      <PageBanners />
      <Suspense fallback={<ListSkeleton />}>
        <ProjectsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProjectsContent({ searchParams }: Pick<PageProps<"/projects">, "searchParams">) {
  await requireSection("projects");
  const [sp, progress, readOnly] = await Promise.all([searchParams, getProgress(), isReadOnly()]);
  const cards = projectsView(trackerContent, progress);
  return (
    <FilterProvider path="/projects" entries={filterEntries(cards)} initial={filterFromRecord(sp)}>
      <Toolbar placeholder={SEARCH_PLACEHOLDERS.projects} />
      <div className="grid gap-3">
        {cards.map((card) => (
          <SectionCard key={card.key} card={card} readOnly={readOnly} />
        ))}
        <FilterEmpty />
      </div>
    </FilterProvider>
  );
}
