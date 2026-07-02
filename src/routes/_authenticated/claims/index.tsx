import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClaims, updateClaim } from "@/lib/claims.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/claims/")({
  head: () => ({ meta: [{ title: "Insurance claims" }] }),
  component: Claims,
});

function Claims() {
  const fn = useServerFn(listClaims);
  const upd = useServerFn(updateClaim);
  const { data, refetch } = useSuspenseQuery({ queryKey: ["claims"], queryFn: () => fn() });
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-semibold">Insurance claims</h1>
      <table className="w-full text-sm border border-border rounded-md overflow-hidden">
        <thead className="bg-card">
          <tr className="text-left">
            <th className="p-3">Claim #</th>
            <th className="p-3">Insurer</th>
            <th className="p-3">Job</th>
            <th className="p-3">Approved $</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c: any) => (
            <tr key={c.id} className="border-t border-border">
              <td className="p-3 font-mono text-xs">{c.claim_number}</td>
              <td className="p-3">{c.insurer}</td>
              <td className="p-3">
                <Link to="/jobs/$jobId" params={{ jobId: c.job_id }} className="hover:underline">
                  {c.job?.description ?? c.job_id.slice(0, 8)}
                </Link>
              </td>
              <td className="p-3">{c.approved_amount ?? "—"}</td>
              <td className="p-3">
                <select
                  value={c.status}
                  onChange={async (e) => {
                    try {
                      await upd({
                        data: {
                          id: c.id,
                          status: e.target.value as any,
                          approved_amount: c.approved_amount,
                        },
                      });
                      toast.success("Updated");
                      refetch();
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                  className="border border-input rounded p-1 bg-background text-xs"
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="denied">denied</option>
                  <option value="partial">partial</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
