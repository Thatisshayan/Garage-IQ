import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Phone, Car, AlertTriangle, Wrench, ShieldCheck, Package, Banknote, Hourglass } from "lucide-react";
import { todayBoard } from "@/lib/today.functions";

export const Route = createFileRoute("/_authenticated/today/")({
  head: () => ({ meta: [{ title: "Today — Workshop OpsDeck" }] }),
  component: TodayBoard,
});

const BLOCKER_META: Record<string, { label: string; tag: string; icon: any; tone: string }> = {
  awaiting_insurance: { label: "Waiting on insurance", tag: "BLOCKED", icon: ShieldCheck, tone: "text-blue-400" },
  parts_ordered: { label: "Waiting on parts", tag: "INCOMING", icon: Package, tone: "text-amber-400" },
  in_progress: { label: "On the lift", tag: "ACTIVE", icon: Wrench, tone: "text-primary" },
  awaiting_payment: { label: "Ready — needs payment", tag: "PICKUP", icon: Banknote, tone: "text-green-400" },
  pending: { label: "Just arrived", tag: "NEW", icon: Hourglass, tone: "text-muted-foreground" },
};

const ORDER = ["awaiting_payment", "in_progress", "parts_ordered", "awaiting_insurance", "pending"] as const;

function TodayBoard() {
  const fn = useServerFn(todayBoard);
  const { data } = useSuspenseQuery({ queryKey: ["today"], queryFn: () => fn(), refetchInterval: 60_000 });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] tick uppercase tracking-[0.22em] text-muted-foreground">Floor View</div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold">Today</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.counts.active} active {data.counts.active === 1 ? "job" : "jobs"} · {data.counts.flagged} flagged
          </p>
        </div>
        <Link
          to="/m/intake"
          className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          + Quick intake
        </Link>
      </header>

      <div className="space-y-6">
        {ORDER.map((status) => {
          const jobs = data.buckets[status] ?? [];
          if (jobs.length === 0) return null;
          const meta = BLOCKER_META[status];
          const Icon = meta.icon;
          return (
            <section key={status}>
              <div className="flex items-center gap-3 mb-3">
                <Icon className={`w-4 h-4 ${meta.tone}`} strokeWidth={2.2} />
                <h2 className="font-display text-lg font-semibold">{meta.label}</h2>
                <span className="text-[10px] tick px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {meta.tag} · {jobs.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {jobs.map((j: any, i: number) => (
                  <motion.div
                    key={j.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    className="relative border border-border rounded-lg p-4 bg-card hover:border-primary transition-colors group"
                  >
                    {j.flagged && (
                      <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] tick text-amber-400">
                        <AlertTriangle className="w-3 h-3" /> FLAGGED
                      </span>
                    )}
                    <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="block">
                      <div className="text-sm font-medium line-clamp-2">{j.description || "(no description)"}</div>
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Car className="w-3.5 h-3.5" />
                        <span className="truncate">
                          {[j.vehicle?.year, j.vehicle?.make, j.vehicle?.model].filter(Boolean).join(" ") || "—"}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground mt-1">
                        {j.vehicle?.license_plate || j.vehicle?.vin || ""}
                      </div>
                    </Link>
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">{j.customer?.name}</div>
                        {j.outstanding !== null && j.outstanding > 0 && (
                          <div className="text-[11px] text-amber-400 mt-0.5">
                            CAD {j.outstanding.toFixed(2)} outstanding
                          </div>
                        )}
                        {j.outstanding !== null && j.outstanding <= 0 && j.total_owed && (
                          <div className="text-[11px] text-green-400 mt-0.5">Paid in full</div>
                        )}
                      </div>
                      {j.customer?.phone && (
                        <a
                          href={`tel:${j.customer.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs hover:bg-primary/25 transition"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}

        {data.counts.active === 0 && (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
            <Wrench className="w-8 h-8 mx-auto opacity-40 mb-3" />
            No active jobs. Quiet day on the floor.
          </div>
        )}
      </div>
    </div>
  );
}
