/**
 * src/components/community/StatusBadge.tsx
 *
 * Small colored pill for an answer's review status. Shared by the question
 * detail, My Contributions, and admin review pages so status colors stay
 * consistent with the existing /resolve panel palette.
 */

import { cn } from "@/lib/utils";
import type { AnswerStatus } from "@/lib/community/constants";

const META: Record<AnswerStatus, { label: string; cls: string }> = {
  pending_review: { label: "Pending review", cls: "bg-accent/10 text-accent" },
  approved: { label: "Approved", cls: "bg-success/20 text-success" },
  rejected: { label: "Rejected", cls: "bg-danger/20 text-danger" },
  needs_admin_review: {
    label: "Needs admin review",
    cls: "bg-yellow-500/20 text-yellow-500",
  },
  hidden: { label: "Hidden", cls: "bg-muted/20 text-muted" },
  deleted: { label: "Deleted", cls: "bg-muted/20 text-muted" },
};

export default function StatusBadge({ status }: { status: AnswerStatus }) {
  const m = META[status] ?? META.pending_review;
  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
        m.cls
      )}
    >
      {m.label}
    </span>
  );
}
