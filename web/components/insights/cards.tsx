// The Insights page's blocks (design spec 10.2): At a glance, Done per week, Active days, Current
// phase, This month and Certifications. Server Components; the numbers come from getInsights() and
// every word that depends on one from lib/insights-view.ts.
import Link from "next/link";
import { useId } from "react";
import type { CertInsight, Insights } from "@/lib/insights";
import {
  ESTIMATE_LINE,
  PLOT_HEIGHTS,
  STREAK_DEFINITION,
  activeDayCount,
  activeDaysText,
  activityRows,
  activitySummary,
  barLayout,
  certLine,
  chartKinds,
  glanceTiles,
  hasWeeklyCompletions,
  hiddenSectionsLine,
  heatCells,
  keyKinds,
  monthLabels,
  monthText,
  outsideRoadmap,
  paceLine,
  passedCount,
  phaseEndsText,
  projectionText,
  weekLabels,
  weeklyRows,
  weeklySummary,
} from "@/lib/insights-view";
import type { SectionSettings } from "@/lib/sections";
import { phaseChip } from "@/lib/status";
import { CARD_STYLES, CardHead } from "../Card";
import { cn } from "../cn";
import { Facts } from "../PageHeader";
import { Tile } from "../Tile";
import { Count, NameWithCode, ProgressBar, StatusChip } from "../ui";
import { ActivityCalendar, ActivityTable, TableDisclosure, WeeklyChart, WeeklyTable } from "./charts";

const MUTED_LINE = "type-small max-w-[34em] text-muted";
const TEXT_LINK = "font-semibold text-accent underline underline-offset-2";

function InsightCard({
  title,
  sub,
  head,
  children,
  className,
}: {
  title: string;
  sub?: string;
  head?: Omit<React.ComponentProps<typeof CardHead>, "title" | "titleId" | "sub">;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cn(CARD_STYLES, className)}>
      <CardHead titleId={titleId} title={title} sub={sub} {...head} />
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

// ---- A. At a glance

export function AtAGlance({ thisWeek, settings }: { thisWeek: Insights["thisWeek"]; settings: SectionSettings }) {
  const [week, current, longest] = glanceTiles(thisWeek);
  const hidden = hiddenSectionsLine(settings);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2 id={headingId} className="sr-only">
        This week at a glance
      </h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <li className="col-span-2 grid md:col-span-1">
          <Tile value={week.value} label={week.label} srOnly={week.sr} />
        </li>
        <li className="grid">
          <Tile value={current.value} label={current.label}>
            {current.hint && <span className="type-small text-muted">{current.hint}</span>}
          </Tile>
        </li>
        <li className="grid">
          <Tile value={longest.value} label={longest.label} />
        </li>
      </ul>
      <p className={MUTED_LINE}>{STREAK_DEFINITION}</p>
      {hidden && (
        <p className={MUTED_LINE}>
          {hidden.text}{" "}
          <Link href="/settings" className={cn(TEXT_LINK, "whitespace-nowrap")}>
            {hidden.link}
          </Link>
        </p>
      )}
    </section>
  );
}

// ---- B. Done per week

export function WeeklyCard({ data }: { data: Insights }) {
  const kinds = chartKinds(data.kinds);
  const thisWeek = data.thisWeek.weekStart;
  const any = hasWeeklyCompletions(data.weekly);
  const keys = keyKinds(data.weekly, kinds);
  return (
    <InsightCard title="Done per week" sub="Last 12 weeks. An item counts in the week you marked it done; if you untick it, it leaves the chart.">
      {any ? (
        <>
          <WeeklyChart
            phoneBars={barLayout(data.weekly, kinds, PLOT_HEIGHTS.phone, thisWeek)}
            wideBars={barLayout(data.weekly, kinds, PLOT_HEIGHTS.wide, thisWeek)}
            labels={weekLabels(data.weekly.map((w) => w.weekStart))}
            keys={keys}
            summary={weeklySummary(data.weekly, keys, thisWeek)}
          />
          <TableDisclosure>
            <WeeklyTable rows={weeklyRows(data.weekly, kinds, thisWeek)} />
          </TableDisclosure>
        </>
      ) : (
        <p className={MUTED_LINE}>
          Nothing marked done in the last 12 weeks. Tick your first item to start your weekly chart.{" "}
          <Link href="/roadmap" className={TEXT_LINK}>
            Go to the Roadmap
          </Link>
        </p>
      )}
    </InsightCard>
  );
}

// ---- C. Active days

