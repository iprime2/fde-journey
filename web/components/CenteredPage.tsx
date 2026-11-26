import { BrandLockup } from "./Brand";

// The phone layout of /login at every width (design spec 5, Not found): one centred column, max
// 400 px, with the lockup on top so the owner can tell they are still in the app. Used by the
// not-found page and the top-level error page (no sidebar or bottom bar).
export function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      className="grid min-h-dvh content-start pt-[max(32px,env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pb-10 pl-[max(16px,env(safe-area-inset-left))] md:pt-16"
    >
      <div className="mx-auto grid w-full max-w-[400px] content-start gap-6">
        <BrandLockup />
        {children}
      </div>
    </main>
  );
}
