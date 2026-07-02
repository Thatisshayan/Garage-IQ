import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  listDocuments,
  getUploadUrl,
  createDocumentRecord,
  processDocument,
  ingestHistoricalDocument,
  archiveDocument,
} from "@/lib/documents.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadCloud, Archive, History, Sparkles } from "lucide-react";
import { stagger, itemUp } from "@/components/motion-primitives";

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({ meta: [{ title: "Documents — Garage IQ" }] }),
  component: Documents,
});

function Documents() {
  const fn = useServerFn(listDocuments);
  const getUrl = useServerFn(getUploadUrl);
  const createRec = useServerFn(createDocumentRecord);
  const process = useServerFn(processDocument);
  const ingest = useServerFn(ingestHistoricalDocument);
  const archive = useServerFn(archiveDocument);
  const qc = useQueryClient();
  const { data, refetch } = useSuspenseQuery({
    queryKey: ["documents", "active"],
    queryFn: () => fn({ data: { archived: false } }),
  });
  const [filter, setFilter] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [historicalMode, setHistoricalMode] = useState(false);

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const { path } = await getUrl({ data: { file_name: file.name } });
          // Use Supabase JS upload to the resolved path (signed upload alt)
          const { error } = await supabase.storage
            .from("workshop-documents")
            .upload(path, file, { contentType: file.type, upsert: true });
          if (error) throw error;
          const doc = await createRec({
            data: {
              storage_path: path,
              file_name: file.name,
              mime_type: file.type,
              size_bytes: file.size,
            },
          });
          if (historicalMode) {
            toast.success(`Ingesting ${file.name} as historical record…`);
            ingest({ data: { id: doc.id } }).then((r: any) => {
              if (r?.ok) {
                const c = r.created || {};
                const parts = [
                  c.customer && "customer",
                  c.vehicle && "vehicle",
                  c.job && "job",
                ].filter(Boolean);
                toast.success(
                  parts.length
                    ? `${file.name} → created ${parts.join(", ")}`
                    : `${file.name} linked to existing records`,
                );
              } else {
                toast.error(`${file.name}: ${r?.error || "failed"}`);
              }
              qc.invalidateQueries({ queryKey: ["documents"] });
              qc.invalidateQueries({ queryKey: ["dashboard"] });
            });
          } else {
            toast.success(`Uploaded ${file.name} — AI processing…`);
            process({ data: { id: doc.id } }).then(() => {
              qc.invalidateQueries({ queryKey: ["documents"] });
              qc.invalidateQueries({ queryKey: ["review-queue"] });
            });
          }
        }
        refetch();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setUploading(false);
      }
    },
    [getUrl, createRec, process, ingest, qc, refetch, historicalMode],
  );

  const filtered = filter
    ? data.filter((d: any) => d.type === filter || d.processing_status === filter)
    : data;

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[11px] tick uppercase tracking-[0.24em] text-muted-foreground">
            Document intelligence
          </div>
          <h1 className="font-display text-4xl font-semibold mt-2">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag in invoices, claims, POs, receipts. AI extracts and links automatically.
          </p>
        </div>
        <Link
          to="/documents/archive"
          className="flex items-center gap-2 text-xs tick uppercase tracking-[0.18em] text-muted-foreground hover:text-primary transition-colors"
        >
          <Archive className="w-3.5 h-3.5" /> Archive
        </Link>
      </header>

      {/* Mode toggle */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <motion.button
          variants={itemUp}
          onClick={() => setHistoricalMode(false)}
          className={`panel p-4 text-left transition-all ${
            !historicalMode ? "border-primary/60 ember-glow" : "opacity-60 hover:opacity-100"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <div className="text-sm font-semibold">Live intake</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            New incoming documents — AI classifies, extracts, and links to active jobs.
          </div>
        </motion.button>
        <motion.button
          variants={itemUp}
          onClick={() => setHistoricalMode(true)}
          className={`panel p-4 text-left transition-all ${
            historicalMode ? "border-primary/60 ember-glow" : "opacity-60 hover:opacity-100"
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <div className="text-sm font-semibold">Historical backfill</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Past invoices, claims, POs. AI auto-creates customer, vehicle &amp; job records.
          </div>
        </motion.button>
      </motion.div>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className={`panel p-10 flex flex-col items-center gap-3 cursor-pointer border-dashed transition-all ${
          historicalMode ? "border-primary/40 dot-bg" : "hover:border-primary/40"
        }`}
      >
        <UploadCloud className="w-10 h-10 text-primary/80" />
        <div className="text-sm font-medium">
          {uploading
            ? "Uploading…"
            : historicalMode
              ? "Drop historical documents to backfill"
              : "Drop files or click to upload"}
        </div>
        <div className="text-xs text-muted-foreground text-center max-w-md">
          {historicalMode
            ? "Old invoices, paid claims, receipts, purchase orders — the system reads each one and creates the customer, vehicle, and closed job behind it."
            : "PDFs, images. AI extracts type and structured data automatically."}
        </div>
        <input
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </label>

      <div className="flex items-center justify-between">
        <div className="text-xs tick uppercase tracking-[0.2em] text-muted-foreground">
          {filtered.length} active document{filtered.length === 1 ? "" : "s"}
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-border rounded-md px-3 py-1.5 bg-card text-xs"
        >
          <option value="">All types &amp; statuses</option>
          <option value="invoice">Invoices</option>
          <option value="insurance_document">Insurance</option>
          <option value="purchase_order">Purchase Orders</option>
          <option value="release_form">Release Forms</option>
          <option value="receipt">Receipts</option>
          <option value="review">Needs review</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/50 text-[10px] tick uppercase tracking-[0.18em] text-muted-foreground">
            <tr className="text-left">
              <th className="p-3">File</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Linked job</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d: any) => (
              <tr key={d.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                <td className="p-3">
                  <Link
                    to="/documents/$docId"
                    params={{ docId: d.id }}
                    className="hover:text-primary transition-colors"
                  >
                    {d.file_name}
                  </Link>
                  {d.is_historical && (
                    <span className="ml-2 text-[9px] tick uppercase tracking-wider text-muted-foreground border border-border rounded px-1 py-0.5">
                      historical
                    </span>
                  )}
                </td>
                <td className="p-3 text-[10px] tick uppercase tracking-wider">{d.type ?? "—"}</td>
                <td className="p-3">
                  <StatusPill status={d.processing_status} />
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {d.job?.description ?? "—"}
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={async () => {
                      await archive({ data: { id: d.id, archived: true } });
                      toast.success("Archived");
                      qc.invalidateQueries({ queryKey: ["documents"] });
                    }}
                    className="text-[10px] tick uppercase tracking-wider text-muted-foreground hover:text-primary"
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">
                  No documents yet. Drop a file above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "error"
      ? "bg-destructive/20 text-destructive border-destructive/40"
      : status === "review"
        ? "bg-primary/15 text-primary border-primary/40"
        : status === "linked"
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : status === "extracted"
            ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
            : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`text-[10px] tick uppercase tracking-wider px-2 py-0.5 rounded border ${tone}`}
    >
      {status}
    </span>
  );
}
