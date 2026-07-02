import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDocuments, archiveDocument } from "@/lib/documents.functions";
import { toast } from "sonner";
import { Archive, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/archive")({
  head: () => ({ meta: [{ title: "Document archive — Garage IQ" }] }),
  component: ArchivePage,
});

function ArchivePage() {
  const fn = useServerFn(listDocuments);
  const unarchive = useServerFn(archiveDocument);
  const qc = useQueryClient();
  const { data, refetch } = useSuspenseQuery({
    queryKey: ["documents", "archived"],
    queryFn: () => fn({ data: { archived: true } }),
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <Link
            to="/documents"
            className="flex items-center gap-1 text-[11px] tick uppercase tracking-[0.2em] text-muted-foreground hover:text-primary mb-3"
          >
            <ArrowLeft className="w-3 h-3" /> Back to documents
          </Link>
          <h1 className="font-display text-4xl font-semibold flex items-center gap-3">
            <Archive className="w-7 h-7 text-primary" />
            Archive
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Old purchase orders, paid receipts and closed-out documents — preserved, searchable, out
            of the way.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] tick uppercase tracking-[0.22em] text-muted-foreground">
            Archived
          </div>
          <div className="tick text-4xl font-semibold ember-text">{data.length}</div>
        </div>
      </header>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/50 text-[10px] tick uppercase tracking-[0.18em] text-muted-foreground">
            <tr className="text-left">
              <th className="p-3">File</th>
              <th className="p-3">Type</th>
              <th className="p-3">Archived</th>
              <th className="p-3">Job</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((d: any) => (
              <tr key={d.id} className="border-t border-border hover:bg-accent/30">
                <td className="p-3">
                  <Link
                    to="/documents/$docId"
                    params={{ docId: d.id }}
                    className="hover:text-primary"
                  >
                    {d.file_name}
                  </Link>
                </td>
                <td className="p-3 text-[10px] tick uppercase tracking-wider text-muted-foreground">
                  {d.type ?? "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {d.archived_at ? new Date(d.archived_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{d.job?.description ?? "—"}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={async () => {
                      await unarchive({ data: { id: d.id, archived: false } });
                      toast.success("Restored");
                      qc.invalidateQueries({ queryKey: ["documents"] });
                      refetch();
                    }}
                    className="text-[10px] tick uppercase tracking-wider text-muted-foreground hover:text-primary"
                  >
                    Restore
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">
                  Nothing archived yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
