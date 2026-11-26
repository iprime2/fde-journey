import { Suspense } from "react";
import { BannerArea } from "@/components/BannerArea";
import { Countdown, NextClass } from "@/components/clock";
import { NowPanel, StatTiles } from "@/components/home";
import { mySections } from "@/components/nav/navData";
import { Facts } from "@/components/PageHeader";
import { PageHeader } from "@/components/PageHeader";
import { HomeSkeleton } from "@/components/Skeleton";
import { CLASS_SCHEDULE_LABEL, READINESS_REVIEW } from "@/content/schedule";
import { trackerContent } from "@/content/tracker-data";
import { pageBanners } from "@/lib/banners";
import { formatDate } from "@/lib/dates";
import { getProgress } from "@/lib/data";
import { isReadOnly } from "@/lib/mode";
import { dashboardModel } from "@/lib/summary";
import { offSectionsPrompt } from "@/lib/nav";
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
        factsSlot={
          // "Scaler classes" and "Next class" show only while Scaler is on (design spec 5).
          <Suspense fallback={<Facts facts={[READINESS_FACT]} />}>
            <HomeFacts />
          </Suspense>
        }
      />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
      <p className="type-small max-w-[34em] text-muted">
        {formatDate(READINESS_REVIEW)} is a portfolio and job-readiness milestone, not a deadline to pass every
        certification.
      </p>
    </>
  );
}

const READINESS_FACT = { label: "Readiness review", value: <Countdown /> };

async function HomeFacts() {
  const sections = await mySections();
  return (
    <Facts
      facts={[
        ...(sections.scaler
          ? [
              { label: "Scaler classes", value: CLASS_SCHEDULE_LABEL },
              { label: "Next class", value: <NextClass /> },
            ]
          : []),
        READINESS_FACT,
      ]}
    />
  );
}

/** The three Roadmap tiles always show; the others only while their section is on. */
const ALWAYS_TILES = new Set(["milestones", "learning", "resources"]);

async function HomeContent() {
  const [progress, today, readOnly, sections] = await Promise.all([getProgress(), getTodayIst(), isReadOnly(), mySections()]);
  const model = dashboardModel(trackerContent, progress, today);
  const tiles = model.tiles.filter((t) => ALWAYS_TILES.has(t.key) || sections[t.key as keyof typeof sections]);
  return (
    <>
      <BannerArea banners={pageBanners({ readOnly, isHome: true, hasProgress: model.hasProgress, offPrompt: offSectionsPrompt(sections) })} />
      <StatTiles tiles={tiles} />
      <NowPanel now={model.now} showScaler={sections.scaler} />
    </>
  );
}
