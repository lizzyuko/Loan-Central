import type { ApplicationStatus } from "@/db/schema/enums";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/application/status";
import { Badge } from "@/components/ui/Feedback";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
