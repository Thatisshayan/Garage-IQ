import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { listJobs, overrideJobStatus } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({ meta: [{ title: "Jobs — Garage IQ" }] }),
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
  const override = useServerFn(overrideJobStatus);
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [changingId, setChangingId] = useState<string | null>(null);

  // Auto-refresh every 30s so the kanban reflects changes from document AI etc.
  const { data } = useSuspenseQuery({
    queryKey: ["jobs"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  async function quickChange(jobId: string, newStatus: string, description: string) {
    setChangingId(jobId);
    try {
      await override({
        data: {
          id: jobId,
          status: newStatus as any,
          reason: `Kanban: moved to ${LABELS[newStatus] ?? newStatus}`,
        },
      });
      toast.success(`Moved to ${LABELS[newStatus] ?? newStatus}`);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChangingId(null);
    }
  }
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Work Orders</div>
          <h1 className="text-3xl font-semibold">Jobs</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            Kanban
          </Button>
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("table")}
          >
            Table
          </Button>
          <Link to="/jobs/new">
            <Button size="sm">+ New Job</Button>
          </Link>
        </div>
      </div>
      {view === "kanban" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STATUSES.map((s) => (
            <div key={s} className="bg-card border border-border rounded-md p-3 min-h-[200px]">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                {LABELS[s]}
              </div>
              <div className="space-y-2">
                {data
                  .filter((j: any) => j.status === s)
                  .map((j: any) => (
                    <div key={j.id} className="group relative">
                      <Link
                        to="/jobs/$jobId"
                        params={{ jobId: j.id }}
                        className="block p-2 rounded bg-background border border-border hover:border-primary text-sm"
                      >
                        <div className="font-medium truncate">
                          {j.description || "(no description)"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{j.customer?.name}</div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {j.vehicle?.license_plate ?? j.vehicle?.vin}
                        </div>
                        {j.flagged && (
                          <div className="text-xs text-[oklch(0.769_0.188_70.08)] mt-1">
                            ⚑ flagged
                          </div>
                        )}
                      </Link>
                      {/* Inline status change — appears on hover */}
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <select
                          value=""
                          disabled={changingId === j.id}
                          onChange={(e) => {
                            if (e.target.value) quickChange(j.id, e.target.value, j.description);
                            e.target.value = "";
                          }}
                          className="text-[10px] bg-card border border-border rounded py-0.5 px-1 cursor-pointer"
                        >
                          <option value="">{changingId === j.id ? "..." : "\u2192"}</option>
                          {STATUSES.filter((st) => st !== s).map((st) => (
                            <option key={st} value={st}>
                              {LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
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
                <td className="p-3">
                  <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="hover:underline">
                    {j.description || "(no description)"}
                  </Link>
                </td>
                <td className="p-3">{j.customer?.name}</td>
                <td className="p-3 font-mono text-xs">
                  {j.vehicle?.license_plate ?? j.vehicle?.vin}
                </td>
                <td className="p-3">
                  <Badge status={j.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
      {LABELS[status] ?? status}
    </span>
  );
}
