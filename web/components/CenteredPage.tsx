// One centred column, max 400 px: 64 px from the top on a phone, vertically centred on desktop.
// Used by /login, the not-found page and the top-level error page (no sidebar or bottom bar).
export function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      className="grid min-h-dvh pt-16 pr-[max(16px,env(safe-area-inset-right))] pb-16 pl-[max(16px,env(safe-area-inset-left))] lg:items-center lg:pt-16"
    >
      <div className="mx-auto grid w-full max-w-[400px] content-start gap-5">{children}</div>
    </main>
  );
}
