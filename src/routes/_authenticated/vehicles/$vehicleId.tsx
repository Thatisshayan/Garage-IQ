import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVehicleHistory } from "@/lib/vehicle-history.functions";
import { motion } from "framer-motion";
import {
  Car,
  User,
  Phone,
  FileText,
  Receipt,
  ShieldCheck,
  Briefcase,
  ArrowLeft,
  FileCheck2,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/vehicles/$vehicleId")({
  head: () => ({ meta: [{ title: "Vehicle history" }] }),
  component: VehiclePage,
});

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <div className="rounded-md border border-border bg-card/60 backdrop-blur p-4">
      <div className="flex items-center gap-2 text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-display">{value}</div>
    </div>
  );
}

function VehiclePage() {
  const { vehicleId } = Route.useParams();
  const fn = useServerFn(getVehicleHistory);
  const { data } = useSuspenseQuery({
    queryKey: ["vehicle-history", vehicleId],
    queryFn: () => fn({ data: { id: vehicleId } }),
  });
  const { vehicle, jobs, documents, invoices, claims } = data as any;
  const paidTotal = invoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <Link
        to="/vehicles"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All vehicles
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-card to-background p-6"
      >
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] tick uppercase tracking-[0.24em] text-muted-foreground">
              <Car className="w-3.5 h-3.5" /> Vehicle file
            </div>
            <h1 className="mt-1 font-display text-3xl">
              {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
                "Untitled vehicle"}
            </h1>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wider">VIN </span>
                <span className="font-mono">{vehicle.vin || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wider">
                  Plate{" "}
                </span>
                <span className="font-mono">{vehicle.license_plate || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wider">
                  Color{" "}
                </span>
                <span>{vehicle.color || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wider">
                  Year{" "}
                </span>
                <span className="font-mono">{vehicle.year || "—"}</span>
              </div>
            </div>
          </div>
          {vehicle.customer && (
            <div className="rounded-md border border-border bg-background/60 p-4 min-w-[220px]">
              <div className="flex items-center gap-2 text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">
                <User className="w-3.5 h-3.5" /> Owner
              </div>
              <div className="mt-1 font-medium">{vehicle.customer.name}</div>
              {vehicle.customer.phone && (
                <a
                  href={`tel:${vehicle.customer.phone}`}
                  className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Phone className="w-3.5 h-3.5" /> {vehicle.customer.phone}
                </a>
              )}
              {vehicle.customer.email && (
                <div className="text-xs text-muted-foreground mt-0.5">{vehicle.customer.email}</div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total jobs" value={jobs.length} icon={Briefcase} />
        <StatCard label="Documents" value={documents.length} icon={FileText} />
        <StatCard label="Claims" value={claims.length} icon={ShieldCheck} />
        <StatCard label="Invoiced" value={`$${paidTotal.toFixed(0)}`} icon={Receipt} />
      </div>

      <Section
        title="Job history"
        icon={Briefcase}
        empty={jobs.length === 0 ? "No jobs yet" : null}
      >
        <div className="divide-y divide-border">
          {jobs.map((j: any, i: number) => (
            <motion.div
              key={j.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="py-3 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <Link
                  to="/jobs/$jobId"
                  params={{ jobId: j.id }}
                  className="font-medium hover:text-primary"
                >
                  {j.description || j.reported_problem || "Untitled job"}
                </Link>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                  <span>{format(new Date(j.created_at), "MMM d, yyyy")}</span>
                  {j.odometer && <span>{j.odometer.toLocaleString()} km</span>}
                  {j.total_owed != null && (
                    <span className="font-mono">${Number(j.total_owed).toFixed(2)}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] tick uppercase tracking-wider px-2 py-1 rounded border border-border bg-background">
                {j.status.replace(/_/g, " ")}
              </span>
              <Link
                to="/claims/fill/$jobId"
                params={{ jobId: j.id }}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <FileCheck2 className="w-3.5 h-3.5" /> Fill claim
              </Link>
            </motion.div>
          ))}
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section
          title="Insurance claims"
          icon={ShieldCheck}
          empty={claims.length === 0 ? "No claims recorded" : null}
        >
          {claims.map((c: any) => (
            <div key={c.id} className="py-2 text-sm border-b border-border last:border-0">
              <div className="flex justify-between">
                <span className="font-medium">{c.insurer || "Unknown insurer"}</span>
                <span className="font-mono text-xs">{c.claim_number || "—"}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex justify-between">
                <span>Policy {c.policy_number || "—"}</span>
                <span>
                  {c.effective_date ? format(new Date(c.effective_date), "MMM yyyy") : "—"}
                </span>
              </div>
            </div>
          ))}
        </Section>
        <Section
          title="Invoices"
          icon={Receipt}
          empty={invoices.length === 0 ? "No invoices" : null}
        >
          {invoices.map((i: any) => (
            <div
              key={i.id}
              className="py-2 text-sm border-b border-border last:border-0 flex justify-between"
            >
              <span>{i.vendor || "—"}</span>
              <span className="font-mono">
                ${Number(i.total || 0).toFixed(2)} {i.currency || "CAD"}
              </span>
            </div>
          ))}
        </Section>
      </div>

      <Section
        title="Documents"
        icon={FileText}
        empty={documents.length === 0 ? "No documents attached" : null}
      >
        <div className="grid md:grid-cols-2 gap-2">
          {documents.map((d: any) => (
            <div
              key={d.id}
              className="text-sm p-2.5 rounded border border-border bg-background flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="truncate">{d.file_name}</div>
                <div className="text-[11px] tick uppercase tracking-wider text-muted-foreground">
                  {d.type} · {format(new Date(d.created_at), "MMM d, yyyy")}{" "}
                  {d.is_historical && "· historical"}
                </div>
              </div>
              <span className="text-[10px] tick uppercase tracking-wider text-muted-foreground">
                {d.processing_status}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, empty, children }: any) {
  return (
    <div className="rounded-md border border-border bg-card/40 backdrop-blur p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-display text-lg">{title}</h2>
      </div>
      {empty ? (
        <div className="text-sm text-muted-foreground py-4 text-center">{empty}</div>
      ) : (
        children
      )}
    </div>
  );
}
