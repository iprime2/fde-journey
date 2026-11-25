// Frame for every signed-in page: sidebar on desktop, bottom bar on phones (design spec 3).
import { BottomBar } from "@/components/nav/BottomBar";
import { RouteFocus } from "@/components/nav/RouteFocus";
import { Sidebar } from "@/components/nav/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2.5 type-body-strong text-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
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
    </>
  );
}
