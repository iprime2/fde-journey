"use client";

import { useEffect, useState } from "react";

/** After 3 seconds of loading, explain why (the free database sleeps when idle). */
export function StillLoading() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLate(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <p className="type-small text-muted" role="status">
      {late ? "Still loading. The first load after a quiet spell can take a few seconds." : ""}
    </p>
  );
}
