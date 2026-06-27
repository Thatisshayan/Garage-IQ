import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listJobs } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({ meta: [{ title: "Jobs — Workshop OpsDeck" }] }),
  component: JobsList,
});

const STATUSES = [
  "pending",
  "awaiting_insurance",
  "parts_ordered",
  "in_progress",
  "awaiting_payment",
  "completed",
] as const;

const LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_insurance: "Awaiting Insurance",
  parts_ordered: "Parts Ordered",
  in_progress: "In Progress",
  awaiting_payment: "Awaiting Payment",
  completed: "Completed",
};

function JobsList() {
  const fn = useServerFn(listJobs);
  const { data } = useSuspenseQuery({ queryKey: ["jobs"], queryFn: () => fn() });
  const [view, setView] = useState<"kanban" | "table">("kanban");
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Work Orders</div>
          <h1 className="text-3xl font-semibold">Jobs</h1>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}>Kanban</Button>
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}>Table</Button>
          <Link to="/jobs/new"><Button size="sm">+ New Job</Button></Link>
        </div>
      </div>
      {view === "kanban" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STATUSES.map((s) => (
            <div key={s} className="bg-card border border-border rounded-md p-3 min-h-[200px]">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{LABELS[s]}</div>
              <div className="space-y-2">
                {data.filter((j: any) => j.status === s).map((j: any) => (
                  <Link key={j.id} to="/jobs/$jobId" params={{ jobId: j.id }} className="block p-2 rounded bg-background border border-border hover:border-primary text-sm">
                    <div className="font-medium truncate">{j.description || "(no description)"}</div>
                    <div className="text-xs text-muted-foreground mt-1">{j.customer?.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{j.vehicle?.license_plate ?? j.vehicle?.vin}</div>
                    {j.flagged && <div className="text-xs text-[oklch(0.769_0.188_70.08)] mt-1">⚑ flagged</div>}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full text-sm border border-border rounded-md overflow-hidden">
          <thead className="bg-card">
            <tr className="text-left">
              <th className="p-3">Description</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Vehicle</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((j: any) => (
              <tr key={j.id} className="border-t border-border hover:bg-accent">
                <td className="p-3"><Link to="/jobs/$jobId" params={{ jobId: j.id }} className="hover:underline">{j.description || "(no description)"}</Link></td>
                <td className="p-3">{j.customer?.name}</td>
                <td className="p-3 font-mono text-xs">{j.vehicle?.license_plate ?? j.vehicle?.vin}</td>
                <td className="p-3"><Badge status={j.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  return <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{LABELS[status] ?? status}</span>;
}
