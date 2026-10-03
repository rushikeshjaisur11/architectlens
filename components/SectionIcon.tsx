import { Blocks, BrainCircuit, Network, Wrench } from "lucide-react";
import type { SectionIconKey } from "@/lib/track-meta";

const ICONS = { network: Network, brain: BrainCircuit, blocks: Blocks, wrench: Wrench };

export function SectionIcon({ name, size = 18, className }: { name: SectionIconKey; size?: number; className?: string }) {
  const Icon = ICONS[name];
  return <Icon size={size} className={className} aria-hidden />;
}
