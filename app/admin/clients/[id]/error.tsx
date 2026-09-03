"use client";

import { ClientDetailError } from "@/components/client-detail/error-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClientDetailError error={error} reset={reset} />;
}
