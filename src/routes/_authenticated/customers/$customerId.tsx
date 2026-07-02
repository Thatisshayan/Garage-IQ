import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomer } from "@/lib/customers.functions";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  head: () => ({ meta: [{ title: "Customer" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const fn = useServerFn(getCustomer);
  const { data } = useSuspenseQuery({
    queryKey: ["customer", customerId],
    queryFn: () => fn({ data: { id: customerId } }),
  });
  const c = data.customer;
  if (!c) return <div className="p-8">Not found.</div>;
  return (
    <div className="p-8 space-y-6">
      <Link to="/customers" className="text-xs text-muted-foreground">
        ← Customers
      </Link>
      <h1 className="text-2xl font-semibold">{c.name}</h1>
      <div className="text-sm text-muted-foreground">
        {c.email} · {c.phone}
      </div>
      <div className="text-sm text-muted-foreground">{c.address}</div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Vehicles</h2>
        <ul className="space-y-1">
          {data.vehicles.map((v: any) => (
            <li key={v.id} className="border border-border rounded p-2 text-sm">
              {v.year} {v.make} {v.model} ·{" "}
              <span className="font-mono text-xs">{v.license_plate || v.vin}</span>
            </li>
          ))}
          {data.vehicles.length === 0 && (
            <li className="text-sm text-muted-foreground">No vehicles</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Jobs</h2>
        <ul className="space-y-1">
          {data.jobs.map((j: any) => (
            <li key={j.id} className="border border-border rounded p-2 text-sm">
              <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="hover:underline">
                {j.description || "(no description)"}
              </Link>
              <span className="text-xs text-muted-foreground ml-2">{j.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
