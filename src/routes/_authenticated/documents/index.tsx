import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback } from "react";
import { listDocuments, getUploadUrl, createDocumentRecord, processDocument } from "@/lib/documents.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({ meta: [{ title: "Documents" }] }),
  component: Documents,
});

function Documents() {
  const fn = useServerFn(listDocuments);
  const getUrl = useServerFn(getUploadUrl);
  const createRec = useServerFn(createDocumentRecord);
  const process = useServerFn(processDocument);
  const qc = useQueryClient();
  const { data, refetch } = useSuspenseQuery({ queryKey: ["documents"], queryFn: () => fn({ data: {} }) });
  const [filter, setFilter] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { path, token } = await getUrl({ data: { file_name: file.name } });
        const { error } = await supabase.storage
          .from("workshop-documents")
          .uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (error) throw error;
        const doc = await createRec({ data: { storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size } });
        toast.success(`Uploaded ${file.name} — AI processing…`);
        // Fire-and-forget: kick off processing
        process({ data: { id: doc.id } }).then(() => {
          qc.invalidateQueries({ queryKey: ["documents"] });
          qc.invalidateQueries({ queryKey: ["review-queue"] });
        });
      }
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }, [getUrl, createRec, process, qc, refetch]);

  const filtered = filter ? data.filter((d: any) => d.type === filter || d.processing_status === filter) : data;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="text-3xl font-semibold">Documents</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-input rounded-md p-2 bg-background text-sm">
          <option value="">All</option>
          <option value="invoice">Invoices</option>
          <option value="insurance_document">Insurance</option>
          <option value="purchase_order">Purchase Orders</option>
          <option value="release_form">Release Forms</option>
          <option value="receipt">Receipts</option>
          <option value="review">Needs review</option>
          <option value="error">Error</option>
        </select>
      </div>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-primary bg-card"
      >
        <UploadCloud className="w-8 h-8 text-muted-foreground" />
        <div className="text-sm">{uploading ? "Uploading…" : "Drop files or click to upload"}</div>
        <div className="text-xs text-muted-foreground">PDFs, images. AI extracts type and structured data automatically.</div>
        <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
      </label>

      <table className="w-full text-sm border border-border rounded-md overflow-hidden">
        <thead className="bg-card"><tr className="text-left"><th className="p-3">File</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Linked job</th></tr></thead>
        <tbody>
          {filtered.map((d: any) => (
            <tr key={d.id} className="border-t border-border hover:bg-accent">
              <td className="p-3"><Link to="/documents/$docId" params={{ docId: d.id }} className="hover:underline">{d.file_name}</Link></td>
              <td className="p-3 text-xs uppercase">{d.type}</td>
              <td className="p-3"><StatusPill status={d.processing_status} /></td>
              <td className="p-3 text-xs">{d.job?.description ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = status === "error" ? "bg-destructive text-destructive-foreground" :
    status === "review" ? "bg-[oklch(0.769_0.188_70.08)] text-black" :
    status === "linked" || status === "extracted" ? "bg-secondary text-secondary-foreground" :
    "bg-muted text-muted-foreground";
  return <span className={`text-xs px-2 py-0.5 rounded ${color}`}>{status}</span>;
}
