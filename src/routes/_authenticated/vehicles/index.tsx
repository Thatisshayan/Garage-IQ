import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listVehicles, createVehicle } from "@/lib/vehicles.functions";
import { listCustomers } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vehicles/")({
  head: () => ({ meta: [{ title: "Vehicles" }] }),
  component: Vehicles,
});

function Vehicles() {
  const lFn = useServerFn(listVehicles);
  const cFn = useServerFn(listCustomers);
  const create = useServerFn(createVehicle);
  const { data, refetch } = useSuspenseQuery({ queryKey: ["vehicles"], queryFn: () => lFn() });
  const { data: customers } = useSuspenseQuery({ queryKey: ["customers"], queryFn: () => cFn() });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ customer_id: "", make: "", model: "", year: "", vin: "", license_plate: "", color: "" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: { ...form, year: form.year ? Number(form.year) : null } });
      toast.success("Vehicle added");
      setShow(false);
      refetch();
    } catch (err: any) { toast.error(err.message); }
  }
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="text-3xl font-semibold">Vehicles</h1>
        <Button size="sm" onClick={() => setShow(!show)}>+ New vehicle</Button>
      </div>
      {show && (
        <form onSubmit={submit} className="border border-border rounded-md p-4 bg-card grid grid-cols-2 gap-3 max-w-2xl">
          <div className="col-span-2"><Label>Customer *</Label>
            <select required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="w-full border border-input rounded-md p-2 bg-background">
              <option value="">—</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
          <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
          <div><Label>Color</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div><Label>VIN</Label><Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></div>
          <div><Label>License plate</Label><Input value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} /></div>
          <Button type="submit" size="sm" className="col-span-2 w-fit">Save</Button>
        </form>
      )}
      <table className="w-full text-sm border border-border rounded-md overflow-hidden">
        <thead className="bg-card"><tr className="text-left"><th className="p-3">Vehicle</th><th className="p-3">VIN</th><th className="p-3">Plate</th><th className="p-3">Customer</th></tr></thead>
        <tbody>
          {data.map((v: any) => (
            <tr key={v.id} className="border-t border-border hover:bg-accent/40 transition-colors">
              <td className="p-3">
                <Link to="/vehicles/$vehicleId" params={{ vehicleId: v.id }} className="hover:text-primary">
                  {v.year} {v.make} {v.model}
                </Link>
              </td>
              <td className="p-3 font-mono text-xs">{v.vin}</td>
              <td className="p-3 font-mono text-xs">{v.license_plate}</td>
              <td className="p-3">{v.customer?.name}</td>
              <td className="p-3 text-right">
                <Link to="/vehicles/$vehicleId" params={{ vehicleId: v.id }} className="text-xs text-primary hover:underline">History →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
