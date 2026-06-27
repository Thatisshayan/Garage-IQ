import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvoices, markInvoicePaid } from "@/lib/invoices.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({ meta: [{ title: "Invoices" }] }),
  component: Invoices,
});

function Invoices() {
  const fn = useServerFn(listInvoices);
  const pay = useServerFn(markInvoicePaid);
  const { data, refetch } = useSuspenseQuery({ queryKey: ["invoices"], queryFn: () => fn() });
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-semibold">Invoices</h1>
      <table className="w-full text-sm border border-border rounded-md overflow-hidden">
        <thead className="bg-card"><tr className="text-left"><th className="p-3">Vendor</th><th className="p-3">Job</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Due</th><th></th></tr></thead>
        <tbody>
          {data.map((i: any) => (
            <tr key={i.id} className="border-t border-border">
              <td className="p-3">{i.vendor ?? "—"}</td>
              <td className="p-3">{i.job_id ? <Link to="/jobs/$jobId" params={{ jobId: i.job_id }} className="hover:underline text-xs">{i.job?.description ?? i.job_id.slice(0,8)}</Link> : "—"}</td>
              <td className="p-3">{i.currency} {i.total ?? "—"}</td>
              <td className="p-3 text-xs uppercase">{i.payment_status}</td>
              <td className="p-3 text-xs">{i.due_date}</td>
              <td className="p-3">{i.payment_status !== "paid" && (
                <Button size="sm" variant="outline" onClick={async () => {
                  await pay({ data: { id: i.id } }); toast.success("Marked paid"); refetch();
                }}>Mark paid</Button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
