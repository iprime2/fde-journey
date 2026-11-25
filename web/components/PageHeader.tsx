// Page header and facts (design spec 4, PageHeader and Facts). Server Component.

export interface Fact {
  label: string;
  value: React.ReactNode;
}

export function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="mt-1 flex flex-wrap gap-x-[18px] gap-y-2">
      {facts.map((f) => (
        <div key={f.label} className="flex flex-wrap items-baseline gap-x-1.5">
          <dt className="type-label text-muted">{f.label}</dt>
          <dd className="type-small font-medium text-ink">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  facts,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  facts?: Fact[];
}) {
  return (
    <header className="grid gap-1.5">
      {eyebrow && <p className="type-label text-accent">{eyebrow}</p>}
      {/* tabIndex -1: focus moves here after client navigation (components/nav/RouteFocus.tsx). */}
      <h1 tabIndex={-1} className="type-display w-fit">
        {title}
      </h1>
      {description && <p className="type-small max-w-[65ch] text-muted">{description}</p>}
      {facts && <Facts facts={facts} />}
    </header>
  );
}
