import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { listClaimTemplates, getClaimTemplate, getClaimFillContext } from "@/lib/claim-templates.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileCheck2, Download, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/claims/fill/$jobId")({
  head: () => ({ meta: [{ title: "Fill claim form" }] }),
  component: FillPage,
});

function resolve(path: string, ctx: any): string {
  if (!path) return "";
  if (path === "today") return new Date().toLocaleDateString();
  if (path === "invoice_total") return `$${Number(ctx.invoice_total || 0).toFixed(2)}`;
  const parts = path.split(".");
  let cur: any = ctx.job;
  if (parts[0] === "customer") cur = ctx.job?.customer;
  else if (parts[0] === "vehicle") cur = ctx.job?.vehicle;
  else if (parts[0] === "job") cur = ctx.job;
  else if (parts[0] === "claim") cur = ctx.claim;
  else return "";
  for (let i = 1; i < parts.length && cur; i++) cur = cur[parts[i]];
  if (cur == null) return "";
  return String(cur);
}

function FillPage() {
  const { jobId } = Route.useParams();
  const tplFn = useServerFn(listClaimTemplates);
  const ctxFn = useServerFn(getClaimFillContext);
  const getTpl = useServerFn(getClaimTemplate);
  const { data: templates } = useSuspenseQuery({ queryKey: ["claim-templates"], queryFn: () => tplFn() });
  const { data: ctx } = useQuery({ queryKey: ["claim-fill-ctx", jobId], queryFn: () => ctxFn({ data: { job_id: jobId } }) });
  const [selected, setSelected] = useState<string>("");
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = useMemo(() => templates.find((t: any) => t.id === selected), [templates, selected]);

  async function loadPreview() {
    if (!chosen || !ctx) return;
    setBusy(true);
    try {
      const t = await getTpl({ data: { id: chosen.id } });
      const out: Record<string, string> = {};
      for (const [pdfField, dataPath] of Object.entries(t.field_map ?? {})) {
        if (!dataPath) continue;
        out[pdfField] = resolve(dataPath as string, ctx);
      }
      setPreview(out);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function download() {
    if (!chosen || !ctx || !preview) return;
    setBusy(true);
    try {
      const t = await getTpl({ data: { id: chosen.id } });
      if (!t.signed_url) throw new Error("Template file not accessible");
      const bytes = await fetch(t.signed_url).then(r => r.arrayBuffer());
      const pdf = await PDFDocument.load(bytes);
      const form = pdf.getForm();
      for (const [name, value] of Object.entries(preview)) {
        try {
          const field = form.getField(name);
          const anyField = field as any;
          if (typeof anyField.setText === "function") anyField.setText(value);
          else if (typeof anyField.check === "function" && value) anyField.check();
        } catch { /* field missing / unsupported */ }
      }
      const out = await pdf.save();
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const plate = ctx.job?.vehicle?.license_plate || ctx.job?.vehicle?.vin || "job";
      a.download = `${chosen.name.replace(/\s+/g, "_")}_${plate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF ready");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <Link to="/jobs/$jobId" params={{ jobId }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to job
      </Link>
      <div>
        <div className="text-[10px] tick uppercase tracking-[0.24em] text-muted-foreground">Insurance</div>
        <h1 className="font-display text-3xl mt-1">Fill claim form</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-md border border-border bg-card p-5 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Choose template</label>
          <select value={selected} onChange={(e) => { setSelected(e.target.value); setPreview(null); }}
            className="mt-1 w-full border border-input rounded-md p-2 bg-background">
            <option value="">— pick one —</option>
            {templates.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.insurer ? `(${t.insurer})` : ""} — {Object.keys(t.field_map ?? {}).length} fields
              </option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              No templates yet. <Link to="/claims/templates" className="text-primary underline">Upload one</Link>.
            </p>
          )}
        </div>
        {chosen && (
          <Button onClick={loadPreview} disabled={busy || !ctx} variant="outline">
            <FileCheck2 className="w-4 h-4 mr-2" /> Preview auto-fill
          </Button>
        )}
      </motion.div>

      {preview && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">Preview</div>
              <div className="text-sm mt-0.5">{Object.keys(preview).length} fields will be filled</div>
            </div>
            <Button onClick={download} disabled={busy}><Download className="w-4 h-4 mr-2" /> Download filled PDF</Button>
          </div>
          <div className="max-h-[420px] overflow-y-auto border-t border-border pt-3">
            <table className="w-full text-sm">
              <thead className="text-[10px] tick uppercase tracking-wider text-muted-foreground">
                <tr className="text-left"><th className="py-1 pr-4">PDF field</th><th className="py-1">Value</th></tr>
              </thead>
              <tbody>
                {Object.entries(preview).map(([k, v]) => (
                  <tr key={k} className="border-t border-border">
                    <td className="py-1.5 pr-4 font-mono text-xs">{k}</td>
                    <td className="py-1.5">{v || <span className="text-muted-foreground italic">empty</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
