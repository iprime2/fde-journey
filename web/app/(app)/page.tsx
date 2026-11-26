import { Suspense } from "react";
import { BannerArea } from "@/components/BannerArea";
import { Countdown, NextClass } from "@/components/clock";
import { NowPanel, StatTiles } from "@/components/home";
import { PageHeader } from "@/components/PageHeader";
import { HomeSkeleton } from "@/components/Skeleton";
import { CLASS_SCHEDULE_LABEL, READINESS_REVIEW } from "@/content/schedule";
import { trackerContent } from "@/content/tracker-data";
import { pageBanners } from "@/lib/banners";
import { formatDate } from "@/lib/dates";
import { getProgress } from "@/lib/data";
import { isReadOnly } from "@/lib/mode";
import { dashboardModel } from "@/lib/summary";
import { getTodayIst } from "@/lib/today";

const phases = trackerContent.phases;
const JOURNEY = `${formatDate(phases[0].start)} – ${formatDate(phases[phases.length - 1].end)}`;

export default function HomePage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            AI Engineering &amp; FDE · <span className="whitespace-nowrap">{JOURNEY}</span>
          </>
        }
        title="FDE Journey"
        facts={[
          { label: "Scaler classes", value: CLASS_SCHEDULE_LABEL },
          { label: "Next class", value: <NextClass /> },
          { label: "Readiness review", value: <Countdown /> },
        ]}
      />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
      <p className="type-small text-muted">
        {formatDate(READINESS_REVIEW)} is a portfolio and job-readiness milestone, not a deadline to pass every
        certification.
      </p>
    </>
  );
}

async function HomeContent() {
  const [progress, today, readOnly] = await Promise.all([getProgress(), getTodayIst(), isReadOnly()]);
  const model = dashboardModel(trackerContent, progress, today);
  return (
    <>
      <BannerArea banners={pageBanners({ readOnly, isHome: true, hasProgress: model.hasProgress })} />
      <StatTiles tiles={model.tiles} />
      <NowPanel now={model.now} />
    </>
  );
}
