import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { listCustomers, createCustomer } from "@/lib/customers.functions";
import { CustomerInput } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

  const form = useForm<CustomerInput>({
    resolver: zodResolver(CustomerInput),
    defaultValues: { name: "", email: "", phone: "", address: "" },
  });

  async function submit(values: CustomerInput) {
    try {
      await create({ data: values });
      toast.success("Customer created");
      setShowForm(false);
      form.reset();
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="border border-border rounded-md p-4 bg-card grid grid-cols-2 gap-3 max-w-2xl">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Name *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Address</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="col-span-2 flex gap-2">
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>Save</Button>
            </div>
          </form>
        </Form>
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
