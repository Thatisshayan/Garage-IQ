import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { dashboardStats } from "@/lib/jobs.functions";
import { Counter, stagger, itemUp } from "@/components/motion-primitives";
import { ArrowUpRight, Activity, AlertTriangle, Inbox, Receipt, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Overview — Garage IQ" }] }),
  component: Dashboard,
});

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending intake", tone: "oklch(0.7 0.02 250)" },
  awaiting_insurance: { label: "Awaiting insurance", tone: "oklch(0.86 0.17 90)" },
  parts_ordered: { label: "Parts ordered", tone: "oklch(0.78 0.16 200)" },
  in_progress: { label: "In progress", tone: "oklch(0.8 0.18 62)" },
  awaiting_payment: { label: "Awaiting payment", tone: "oklch(0.78 0.16 320)" },
  completed: { label: "Completed", tone: "oklch(0.78 0.16 165)" },
};

function Dashboard() {
  const fn = useServerFn(dashboardStats);
  const { data } = useSuspenseQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  const totalJobs = Object.values(data.jobsByStatus).reduce((a: number, b: any) => a + (b ?? 0), 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      {/* HERO */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-end justify-between gap-6 pt-4"
      >
        <div>
          <div className="flex items-center gap-2 text-[11px] tick uppercase tracking-[0.24em] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
            Live · Bay status
          </div>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.02]">
            Garage <span className="ember-text">command deck</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg">
            Every claim, every car, every document — orchestrated. {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}.
          </p>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1">
          <div className="text-[10px] tick uppercase tracking-[0.24em] text-muted-foreground">Active jobs</div>
          <div className="tick text-5xl font-semibold ember-text"><Counter value={totalJobs} /></div>
        </div>
      </motion.header>

      {/* KPI BENTO */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-12 gap-3">
        <Kpi className="col-span-12 md:col-span-3" label="Review queue" value={data.reviewCount} icon={Inbox} to="/review-queue" hot={data.reviewCount > 0} hint="AI uncertainty" />
        <Kpi className="col-span-12 md:col-span-3" label="Unpaid invoices" value={data.unpaidCount} icon={Receipt} to="/invoices" hint="Outstanding" />
        <Kpi className="col-span-12 md:col-span-3" label="Pending claims" value={data.pendingClaims} icon={ShieldAlert} to="/claims" hint="Insurer waiting" />
        <Kpi className="col-span-12 md:col-span-3" label="Flagged jobs" value={data.flagged} icon={AlertTriangle} to="/jobs" hot={data.flagged > 0} hint="Manual review" />
      </motion.div>

      {/* PIPELINE */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[10px] tick uppercase tracking-[0.24em] text-muted-foreground">Pipeline</div>
            <h2 className="font-display text-2xl font-semibold mt-1">Jobs by status</h2>
          </div>
          <Link to="/jobs" className="text-xs tick uppercase tracking-[0.18em] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            Open board <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(STATUS_META).map(([k, meta]) => {
            const v = data.jobsByStatus[k] ?? 0;
            const pct = totalJobs ? (v / totalJobs) * 100 : 0;
            return (
              <motion.div key={k} variants={itemUp}>
                <Link to="/jobs" className="block group">
                  <div className="panel p-4 relative overflow-hidden h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-border">
                      <motion.div
                        className="h-full"
                        style={{ background: meta.tone }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                      />
                    </div>
                    <div className="tick text-3xl font-semibold"><Counter value={v} /></div>
                    <div className="mt-2 text-[11px] text-muted-foreground leading-tight">{meta.label}</div>
                    <div className="mt-3 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full" style={{ background: meta.tone }} />
                      <span className="text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <QuickCard to="/jobs/new" title="Open work order" desc="Spin up a new repair ticket." accent />
        <QuickCard to="/documents" title="Upload documents" desc="Drag invoices, claims, photos — AI extracts." />
        <QuickCard to="/assistant" title="Ask the assistant" desc="Natural-language queries across the shop." />
      </section>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, to, hot, hint, className = "" }: any) {
  return (
    <motion.div variants={itemUp} className={className}>
      <Link to={to} className="block group h-full">
        <div className={`panel p-5 h-full relative overflow-hidden transition-all group-hover:-translate-y-0.5 ${hot ? "border-primary/50 ember-glow" : "group-hover:border-primary/30"}`}>
          {hot && <div className="absolute inset-0 stripes opacity-50 pointer-events-none" />}
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] tick uppercase tracking-[0.22em] text-muted-foreground">
                <Icon className="w-3 h-3" />
                {label}
              </div>
              <div className="mt-3 tick text-4xl font-semibold">
                <Counter value={value} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function QuickCard({ to, title, desc, accent }: { to: string; title: string; desc: string; accent?: boolean }) {
  return (
    <Link to={to} className="group">
      <div className={`panel p-5 h-full transition-all group-hover:-translate-y-0.5 ${accent ? "border-primary/40" : "group-hover:border-primary/30"}`}>
        <div className="flex items-center justify-between">
          <Activity className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="mt-6 font-display text-lg font-semibold">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}
