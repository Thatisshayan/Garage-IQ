import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { quickLookup } from "@/lib/vehicle-history.functions";
import { Search, Car, User, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function GlobalLookup() {
  const fn = useServerFn(quickLookup);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ vehicles: any[]; customers: any[] }>({
    vehicles: [],
    customers: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults({ vehicles: [], customers: [] });
      return;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        setResults(await fn({ data: { q } }));
      } catch {
        /* noop */
      } finally {
        setBusy(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, fn]);

  const hasResults = results.vehicles.length + results.customers.length > 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Lookup by VIN, plate, customer, phone…"
          className="w-full pl-10 pr-16 py-2.5 rounded-md bg-card/70 backdrop-blur border border-border text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition font-mono"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tick tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-background/50">
          ⌘K
        </kbd>
      </div>
      <AnimatePresence>
        {open && q.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute z-40 mt-2 w-full rounded-md border border-border bg-popover shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto"
          >
            {busy && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
            {!busy && !hasResults && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No matches.</div>
            )}
            {results.vehicles.length > 0 && (
              <div>
                <div className="px-3 pt-2 pb-1 text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">
                  Vehicles
                </div>
                {results.vehicles.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                      navigate({ to: "/vehicles/$vehicleId", params: { vehicleId: v.id } });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent text-left text-sm"
                  >
                    <Car className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {v.license_plate || "—"} · {v.vin || "no VIN"} ·{" "}
                        {v.customer?.name || "no owner"}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
            {results.customers.length > 0 && (
              <div className="border-t border-border">
                <div className="px-3 pt-2 pb-1 text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">
                  Customers
                </div>
                {results.customers.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                      navigate({ to: "/customers" });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent text-left text-sm"
                  >
                    <User className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{c.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {c.phone || "no phone"}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
