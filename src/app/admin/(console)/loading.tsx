import { Skeleton } from "@/components/ui/Feedback";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Skeleton width={240} height={32} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={88} radius={14} />
        ))}
      </div>
      <Skeleton height={360} radius={14} />
    </div>
  );
}
