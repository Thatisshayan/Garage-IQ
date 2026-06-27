import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getJob, overrideJobStatus } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "./index";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  head: () => ({ meta: [{ title: "Job detail" }] }),
  component: JobDetail,
});

const STATUSES = [
  "pending",
  "awaiting_insurance",
  "parts_ordered",
  "in_progress",
  "awaiting_payment",
  "completed",
] as const;

function JobDetail() {
  const { jobId } = Route.useParams();
  const fn = useServerFn(getJob);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["job", jobId], queryFn: () => fn({ data: { id: jobId } }) });
  const override = useServerFn(overrideJobStatus);
  const [newStatus, setNewStatus] = useState<string>(data.job.status);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) { toast.error("Reason is required"); return; }
    setBusy(true);
    try {
      await override({ data: { id: jobId, status: newStatus as any, reason } });
      toast.success("Status updated");
      setReason("");
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  const job = data.job;
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/jobs" className="text-xs text-muted-foreground hover:text-foreground">← Jobs</Link>
          <h1 className="text-2xl font-semibold mt-1">{job.description || "Job"}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge status={job.status} />
            {job.flagged && <span className="text-xs text-[oklch(0.769_0.188_70.08)]">⚑ flagged</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Customer">
          <div className="font-medium">{job.customer?.name}</div>
          <div className="text-sm text-muted-foreground">{job.customer?.email}</div>
          <div className="text-sm text-muted-foreground">{job.customer?.phone}</div>
        </Card>
        <Card title="Vehicle">
          <div className="font-medium">{job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model}</div>
          <div className="text-xs font-mono text-muted-foreground">VIN {job.vehicle?.vin}</div>
          <div className="text-xs font-mono text-muted-foreground">{job.vehicle?.license_plate}</div>
        </Card>
        <Card title="Manual transition">
          <form onSubmit={submit} className="space-y-2">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full border border-input rounded-md p-2 bg-background text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="w-full border border-input rounded-md p-2 bg-background text-sm" />
            <Button type="submit" size="sm" disabled={busy}>Override status</Button>
          </form>
        </Card>
      </div>

      <Section title="Insurance claims">
        {data.claims.length === 0 ? <Empty>No claims linked.</Empty> : (
          <ul className="space-y-2">
            {data.claims.map((c: any) => (
              <li key={c.id} className="border border-border rounded-md p-3 text-sm">
                <div className="flex justify-between"><span className="font-mono">{c.claim_number ?? "—"}</span><span className="text-xs uppercase">{c.status}</span></div>
                <div className="text-xs text-muted-foreground mt-1">{c.insurer} · policy {c.policy_number}</div>
                {c.approved_amount && <div className="text-xs">Approved: ${c.approved_amount}</div>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Documents">
        {data.documents.length === 0 ? <Empty>No documents attached. Upload from <Link to="/documents" className="underline">Documents</Link>.</Empty> : (
          <ul className="space-y-2">
            {data.documents.map((d: any) => (
              <li key={d.id}><Link to="/documents/$docId" params={{ docId: d.id }} className="border border-border rounded-md p-3 text-sm flex justify-between hover:border-primary block">
                <span>{d.file_name}</span>
                <span className="text-xs uppercase text-muted-foreground">{d.type} · {d.processing_status}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Invoices">
        {data.invoices.length === 0 ? <Empty>No invoices.</Empty> : (
          <ul className="space-y-2">
            {data.invoices.map((i: any) => (
              <li key={i.id} className="border border-border rounded-md p-3 text-sm flex justify-between">
                <span>{i.vendor ?? "—"} · ${i.total ?? "?"}</span>
                <span className="text-xs uppercase">{i.payment_status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Status timeline">
        <ol className="space-y-2">
          {data.events.map((e: any) => (
            <li key={e.id} className="text-sm border-l-2 border-border pl-3">
              <div className="text-xs text-muted-foreground">{format(new Date(e.created_at), "PPpp")} · {e.trigger}</div>
              <div>{e.from_status ?? "∅"} → <strong>{e.to_status}</strong></div>
              {e.reason && <div className="text-xs text-muted-foreground italic">{e.reason}</div>}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <div className="border border-border rounded-md p-4 bg-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}
function Section({ title, children }: any) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}
function Empty({ children }: any) {
  return <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4">{children}</div>;
}
