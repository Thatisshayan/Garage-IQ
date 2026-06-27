import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCustomers } from "@/lib/customers.functions";
import { listVehicles, createVehicle } from "@/lib/vehicles.functions";
import { createJob } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  head: () => ({ meta: [{ title: "New Job" }] }),
  component: NewJob,
});

function NewJob() {
  const navigate = useNavigate();
  const cFn = useServerFn(listCustomers);
  const vFn = useServerFn(listVehicles);
  const create = useServerFn(createJob);
  const { data: customers } = useSuspenseQuery({ queryKey: ["customers"], queryFn: () => cFn() });
  const { data: vehicles } = useSuspenseQuery({ queryKey: ["vehicles"], queryFn: () => vFn() });
  const [customer, setCustomer] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const row = await create({ data: { customer_id: customer, vehicle_id: vehicle, description: desc } });
      toast.success("Job created");
      navigate({ to: "/jobs/$jobId", params: { jobId: row.id } });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredVehicles = vehicles.filter((v: any) => !customer || v.customer_id === customer);

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">New Job</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Customer</Label>
          <select required value={customer} onChange={(e) => { setCustomer(e.target.value); setVehicle(""); }} className="w-full border border-input rounded-md p-2 bg-background">
            <option value="">— select —</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Vehicle</Label>
          <select required value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="w-full border border-input rounded-md p-2 bg-background">
            <option value="">— select —</option>
            {filteredVehicles.map((v: any) => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.license_plate || v.vin}</option>)}
          </select>
        </div>
        <div>
          <Label>Description</Label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} rows={4} className="w-full border border-input rounded-md p-2 bg-background" />
        </div>
        <Button type="submit" disabled={loading || !customer || !vehicle}>{loading ? "…" : "Create job"}</Button>
      </form>
    </div>
  );
}
