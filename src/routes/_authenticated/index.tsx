import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dashboardStats } from "@/lib/jobs.functions";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Workshop OpsDeck" }] }),
  component: Dashboard,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_insurance: "Awaiting Insurance",
  parts_ordered: "Parts Ordered",
  in_progress: "In Progress",
  awaiting_payment: "Awaiting Payment",
  completed: "Completed",
};

function Dashboard() {
  const fn = useServerFn(dashboardStats);
  const { data } = useSuspenseQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</div>
        <h1 className="text-3xl font-semibold">Workshop overview</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Review queue" value={data.reviewCount} to="/review-queue" tone="amber" />
        <Kpi label="Unpaid invoices" value={data.unpaidCount} to="/invoices" />
        <Kpi label="Pending claims" value={data.pendingClaims} to="/claims" />
        <Kpi label="Flagged jobs" value={data.flagged} to="/jobs" tone="amber" />
      </div>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Jobs by status</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <Link
              key={k}
              to="/jobs"
              className="border border-border bg-card rounded-md p-4 hover:border-primary transition-colors"
            >
              <div className="text-2xl font-semibold">{data.jobsByStatus[k] ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, to, tone }: { label: string; value: number; to: string; tone?: "amber" }) {
  return (
    <Link to={to} className={`border rounded-md p-4 bg-card hover:border-primary transition-colors ${tone === "amber" && value > 0 ? "border-[oklch(0.769_0.188_70.08)]" : "border-border"}`}>
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{label}</div>
    </Link>
  );
}
