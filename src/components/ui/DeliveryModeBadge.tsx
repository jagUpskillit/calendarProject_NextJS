import type { DeliveryMode } from "@/types";
import { Badge } from "./Badge";

const modeConfig: Record<
  DeliveryMode,
  { label: string; variant: "blue" | "green" | "purple" | "gray" }
> = {
  Virtual:    { label: "🌐 Virtual",    variant: "blue"   },
  "In-Person":{ label: "🏢 In-Person",  variant: "green"  },
  Hybrid:     { label: "🔀 Hybrid",     variant: "purple" },
  Unknown:    { label: "❓ Unknown",    variant: "gray"   },
};

export function DeliveryModeBadge({ mode }: { mode: DeliveryMode }) {
  const cfg = modeConfig[mode] ?? modeConfig.Unknown;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
