import { Suspense } from "react";
import { AppLayout } from "@/components/AppLayout";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <AppLayout />
    </Suspense>
  );
}
