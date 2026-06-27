import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReviewQueue, resolveReview } from "@/lib/documents.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/review-queue/")({
  head: () => ({ meta: [{ title: "Review queue" }] }),
  component: ReviewQueue,
});

function ReviewQueue() {
  const fn = useServerFn(listReviewQueue);
  const resolve = useServerFn(resolveReview);
  const qc = useQueryClient();
  const { data, refetch } = useSuspenseQuery({ queryKey: ["review-queue"], queryFn: () => fn() });

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-semibold">Review queue</h1>
      <p className="text-sm text-muted-foreground">Documents flagged for human review.</p>
      {data.length === 0 && <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">All clear.</div>}
      <ul className="space-y-2">
        {data.map((r: any) => (
          <li key={r.id} className="border border-border rounded-md p-4 bg-card flex justify-between items-start">
            <div>
              <Link to="/documents/$docId" params={{ docId: r.document_id }} className="font-medium hover:underline">{r.document?.file_name}</Link>
              <div className="text-xs text-muted-foreground">{r.document?.type} · {r.document?.processing_status}</div>
              <div className="text-xs mt-1 text-[oklch(0.769_0.188_70.08)] uppercase">{r.reason}</div>
              {r.details && <pre className="text-xs text-muted-foreground mt-1">{JSON.stringify(r.details)}</pre>}
            </div>
            <Button size="sm" variant="outline" onClick={async () => {
              await resolve({ data: { id: r.id } });
              toast.success("Marked resolved");
              qc.invalidateQueries({ queryKey: ["review-queue"] });
              refetch();
            }}>Mark resolved</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
