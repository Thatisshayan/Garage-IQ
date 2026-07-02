import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import {
  listClaimTemplates, createClaimTemplate, getClaimTemplate,
  saveTemplateFieldMap, deleteClaimTemplate,
} from "@/lib/claim-templates.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileCheck2, Trash2, ChevronRight, X } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/claims/templates")({
  head: () => ({ meta: [{ title: "Claim templates" }] }),
  component: TemplatesPage,
});

const DATA_SOURCES = [
  { key: "", label: "— skip —" },
  { key: "customer.name", label: "Customer name" },
  { key: "customer.phone", label: "Customer phone" },
  { key: "customer.email", label: "Customer email" },
  { key: "customer.address", label: "Customer address" },
  { key: "vehicle.year", label: "Vehicle year" },
  { key: "vehicle.make", label: "Vehicle make" },
  { key: "vehicle.model", label: "Vehicle model" },
  { key: "vehicle.vin", label: "VIN" },
  { key: "vehicle.license_plate", label: "License plate" },
  { key: "vehicle.color", label: "Color" },
  { key: "job.description", label: "Job description" },
  { key: "job.reported_problem", label: "Reported problem" },
  { key: "job.odometer", label: "Odometer" },
  { key: "job.total_owed", label: "Total owed" },
  { key: "job.status", label: "Job status" },
  { key: "claim.claim_number", label: "Claim number" },
  { key: "claim.insurer", label: "Insurer" },
  { key: "claim.policy_number", label: "Policy number" },
  { key: "claim.approved_amount", label: "Approved amount" },
  { key: "invoice_total", label: "Total invoiced" },
  { key: "today", label: "Today's date" },
];

function TemplatesPage() {
  const listFn = useServerFn(listClaimTemplates);
  const createFn = useServerFn(createClaimTemplate);
  const deleteFn = useServerFn(deleteClaimTemplate);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["claim-templates"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState({ name: "", insurer: "" });

  async function handleFile(file: File) {
    if (!meta.name.trim()) { toast.error("Give the template a name first"); return; }
    if (file.type !== "application/pdf") { toast.error("PDF only"); return; }
    setUploading(true);
    try {
      const path = `claim-templates/${crypto.randomUUID()}.pdf`;
      const { error } = await supabase.storage.from("workshop-documents").upload(path, file);
      if (error) throw error;
      await createFn({ data: { name: meta.name, insurer: meta.insurer || null, storage_path: path } });
      toast.success("Template uploaded");
      setMeta({ name: "", insurer: "" });
      qc.invalidateQueries({ queryKey: ["claim-templates"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <div className="text-[10px] tick uppercase tracking-[0.24em] text-muted-foreground">Insurance</div>
        <h1 className="font-display text-3xl mt-1">Claim templates</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Upload your insurer's blank PDF claim form once, map its fields to workshop data, and every future claim auto-fills from the job.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-md border border-dashed border-border bg-card/40 p-5">
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <Label className="text-xs">Template name</Label>
            <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="e.g. Intact Auto Claim v2" />
          </div>
          <div>
            <Label className="text-xs">Insurer (optional)</Label>
            <Input value={meta.insurer} onChange={(e) => setMeta({ ...meta, insurer: e.target.value })} placeholder="Intact, Aviva, etc." />
          </div>
          <div>
            <input ref={fileInput} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading} className="w-full">
              <Upload className="w-4 h-4 mr-2" /> {uploading ? "Uploading…" : "Upload blank PDF"}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Must be a fillable PDF (with form fields). Scanned images without form fields cannot be auto-filled.
        </p>
      </motion.div>

      <div className="space-y-2">
        {data.length === 0 && <div className="text-sm text-muted-foreground text-center py-10">No templates yet.</div>}
        {data.map((t: any) => (
          <div key={t.id} className="rounded-md border border-border bg-card p-4 flex items-center gap-3">
            <FileCheck2 className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {t.insurer || "Any insurer"} · {Object.keys(t.field_map ?? {}).length} fields mapped
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(t.id)}>
              Map fields <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
            <button onClick={async () => {
              if (!confirm("Delete this template?")) return;
              await deleteFn({ data: { id: t.id } });
              qc.invalidateQueries({ queryKey: ["claim-templates"] });
            }} className="p-2 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {editing && <FieldMapEditor id={editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["claim-templates"] }); }} />}
    </div>
  );
}

function FieldMapEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const getFn = useServerFn(getClaimTemplate);
  const saveFn = useServerFn(saveTemplateFieldMap);
  const [tpl, setTpl] = useState<any>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const t = await getFn({ data: { id } });
        setTpl(t);
        setMap((t.field_map ?? {}) as Record<string, string>);
        if (t.signed_url) {
          const bytes = await fetch(t.signed_url).then(r => r.arrayBuffer());
          const pdf = await PDFDocument.load(bytes);
          setFields(pdf.getForm().getFields().map(f => f.getName()));
        }
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, [id, getFn]);

  async function save() {
    setSaving(true);
    try {
      await saveFn({ data: { id, field_map: map } });
      toast.success("Mapping saved");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">Field mapping</div>
            <div className="font-display text-lg mt-0.5">{tpl?.name || "Loading…"}</div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="text-sm text-muted-foreground">Reading PDF form fields…</div>}
          {!loading && fields.length === 0 && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
              No fillable form fields detected. This PDF is not a fillable form — re-export from the insurer with form fields enabled.
            </div>
          )}
          {!loading && fields.length > 0 && (
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f} className="grid grid-cols-[1fr_1fr] gap-2 items-center">
                  <div className="font-mono text-xs px-2 py-2 rounded bg-background border border-border truncate" title={f}>{f}</div>
                  <select value={map[f] ?? ""} onChange={(e) => setMap({ ...map, [f]: e.target.value })}
                    className="border border-input rounded-md p-2 bg-background text-sm">
                    {DATA_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || fields.length === 0}>{saving ? "Saving…" : "Save mapping"}</Button>
        </div>
      </motion.div>
    </div>
  );
}
