// Insights (M5a; design spec 10, scope in docs/M5-DESIGN.md): how the signed-in user's learning is
// going, week by week. Read-only. The header renders at once; everything below it waits for one
// data load (getInsights), so it sits in one Suspense boundary with one skeleton. Errors fall to
// the route group's error card.
import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityCard, AtAGlance, CertsCard, MonthCard, PhaseCard, WeeklyCard } from "@/components/insights/cards";
import { PageBanners } from "@/components/PageBanners";
import { type Fact, Facts, PageHeader } from "@/components/PageHeader";
import { InsightsSkeleton } from "@/components/Skeleton";
import { istWeekStart } from "@/lib/dates";
import { getInsights } from "@/lib/data";
import { weekRangeText } from "@/lib/insights-view";
import { getNowMs } from "@/lib/today";

export const metadata: Metadata = { title: "Insights" };

const DESCRIPTION = "How your learning is going, week by week. Weeks run Monday to Sunday in India Standard Time (IST).";

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        title="Insights"
        description={DESCRIPTION}
        factsSlot={
          // The week depends on today, so it streams in ("–" until then), like Home's facts.
          <Suspense fallback={<Facts facts={weekFact(null)} />}>
            <WeekFact />
          </Suspense>
        }
      />
      <PageBanners />
      <Suspense fallback={<InsightsSkeleton />}>
        <InsightsContent />
      </Suspense>
    </>
  );
}

const weekFact = (weekStart: string | null): Fact[] => [{ label: "This week", value: weekStart ? weekRangeText(weekStart) : "–" }];

async function WeekFact() {
  // The request's one clock reading, the same one getInsights uses.
  return <Facts facts={weekFact(istWeekStart(await getNowMs()))} />;
}

async function InsightsContent() {
  // data.settings are the settings the numbers were computed with (the navigation's per-request
  // read): they tell a locked Scaler (never listed as hidden) from one the person switched off.
  const data = await getInsights();
  return (
    <div className="grid gap-3">
      <AtAGlance thisWeek={data.thisWeek} settings={data.settings} />
      <WeeklyCard data={data} />
      <ActivityCard data={data} />
      <div className="grid gap-3 xl:grid-cols-2">
        <PhaseCard data={data} />
        <MonthCard data={data} />
      </div>
      {data.certs.length > 0 && <CertsCard certs={data.certs} />}
    </div>
  );
}
