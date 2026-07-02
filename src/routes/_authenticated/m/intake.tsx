import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Loader2, Check, X, Car, FileText, ScanLine, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  extractVinFromPhoto,
  decodeVin,
  findDuplicateCustomer,
  findVehicleByVin,
  submitMobileIntake,
} from "@/lib/intake.functions";
import { getUploadUrl } from "@/lib/documents.functions";
import { supabase } from "@/integrations/supabase/client";
import { IntakeInput } from "@/lib/schemas";

export const Route = createFileRoute("/_authenticated/m/intake")({
  head: () => ({ meta: [{ title: "Quick Intake" }] }),
  component: MobileIntake,
});

type Step = "vin" | "plate" | "vehicle" | "customer" | "photos" | "review";

function MobileIntake() {
  const navigate = useNavigate();
  const extractFn = useServerFn(extractVinFromPhoto);
  const decodeFn = useServerFn(decodeVin);
  const dupFn = useServerFn(findDuplicateCustomer);
  const vinDupFn = useServerFn(findVehicleByVin);
  const uploadUrlFn = useServerFn(getUploadUrl);
  const submitFn = useServerFn(submitMobileIntake);

  const [step, setStep] = useState<Step>("vin");
  const [busy, setBusy] = useState(false);
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [vehicleMatches, setVehicleMatches] = useState<any[]>([]);

  const form = useForm<IntakeInput>({
    resolver: zodResolver(IntakeInput),
    defaultValues: {
      customer: { name: "", phone: "" },
      vehicle: { make: "", model: "", year: null, color: "" },
      job: { reported_problem: "", odometer: null },
      photo_paths: [],
    },
  });

  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function photoToDataUrl(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async function handleVinPhoto(file: File) {
    setBusy(true);
    try {
      const dataUrl = await photoToDataUrl(file);
      const r = await extractFn({ data: { image_data_url: dataUrl, kind: "vin" } });
      if (r?.vin) {
        const cleaned = String(r.vin)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        setVin(cleaned);
        toast.success(`VIN: ${cleaned}`);
        if (cleaned.length >= 11) {
          const vmatches = await vinDupFn({ data: { vin: cleaned } });
          if (vmatches.length > 0) {
            setVehicleMatches(vmatches);
            toast.info("Existing vehicle found");
          } else {
            const dec = await decodeFn({ data: { vin: cleaned } });
            if (dec.ok) {
              form.setValue("vehicle.make", dec.make ?? "");
              form.setValue("vehicle.model", dec.model ?? "");
              form.setValue("vehicle.year", dec.year ? Number(dec.year) : null);
              toast.success(
                `${dec.year ?? ""} ${dec.make ?? ""} ${dec.model ?? ""}`.trim() || "Decoded",
              );
            }
          }
        }
      } else {
        toast.error("Couldn't read VIN — try again or enter manually");
      }
    } catch (e: any) {
      toast.error(e?.message || "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlatePhoto(file: File) {
    setBusy(true);
    try {
      const dataUrl = await photoToDataUrl(file);
      const r = await extractFn({ data: { image_data_url: dataUrl, kind: "plate" } });
      if (r?.plate) {
        setPlate(String(r.plate).toUpperCase().replace(/\s+/g, ""));
        toast.success(`Plate: ${r.plate}`);
      } else toast.error("Couldn't read plate");
    } catch (e: any) {
      toast.error(e?.message || "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleOdoPhoto(file: File) {
    setBusy(true);
    try {
      const dataUrl = await photoToDataUrl(file);
      const r = await extractFn({ data: { image_data_url: dataUrl, kind: "odometer" } });
      if (r?.odometer) {
        form.setValue("job.odometer", Number(r.odometer));
        toast.success(`Odometer: ${r.odometer}`);
      } else toast.error("Couldn't read odometer");
    } catch (e: any) {
      toast.error(e?.message || "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDamagePhotos(files: FileList) {
    setBusy(true);
    try {
      const newPaths: string[] = [];
      const newPreviews: string[] = [];
      for (const file of Array.from(files)) {
        const { path, signedUrl, token } = await uploadUrlFn({ data: { file_name: file.name } });
        const { error } = await supabase.storage
          .from("workshop-documents")
          .uploadToSignedUrl(path, token, file);
        if (error) throw new Error(error.message);
        newPaths.push(path);
        newPreviews.push(URL.createObjectURL(file));
      }
      setPhotoPaths((p) => [...p, ...newPaths]);
      setPreviewUrls((p) => [...p, ...newPreviews]);
      form.setValue("photo_paths", [...photoPaths, ...newPaths]);
      toast.success(`${files.length} photo(s) uploaded`);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function checkCustomerDup() {
    const { name, phone } = form.getValues("customer");
    if (!name && !phone) return;
    const m = await dupFn({ data: { name, phone } });
    setMatches(m);
  }

  async function onSubmit(values: IntakeInput) {
    setBusy(true);
    try {
      const r = await submitFn({
        data: {
          ...values,
          customer: { ...values.customer, id: customerId || undefined },
          vehicle: { ...values.vehicle, vin, license_plate: plate, id: vehicleId || undefined },
          photo_paths: photoPaths,
        },
      });
      toast.success("Job created");
      navigate({ to: "/jobs/$jobId", params: { jobId: r.jobId } });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create job");
    } finally {
      setBusy(false);
    }
  }

  const STEP_ORDER: Step[] = ["vin", "plate", "vehicle", "customer", "photos", "review"];
  const stepIdx = STEP_ORDER.indexOf(step);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tick uppercase tracking-[0.22em] text-muted-foreground">
              Quick Intake
            </div>
            <div className="font-display text-lg font-semibold">
              Step {stepIdx + 1} / {STEP_ORDER.length}
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/today" })}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="h-1 bg-secondary rounded-full mt-3 overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${((stepIdx + 1) / STEP_ORDER.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {step === "vin" && (
          <Section title="VIN" subtitle="Snap the VIN plate (driver door or dash).">
            <PhotoButton
              icon={<ScanLine className="w-7 h-7" />}
              label={vin ? `VIN: ${vin}` : "Tap to scan VIN"}
              busy={busy}
              onFile={handleVinPhoto}
              done={!!vin}
            />
            <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mt-4 mb-1">
              Or type manually
            </label>
            <input
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="17-character VIN"
              maxLength={17}
              className="w-full bg-card border border-border rounded-md px-3 py-3 font-mono text-base"
            />
            {vehicleMatches.length > 0 && (
              <div className="mt-4 p-3 rounded-md border border-primary/40 bg-primary/5">
                <div className="text-[10px] tick uppercase text-primary mb-2">Existing vehicle</div>
                {vehicleMatches.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVehicleId(v.id);
                      setCustomerId(v.customer?.id ?? "");
                      form.setValue("vehicle.make", v.make ?? "");
                      form.setValue("vehicle.model", v.model ?? "");
                      form.setValue("vehicle.year", v.year ?? null);
                      form.setValue("vehicle.color", v.color ?? "");
                      form.setValue("customer.name", v.customer?.name ?? "");
                      form.setValue("customer.phone", v.customer?.phone ?? "");
                      setPlate(v.license_plate ?? "");
                      toast.success("Loaded existing vehicle & customer");
                    }}
                    className="block w-full text-left text-sm p-2 hover:bg-primary/10 rounded"
                  >
                    {v.year} {v.make} {v.model} — {v.customer?.name}
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {step === "plate" && (
          <Section title="License plate" subtitle="Snap the plate (optional but helps).">
            <PhotoButton
              icon={<ScanLine className="w-7 h-7" />}
              label={plate ? `Plate: ${plate}` : "Tap to scan plate"}
              busy={busy}
              onFile={handlePlatePhoto}
              done={!!plate}
            />
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="Plate number"
              className="mt-4 w-full bg-card border border-border rounded-md px-3 py-3 font-mono text-base"
            />
          </Section>
        )}

        {step === "vehicle" && (
          <Section
            title="Vehicle details"
            subtitle={
              vin ? "We tried to auto-fill from the VIN — confirm or fix." : "Enter what you can."
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mb-1">
                  Year
                </label>
                <input
                  type="number"
                  {...form.register("vehicle.year", { valueAsNumber: true })}
                  className="w-full bg-card border border-border rounded-md px-3 py-3 font-mono text-base"
                />
              </div>
              <div>
                <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mb-1">
                  Color
                </label>
                <input
                  {...form.register("vehicle.color")}
                  className="w-full bg-card border border-border rounded-md px-3 py-3 text-base"
                />
              </div>
              <div>
                <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mb-1">
                  Make
                </label>
                <input
                  {...form.register("vehicle.make")}
                  className="w-full bg-card border border-border rounded-md px-3 py-3 text-base"
                />
              </div>
              <div>
                <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mb-1">
                  Model
                </label>
                <input
                  {...form.register("vehicle.model")}
                  className="w-full bg-card border border-border rounded-md px-3 py-3 text-base"
                />
              </div>
            </div>
            <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mt-4 mb-1">
              Odometer (optional)
            </label>
            <div className="flex gap-2">
              <input
                {...form.register("job.odometer", { valueAsNumber: true })}
                inputMode="numeric"
                placeholder="km"
                className="flex-1 bg-card border border-border rounded-md px-3 py-3 font-mono"
              />
              <button
                onClick={() => fileInputs.current.odo?.click()}
                disabled={busy}
                className="px-4 rounded-md border border-border bg-card hover:border-primary"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={(el) => {
                  fileInputs.current.odo = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleOdoPhoto(e.target.files[0])}
              />
            </div>
          </Section>
        )}

        {step === "customer" && (
          <Section title="Customer" subtitle="Name + phone. We'll check for duplicates.">
            <div>
              <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mb-1">
                Full name *
              </label>
              <input
                {...form.register("customer.name")}
                onBlur={checkCustomerDup}
                className="w-full bg-card border border-border rounded-md px-3 py-3 text-base"
              />
              {form.formState.errors.customer?.name && (
                <p className="text-[0.8rem] font-medium text-destructive mt-1">
                  {form.formState.errors.customer.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mb-1">
                Phone
              </label>
              <input
                type="tel"
                {...form.register("customer.phone")}
                onBlur={checkCustomerDup}
                className="w-full bg-card border border-border rounded-md px-3 py-3 text-base"
              />
            </div>
            {matches.length > 0 && !customerId && (
              <div className="mt-3 p-3 rounded-md border border-amber-400/40 bg-amber-400/5">
                <div className="text-[10px] tick uppercase text-amber-400 mb-2">
                  Possible match — reuse?
                </div>
                {matches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setCustomerId(m.id);
                      form.setValue("customer.name", m.name);
                      form.setValue("customer.phone", m.phone ?? "");
                      setMatches([]);
                      toast.success("Reusing existing customer");
                    }}
                    className="block w-full text-left text-sm p-2 hover:bg-amber-400/10 rounded"
                  >
                    {m.name} {m.phone && `· ${m.phone}`}
                  </button>
                ))}
              </div>
            )}
            <label className="block text-[10px] tick uppercase tracking-wider text-muted-foreground mt-5 mb-1">
              What's the problem?
            </label>
            <textarea
              {...form.register("job.reported_problem")}
              rows={3}
              placeholder="e.g. front bumper damage from parking-lot hit"
              className="w-full bg-card border border-border rounded-md px-3 py-3 text-base"
            />
          </Section>
        )}

        {step === "photos" && (
          <Section title="Damage photos" subtitle="Snap as many as you need.">
            <button
              onClick={() => fileInputs.current.damage?.click()}
              disabled={busy}
              className="w-full aspect-video rounded-lg border-2 border-dashed border-border bg-card flex flex-col items-center justify-center gap-2 hover:border-primary transition"
            >
              {busy ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : (
                <Camera className="w-8 h-8 text-primary" />
              )}
              <span className="text-sm font-medium">Add photos</span>
              <span className="text-xs text-muted-foreground">{photoPaths.length} attached</span>
            </button>
            <input
              ref={(el) => {
                fileInputs.current.damage = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleDamagePhotos(e.target.files)}
            />
            {previewUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {previewUrls.map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt=""
                    className="aspect-square object-cover rounded-md border border-border"
                  />
                ))}
              </div>
            )}
          </Section>
        )}

        {step === "review" && (
          <Section title="Review" subtitle="Double-check before saving.">
            <ReviewRow
              icon={<Car />}
              label="Vehicle"
              value={
                `${form.getValues("vehicle.year") || ""} ${form.getValues("vehicle.make")} ${form.getValues("vehicle.model")}`.trim() ||
                "—"
              }
            />
            <ReviewRow label="VIN" value={vin || "—"} mono />
            <ReviewRow label="Plate" value={plate || "—"} mono />
            <ReviewRow
              label="Odometer"
              value={form.getValues("job.odometer") ? `${form.getValues("job.odometer")} km` : "—"}
            />
            <ReviewRow
              icon={<FileText />}
              label="Customer"
              value={form.getValues("customer.name") || "—"}
            />
            <ReviewRow label="Phone" value={form.getValues("customer.phone") || "—"} />
            <ReviewRow label="Problem" value={form.getValues("job.reported_problem") || "—"} />
            <ReviewRow label="Photos" value={`${photoPaths.length} attached`} />
          </Section>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border p-3 flex gap-2 max-w-md mx-auto md:left-1/2 md:-translate-x-1/2">
        {stepIdx > 0 && (
          <button
            onClick={() => setStep(STEP_ORDER[stepIdx - 1])}
            className="px-4 py-3 rounded-md border border-border bg-card text-sm"
          >
            Back
          </button>
        )}
        {step !== "review" ? (
          <button
            onClick={() => setStep(STEP_ORDER[stepIdx + 1])}
            disabled={busy || (step === "customer" && !form.getValues("customer.name"))}
            className="flex-1 px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={form.handleSubmit(onSubmit)}
            disabled={busy || !form.getValues("customer.name")}
            className="flex-1 px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{" "}
            Save & start job
          </button>
        )}
      </nav>
    </div>
  );
}

function Section({ title, subtitle, children }: any) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  );
}

function PhotoButton({ icon, label, busy, onFile, done }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`w-full aspect-square max-h-[260px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3 transition ${
          done ? "border-green-400/60 bg-green-400/5" : "border-border bg-card hover:border-primary"
        }`}
      >
        {busy ? (
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        ) : done ? (
          <Check className="w-10 h-10 text-green-400" />
        ) : (
          <div className="text-primary">{icon}</div>
        )}
        <span className="text-sm font-medium px-4 text-center">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </>
  );
}

function ReviewRow({ icon, label, value, mono }: any) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-sm font-medium text-right ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
