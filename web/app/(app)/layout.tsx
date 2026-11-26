// Frame for every signed-in page: sidebar on desktop, bottom bar on phones (design spec 3).
// The save status (signed out while using, failed saves, offline) is shared by every page.
import { MidnightRefresh } from "@/components/MidnightRefresh";
import { BottomBar } from "@/components/nav/BottomBar";
import { RouteFocus } from "@/components/nav/RouteFocus";
import { Sidebar } from "@/components/nav/Sidebar";
import { SaveStatusProvider } from "@/components/save/SaveStatusProvider";
import { SessionKeeper } from "@/components/SessionKeeper";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SaveStatusProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md border border-line-strong bg-surface type-body-strong text-accent shadow-overlay focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4 focus:py-2.5"
      >
        Skip to content
      </a>
      <Sidebar />
      <main
        id="main"
        className="pt-[max(24px,env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pb-[calc(24px+64px+env(safe-area-inset-bottom))] pl-[max(16px,env(safe-area-inset-left))] lg:ml-[248px] lg:px-8 lg:pt-10 lg:pb-16"
      >
        <div className="mx-auto grid w-full max-w-[960px] gap-5 lg:gap-6">{children}</div>
      </main>
      <BottomBar />
      <RouteFocus />
      <SessionKeeper />
      <MidnightRefresh />
    </SaveStatusProvider>
  );
}
