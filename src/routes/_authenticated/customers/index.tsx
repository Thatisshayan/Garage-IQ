import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCustomers, createCustomer } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({ meta: [{ title: "Customers" }] }),
  component: Customers,
});

function Customers() {
  const fn = useServerFn(listCustomers);
  const create = useServerFn(createCustomer);
  const { data, refetch } = useSuspenseQuery({ queryKey: ["customers"], queryFn: () => fn() });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: form });
      toast.success("Customer created");
      setShowForm(false);
      setForm({ name: "", email: "", phone: "", address: "" });
      refetch();
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="text-3xl font-semibold">Customers</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>+ New customer</Button>
      </div>
      {showForm && (
        <form onSubmit={submit} className="border border-border rounded-md p-4 bg-card grid grid-cols-2 gap-3 max-w-2xl">
          <div className="col-span-2"><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="col-span-2 flex gap-2"><Button type="submit" size="sm">Save</Button></div>
        </form>
      )}
      <table className="w-full text-sm border border-border rounded-md overflow-hidden">
        <thead className="bg-card"><tr className="text-left"><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Phone</th></tr></thead>
        <tbody>
          {data.map((c: any) => (
            <tr key={c.id} className="border-t border-border hover:bg-accent">
              <td className="p-3"><Link to="/customers/$customerId" params={{ customerId: c.id }} className="hover:underline">{c.name}</Link></td>
              <td className="p-3">{c.email}</td>
              <td className="p-3">{c.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
