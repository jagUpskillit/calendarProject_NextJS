import { Suspense } from "react";
import { SupportClient } from "@/components/support/SupportClient";

function SupportFallback() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
      Loading support form...
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportFallback />}>
      <SupportClient />
    </Suspense>
  );
}

