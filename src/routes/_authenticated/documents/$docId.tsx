import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { getDocument, updateDocument, processDocument } from "@/lib/documents.functions";
import { listJobs } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents/$docId")({
  head: () => ({ meta: [{ title: "Document" }] }),
  component: DocDetail,
});

const TYPES = [
  "invoice",
  "receipt",
  "purchase_order",
  "release_form",
  "insurance_document",
  "other",
  "unclassified",
];

function DocDetail() {
  const { docId } = Route.useParams();
  const fn = useServerFn(getDocument);
  const upd = useServerFn(updateDocument);
  const proc = useServerFn(processDocument);
  const jFn = useServerFn(listJobs);
  const qc = useQueryClient();
  const { data, refetch } = useSuspenseQuery({
    queryKey: ["doc", docId],
    queryFn: () => fn({ data: { id: docId } }),
  });
  const { data: jobs } = useSuspenseQuery({ queryKey: ["jobs"], queryFn: () => jFn() });
  const d = data.document;
  const [edit, setEdit] = useState(() => JSON.stringify(d.extracted_data ?? {}, null, 2));
  const [type, setType] = useState(d.type);
  const [jobId, setJobId] = useState<string>(d.job_id ?? "");

  useEffect(() => {
    setEdit(JSON.stringify(d.extracted_data ?? {}, null, 2));
    setType(d.type);
    setJobId(d.job_id ?? "");
  }, [d.id, d.extracted_data, d.type, d.job_id]);

  async function save() {
    try {
      const parsed = JSON.parse(edit);
      await upd({
        data: { id: docId, type: type as any, extracted_data: parsed, job_id: jobId || null },
      });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["doc", docId] });
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function reprocess() {
    toast.info("Reprocessing…");
    await proc({ data: { id: docId } });
    refetch();
    toast.success("Reprocessed");
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <Link to="/documents" className="text-xs text-muted-foreground">
        ← Documents
      </Link>
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold">{d.file_name}</h1>
        <Button size="sm" variant="outline" onClick={reprocess}>
          Re-run AI
        </Button>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-border rounded-md bg-card overflow-hidden h-[600px]">
          {data.signedUrl ? (
            d.mime_type?.startsWith("image/") ? (
              <img
                src={data.signedUrl}
                alt={d.file_name}
                className="w-full h-full object-contain"
              />
            ) : (
              <iframe src={data.signedUrl} className="w-full h-full" title="preview" />
            )
          ) : (
            <div className="p-4 text-muted-foreground">No preview</div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase text-muted-foreground">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full border border-input rounded-md p-2 bg-background mt-1"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">Linked job</label>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full border border-input rounded-md p-2 bg-background mt-1"
            >
              <option value="">— unlinked —</option>
              {jobs.map((j: any) => (
                <option key={j.id} value={j.id}>
                  {j.description || j.id.slice(0, 8)} · {j.customer?.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">Extracted data (JSON)</label>
            <textarea
              value={edit}
              onChange={(e) => setEdit(e.target.value)}
              rows={18}
              className="w-full border border-input rounded-md p-2 bg-background font-mono text-xs mt-1"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Confidence: {d.confidence_score ?? "—"} · Status: {d.processing_status}
          </div>
          {d.processing_error && (
            <div className="text-xs text-destructive">Error: {d.processing_error}</div>
          )}
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}
