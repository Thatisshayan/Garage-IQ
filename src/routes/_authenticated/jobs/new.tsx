import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers } from "@/lib/customers.functions";
import { listVehicles, createVehicle } from "@/lib/vehicles.functions";
import { createJob } from "@/lib/jobs.functions";
import { JobInput } from "@/lib/schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

  const form = useForm<JobInput>({
    resolver: zodResolver(JobInput),
    defaultValues: { customer_id: "", vehicle_id: "", description: "" },
  });

  const selectedCustomer = form.watch("customer_id");
  const filteredVehicles = vehicles.filter((v: any) => !selectedCustomer || v.customer_id === selectedCustomer);

  async function submit(values: JobInput) {
    try {
      const row = await create({ data: values });
      toast.success("Job created");
      navigate({ to: "/jobs/$jobId", params: { jobId: row.id } });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">New Job</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <FormField control={form.control} name="customer_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Customer *</FormLabel>
              <FormControl>
                <select {...field} onChange={(e) => { field.onChange(e); form.setValue("vehicle_id", ""); }} className="w-full border border-input rounded-md p-2 bg-background">
                  <option value="">— select —</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="vehicle_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle *</FormLabel>
              <FormControl>
                <select {...field} className="w-full border border-input rounded-md p-2 bg-background">
                  <option value="">— select —</option>
                  {filteredVehicles.map((v: any) => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.license_plate || v.vin}</option>)}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Textarea maxLength={2000} rows={4} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "…" : "Create job"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
