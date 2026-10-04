import { Skeleton } from "@/components/ui/Feedback";

export default function PortalLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Skeleton width={220} height={32} />
      <Skeleton height={280} radius={14} />
      <Skeleton height={160} radius={14} />
    </div>
  );
}
