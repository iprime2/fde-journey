// Courses & badges: vendor courses from OpenAI and Anthropic (web/docs/COURSES.md). Always on,
// like Roadmap: no Settings switch. Built like Reading: one card per provider, rows with a tick,
// a note and a link, plus a tag filter for badges, top picks and phases.
import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterEmpty } from "@/components/filter/Filtered";
import { FilterProvider } from "@/components/filter/FilterProvider";
import { Toolbar } from "@/components/filter/Toolbar";
import { PageBanners } from "@/components/PageBanners";
import { type Fact, Facts, PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCards";
import { ListSkeleton } from "@/components/Skeleton";
import { ExternalLink } from "@/components/ui";
import { COURSES, COURSE_GROUPS, COURSE_PHASE_NAMES, COURSE_SOURCES, COURSES_DISCLAIMER } from "@/content/courses";
import { COURSES_DESCRIPTION, SEARCH_PLACEHOLDERS } from "@/content/page-copy";
import { getProgress } from "@/lib/data";
import { filterFromRecord } from "@/lib/filter";
import { isReadOnly } from "@/lib/mode";
import { type CourseFacts, courseFacts, courseTagOptions, coursesView, filterEntries, formatHours, knownHours } from "@/lib/views";

export const metadata: Metadata = { title: "Courses & badges" };

const TAG_OPTIONS = courseTagOptions(COURSES, COURSE_PHASE_NAMES);
const TAGS = TAG_OPTIONS.map((o) => o.value).filter(Boolean);
const HOURS = knownHours(COURSES);

export default function CoursesPage({ searchParams }: PageProps<"/courses">) {
  return (
    <>
      <PageHeader
        title="Courses & badges"
        description={COURSES_DESCRIPTION}
        factsSlot={
          // Done and badges earned read saved progress, so they stream in ("–" until then).
          <Suspense fallback={<Facts facts={courseFactList(null)} />}>
            <CourseFactsLoaded />
          </Suspense>
        }
      />
      <PageBanners />
      <Suspense fallback={<ListSkeleton />}>
        <CoursesContent searchParams={searchParams} />
      </Suspense>
      <div className="type-small grid max-w-[34em] gap-1 text-muted">
        <p>{COURSES_DISCLAIMER}</p>
        <p>
          Sources:{" "}
          {COURSE_SOURCES.map((s, i) => (
            <span key={s.url}>
              <ExternalLink href={s.url}>{s.label}</ExternalLink>
              {i < COURSE_SOURCES.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </div>
    </>
  );
}

/** Total, done, badges earned and the hours the providers state. `null` while loading. */
function courseFactList(f: CourseFacts | null): Fact[] {
  return [
    { label: "Courses", value: COURSES.length },
    { label: "Done", value: f ? `${f.done} of ${f.total}` : "–" },
    { label: "Badges earned", value: f ? `${f.badgesEarned} of ${f.badges}` : "–" },
    { label: "Stated length", value: `${formatHours(HOURS)} · ${HOURS.courses} courses` },
  ];
}

async function CourseFactsLoaded() {
  return <Facts facts={courseFactList(courseFacts(COURSES, await getProgress()))} />;
}

async function CoursesContent({ searchParams }: Pick<PageProps<"/courses">, "searchParams">) {
  const [sp, progress, readOnly] = await Promise.all([searchParams, getProgress(), isReadOnly()]);
  const cards = coursesView(COURSES, COURSE_GROUPS, COURSE_PHASE_NAMES, progress);
  return (
    <FilterProvider path="/courses" entries={filterEntries(cards)} initial={filterFromRecord(sp, TAGS)} tags={TAGS}>
      <Toolbar placeholder={SEARCH_PLACEHOLDERS.courses} tagFilter={{ label: "Badge, pick or phase", options: TAG_OPTIONS }} />
      <div className="grid gap-3">
        {cards.map((card) => (
          <SectionCard key={card.key} card={card} readOnly={readOnly} />
        ))}
        <FilterEmpty />
      </div>
    </FilterProvider>
  );
}
