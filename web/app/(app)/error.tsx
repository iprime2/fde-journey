"use client"; // Error boundaries must be Client Components

import { ErrorCard } from "@/components/ErrorCard";

// Errors inside a section page: the sidebar and bottom bar stay usable.
export default function SectionError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorCard retry={retry} />;
}
