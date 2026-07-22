import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getJob, overrideJobStatus } from "@/lib/jobs.functions";
import {
  listJobPayments,
  addPayment,
  deletePayment,
  setJobTotalOwed,
} from "@/lib/payments.functions";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Phone, Download, Trash2, Plus, DollarSign } from "lucide-react";

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

const LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_insurance: "Awaiting Insurance",
  parts_ordered: "Parts Ordered",
  in_progress: "In Progress",
  awaiting_payment: "Awaiting Payment",
  completed: "Completed",
};

function JobDetail() {
  const { jobId } = Route.useParams();
  const fn = useServerFn(getJob);
  const payFn = useServerFn(listJobPayments);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["job", jobId],
    queryFn: () => fn({ data: { id: jobId } }),
  });
  const { data: ledger } = useQuery({
    queryKey: ["payments", jobId],
    queryFn: () => payFn({ data: { job_id: jobId } }),
  });
  const override = useServerFn(overrideJobStatus);
  const [newStatus, setNewStatus] = useState<string>(data.job.status);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      toast.error("Reason is required");
      return;
    }
    setBusy(true);
    try {
      await override({ data: { id: jobId, status: newStatus as any, reason } });
      toast.success("Status updated");
      setReason("");
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadPdf() {
    if (!ledger) return;
    generateInvoicePdf({
      jobId: data.job.id,
      jobDescription: data.job.description,
      customer: {
        name: data.job.customer?.name ?? "—",
        phone: data.job.customer?.phone,
        email: data.job.customer?.email,
        address: data.job.customer?.address,
      },
      vehicle: {
        year: data.job.vehicle?.year,
        make: data.job.vehicle?.make,
        model: data.job.vehicle?.model,
        vin: data.job.vehicle?.vin,
        license_plate: data.job.vehicle?.license_plate,
      },
      totalOwed: ledger.totalOwed,
      payments: ledger.payments as any,
      reportedProblem: (data.job as any).reported_problem,
      odometer: (data.job as any).odometer,
      currency: "CAD",
    });
  }

  const job = data.job;
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link to="/jobs" className="text-xs text-muted-foreground hover:text-foreground">
            ← Jobs
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{job.description || "Job"}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <select
              value={job.status}
              onChange={(e) => {
                const newStatus = e.target.value;
                if (newStatus === job.status) return;
                const reason = prompt(
                  `Reason for moving to ${LABELS[newStatus] ?? newStatus}:`,
                  "Status update",
                );
                if (!reason || reason.trim().length < 3) {
                  toast.error("Reason must be at least 3 characters");
                  return;
                }
                const prevStatus = newStatus;
                setBusy(true);
                override({ data: { id: jobId, status: newStatus as any, reason } })
                  .then(() => {
                    toast.success("Status updated");
                    qc.invalidateQueries({ queryKey: ["job", jobId] });
                    qc.invalidateQueries({ queryKey: ["jobs"] });
                    qc.invalidateQueries({ queryKey: ["dashboard"] });
                  })
                  .catch((e: any) => toast.error(e.message))
                  .finally(() => setBusy(false));
              }}
              disabled={busy}
              className="text-xs bg-card border border-border rounded px-2 py-1 cursor-pointer font-medium"
              style={{ borderColor: "var(--color-border)" }}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {LABELS[st]}
                </option>
              ))}
            </select>
            {job.flagged && <span className="text-xs text-amber-400">⚑ flagged</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {job.customer?.phone && (
            <a
              href={`tel:${job.customer.phone}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary/15 text-primary text-sm hover:bg-primary/25"
            >
              <Phone className="w-3.5 h-3.5" /> Call {job.customer.name?.split(" ")[0]}
            </a>
          )}
          <Link
            to="/claims/fill/$jobId"
            params={{ jobId }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm hover:bg-accent"
          >
            <Download className="w-3.5 h-3.5" /> Fill claim form
          </Link>
          <Button variant="outline" size="sm" onClick={downloadPdf} disabled={!ledger}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Invoice PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Customer">
          <div className="font-medium">{job.customer?.name}</div>
          <div className="text-sm text-muted-foreground">{job.customer?.email}</div>
          <div className="text-sm text-muted-foreground">{job.customer?.phone}</div>
        </Card>
        <Card title="Vehicle">
          <div className="font-medium">
            {job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model}
          </div>
          <div className="text-xs font-mono text-muted-foreground">VIN {job.vehicle?.vin}</div>
          <div className="text-xs font-mono text-muted-foreground">
            {job.vehicle?.license_plate}
          </div>
          {(job as any).odometer && (
            <div className="text-xs text-muted-foreground mt-1">
              Odo: {(job as any).odometer} km
            </div>
          )}
        </Card>
        <Card title="Manual transition">
          <form onSubmit={submit} className="space-y-2">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full border border-input rounded-md p-2 bg-background text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
              className="w-full border border-input rounded-md p-2 bg-background text-sm"
            />
            <Button type="submit" size="sm" disabled={busy}>
              Override status
            </Button>
          </form>
        </Card>
      </div>

      <PaymentLedger jobId={jobId} ledger={ledger} />

      <Section title="Insurance claims">
        {data.claims.length === 0 ? (
          <Empty>No claims linked.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.claims.map((c: any) => (
              <li key={c.id} className="border border-border rounded-md p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-mono">{c.claim_number ?? "—"}</span>
                  <span className="text-xs uppercase">{c.status}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {c.insurer} · policy {c.policy_number}
                </div>
                {c.approved_amount && <div className="text-xs">Approved: ${c.approved_amount}</div>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Documents">
        {data.documents.length === 0 ? (
          <Empty>
            No documents attached. Upload from{" "}
            <Link to="/documents" className="underline">
              Documents
            </Link>
            .
          </Empty>
        ) : (
          <ul className="space-y-2">
            {data.documents.map((d: any) => (
              <li key={d.id}>
                <Link
                  to="/documents/$docId"
                  params={{ docId: d.id }}
                  className="border border-border rounded-md p-3 text-sm flex justify-between hover:border-primary block"
                >
                  <span>{d.file_name}</span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {d.type} · {d.processing_status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Status timeline">
        <ol className="space-y-2">
          {data.events.map((e: any) => (
            <li key={e.id} className="text-sm border-l-2 border-border pl-3">
              <div className="text-xs text-muted-foreground">
                {format(new Date(e.created_at), "PPpp")} · {e.trigger}
              </div>
              <div>
                {e.from_status ?? "∅"} → <strong>{e.to_status}</strong>
              </div>
              {e.reason && <div className="text-xs text-muted-foreground italic">{e.reason}</div>}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function PaymentLedger({ jobId, ledger }: { jobId: string; ledger: any }) {
  const qc = useQueryClient();
  const addFn = useServerFn(addPayment);
  const delFn = useServerFn(deletePayment);
  const setTotalFn = useServerFn(setJobTotalOwed);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    payer_type: "client" as "client" | "insurance" | "other",
    payer_name: "",
    amount: "",
    method: "",
    note: "",
  });
  const [totalInput, setTotalInput] = useState<string>("");

  async function add() {
    if (!form.amount) {
      toast.error("Enter an amount");
      return;
    }
    try {
      await addFn({
        data: {
          job_id: jobId,
          payer_type: form.payer_type,
          payer_name: form.payer_name,
          amount: Number(form.amount),
          currency: "CAD",
          method: form.method,
          note: form.note,
        },
      });
      toast.success("Payment recorded");
      setForm({ payer_type: "client", payer_name: "", amount: "", method: "", note: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["payments", jobId] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this payment entry?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["payments", jobId] });
  }

  async function saveTotal() {
    if (!totalInput) return;
    await setTotalFn({ data: { job_id: jobId, total_owed: Number(totalInput) } });
    toast.success("Total quoted updated");
    setTotalInput("");
    qc.invalidateQueries({ queryKey: ["payments", jobId] });
  }

  return (
    <Section title="Payment ledger">
      <div className="border border-border rounded-md bg-card overflow-hidden">
        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-b border-border">
          <Stat
            label="Total quoted"
            value={ledger?.totalOwed != null ? `CAD ${ledger.totalOwed.toFixed(2)}` : "—"}
          />
          <Stat
            label="From insurance"
            value={`CAD ${(ledger?.byInsurance ?? 0).toFixed(2)}`}
            tone="text-blue-400"
          />
          <Stat
            label="From client"
            value={`CAD ${(ledger?.byClient ?? 0).toFixed(2)}`}
            tone="text-green-400"
          />
          <Stat
            label="Outstanding"
            value={ledger?.outstanding != null ? `CAD ${ledger.outstanding.toFixed(2)}` : "—"}
            tone={
              ledger?.outstanding != null && ledger.outstanding > 0
                ? "text-amber-400"
                : "text-green-400"
            }
          />
        </div>

        {/* Set quoted total */}
        {ledger?.totalOwed == null && (
          <div className="p-3 border-b border-border bg-secondary/30 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">No quoted total set.</span>
            <input
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              inputMode="decimal"
              placeholder="Amount"
              className="px-2 py-1 rounded bg-background border border-border text-sm w-32"
            />
            <Button size="sm" variant="outline" onClick={saveTotal}>
              Set
            </Button>
          </div>
        )}

        {/* Entries */}
        <div className="divide-y divide-border">
          {(!ledger || ledger.payments.length === 0) && (
            <div className="p-6 text-center text-sm text-muted-foreground">No payments yet.</div>
          )}
          {ledger?.payments.map((p: any) => (
            <div key={p.id} className="px-4 py-3 flex items-center gap-3">
              <span
                className={`text-[10px] tick px-1.5 py-0.5 rounded ${
                  p.payer_type === "insurance"
                    ? "bg-blue-400/15 text-blue-400"
                    : p.payer_type === "client"
                      ? "bg-green-400/15 text-green-400"
                      : "bg-secondary text-secondary-foreground"
                }`}
              >
                {p.payer_type.toUpperCase()}
              </span>
              <div className="flex-1 text-sm">
                <div className="font-medium">
                  {p.payer_name || (p.payer_type === "insurance" ? "Insurance" : "Customer")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(p.paid_at), "PP")} {p.method && `· ${p.method}`}{" "}
                  {p.note && `· ${p.note}`}
                </div>
              </div>
              <div className="font-mono text-sm">CAD {Number(p.amount).toFixed(2)}</div>
              <button
                onClick={() => remove(p.id)}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add row */}
        {open ? (
          <div className="p-4 border-t border-border bg-secondary/20 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <select
                value={form.payer_type}
                onChange={(e) => setForm({ ...form, payer_type: e.target.value as any })}
                className="bg-background border border-border rounded px-2 py-2 text-sm"
              >
                <option value="client">Client</option>
                <option value="insurance">Insurance</option>
                <option value="other">Other</option>
              </select>
              <input
                value={form.payer_name}
                onChange={(e) => setForm({ ...form, payer_name: e.target.value })}
                placeholder="Payer name (opt)"
                className="bg-background border border-border rounded px-2 py-2 text-sm"
              />
              <input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                inputMode="decimal"
                placeholder="Amount CAD"
                className="bg-background border border-border rounded px-2 py-2 text-sm font-mono"
              />
              <input
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                placeholder="Method (cash, etransfer…)"
                className="bg-background border border-border rounded px-2 py-2 text-sm"
              />
            </div>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Note (optional)"
              className="w-full bg-background border border-border rounded px-2 py-2 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={add}>
                Record payment
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="w-full p-3 border-t border-border text-sm font-medium hover:bg-secondary/40 flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Add payment
          </button>
        )}
      </div>
    </Section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] tick uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono mt-1 ${tone ?? ""}`}>{value}</div>
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
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}
function Empty({ children }: any) {
  return (
    <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4">
      {children}
    </div>
  );
}