export function ActivityCard({ data }: { data: Insights }) {
  const { activity, today } = data;
  return (
    <InsightCard title="Active days" sub="Last 26 weeks. A day is active when you tick or untick an item, or save a note or link.">
      {activity.hasActivity ? (
        <>
          <Facts
            facts={[
              { label: "Last 30 days", value: activeDaysText(activity.activeDays30) },
              { label: "Last 26 weeks", value: activeDaysText(activeDayCount(activity.days)) },
            ]}
          />
          <ActivityCalendar
            cells={heatCells(activity.days, activity.windowStart, today)}
            months={monthLabels(activity.days, activity.windowStart)}
            summary={activitySummary(activity.days, activity.activeDays30, today)}
          />
          {activity.reachesBeforeHistory && <p className={cn(MUTED_LINE, "mt-3")}>{ESTIMATE_LINE}</p>}
          <TableDisclosure>
            <ActivityTable rows={activityRows(activity.days, activity.windowStart, today)} />
          </TableDisclosure>
        </>
      ) : (
        <p className={MUTED_LINE}>No activity in the last 26 weeks yet. Each day you tick an item or save a note fills in a square here.</p>
      )}
    </InsightCard>
  );
}

// ---- D. Current phase

export function PhaseCard({ data }: { data: Insights }) {
  const { phase, today } = data;
  const outside = phase.inDates ? null : outsideRoadmap(today);
  if (outside) {
    return (
      <InsightCard title="Current phase">
        <p className={MUTED_LINE}>
          {outside.text}{" "}
          <Link href="/roadmap" className={TEXT_LINK}>
            Go to the Roadmap
          </Link>
        </p>
      </InsightCard>
    );
  }
  const projection = projectionText(phase);
  return (
    <InsightCard
      title="Current phase"
      sub={`Phase ${phase.n} · ${phase.title}`}
      head={{ chip: phaseChip(phase, today, phase.done, phase.total), done: phase.done, total: phase.total }}
    >
      <ProgressBar percent={phase.total > 0 ? (phase.done / phase.total) * 100 : 0} />
      <div className="mt-3">
        <Facts facts={[{ label: "Ends", value: phaseEndsText(phase) }, ...(projection ? [{ label: "Projected finish", value: projection }] : [])]} />
      </div>
      <p className={cn(MUTED_LINE, "mt-2")}>{paceLine(phase)}</p>
    </InsightCard>
  );
}

// ---- E. This month

export function MonthCard({ data }: { data: Insights }) {
  const m = data.thisMonth;
  const text = monthText(m);
  return (
    <InsightCard title="This month" sub={text.since}>
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col-reverse">
          <dt className="type-small text-muted">{text.notesLabel}</dt>
          <dd className="type-num-lg text-ink">{m.notesSaved}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="type-small text-muted">{text.resourcesLabel}</dt>
          <dd className="type-num-lg text-ink">{m.resourcesDone}</dd>
        </div>
      </dl>
      {text.historyLine && <p className={cn(MUTED_LINE, "mt-3")}>{text.historyLine}</p>}
      {text.emptyLine && <p className={cn(MUTED_LINE, "mt-3")}>{text.emptyLine}</p>}
    </InsightCard>
  );
}

// ---- F. Certifications

function CertRow({ cert }: { cert: CertInsight }) {
  return (
    <li className="grid gap-1.5 border-t border-line px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="type-body-strong min-w-0 flex-[1_1_180px] [overflow-wrap:anywhere]">
          <NameWithCode name={cert.name} />
        </p>
        <div className="flex items-center gap-3 whitespace-nowrap">
          {cert.passed ? <StatusChip chip={{ label: "Passed", variant: "ok" }} /> : <Count done={cert.done} total={cert.total} />}
        </div>
      </div>
      <p className="type-small max-w-[34em] text-muted">{certLine(cert)}</p>
      <ProgressBar percent={cert.total > 0 ? (cert.done / cert.total) * 100 : 0} />
    </li>
  );
}

export function CertsCard({ certs }: { certs: readonly CertInsight[] }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={CARD_STYLES}>
      <CardHead titleId={titleId} title="Certifications" sub="Prep steps done, in the order to take them." done={passedCount(certs)} total={certs.length} countWord="passed" />
      {/* From xl two columns, filled row by row in rank order. The top border of each row is the divider. */}
      <ul className="grid xl:grid-cols-2 xl:gap-x-6">
        {certs.map((c) => (
          <CertRow key={c.index} cert={c} />
        ))}
      </ul>
    </section>
  );
}
