"use client"; // Error boundaries must be Client Components

import { CenteredPage } from "@/components/CenteredPage";
import { ErrorCard } from "@/components/ErrorCard";

// Errors outside the section pages (the sign-in page, or the section frame itself).
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <CenteredPage>
      <ErrorCard retry={retry} />
    </CenteredPage>
  );
}
