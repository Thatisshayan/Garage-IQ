import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchAll } from "@/lib/search.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/search/")({
  head: () => ({ meta: [{ title: "Search" }] }),
  component: SearchPage,
});

function SearchPage() {
  const fn = useServerFn(searchAll);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try { setResults(await fn({ data: { q } })); }
    finally { setLoading(false); }
  }
  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <h1 className="text-3xl font-semibold">Search</h1>
      <form onSubmit={go} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="VIN, plate, customer, vendor…" />
        <Button type="submit" disabled={loading}>{loading ? "…" : "Search"}</Button>
      </form>
      {results && (
        <div className="space-y-6">
          <Section title="Customers" items={results.customers} render={(c: any) => <Link to="/customers/$customerId" params={{ customerId: c.id }} className="hover:underline">{c.name}</Link>} />
          <Section title="Vehicles" items={results.vehicles} render={(v: any) => <span>{v.year} {v.make} {v.model} · <span className="font-mono text-xs">{v.vin || v.license_plate}</span></span>} />
          <Section title="Jobs" items={results.jobs} render={(j: any) => <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="hover:underline">{j.description ?? j.id.slice(0,8)} <span className="text-xs text-muted-foreground">{j.status}</span></Link>} />
          <Section title="Documents" items={results.documents} render={(d: any) => <Link to="/documents/$docId" params={{ docId: d.id }} className="hover:underline">{d.file_name} <span className="text-xs text-muted-foreground">{d.type}</span></Link>} />
          <Section title="Invoices" items={results.invoices} render={(i: any) => <span>{i.vendor} · ${i.total} <span className="text-xs text-muted-foreground">{i.payment_status}</span></span>} />
        </div>
      )}
    </div>
  );
}
function Section({ title, items, render }: any) {
  if (!items?.length) return null;
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
      <ul className="space-y-1">{items.map((it: any) => <li key={it.id} className="border border-border rounded p-2 text-sm">{render(it)}</li>)}</ul>
    </div>
  );
}
