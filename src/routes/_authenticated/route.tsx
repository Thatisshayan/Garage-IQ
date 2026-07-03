import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalLookup } from "@/components/global-lookup";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Car,
  FileText,
  ShieldCheck,
  Receipt,
  Search,
  Bot,
  Inbox,
  LogOut,
  Sunrise,
  Smartphone,
  FileCheck2,
  Menu,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/today", label: "Today", icon: Sunrise, group: "Operate" },
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Operate" },
  { to: "/jobs", label: "Work orders", icon: Briefcase, group: "Operate" },
  { to: "/m/intake", label: "Quick intake", icon: Smartphone, group: "Operate" },
  { to: "/review-queue", label: "Review queue", icon: Inbox, group: "Operate" },
  { to: "/documents", label: "Documents", icon: FileText, group: "Records" },
  { to: "/customers", label: "Customers", icon: Users, group: "Records" },
  { to: "/vehicles", label: "Vehicles", icon: Car, group: "Records" },
  { to: "/claims", label: "Claims", icon: ShieldCheck, group: "Finance" },
  { to: "/claims/templates", label: "Claim templates", icon: FileCheck2, group: "Finance" },
  { to: "/invoices", label: "Invoices", icon: Receipt, group: "Finance" },
  { to: "/search", label: "Global search", icon: Search, group: "Intel" },
  { to: "/assistant", label: "AI assistant", icon: Bot, group: "Intel" },
] as const;

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <>
      <div className="relative px-5 pt-5 pb-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <img src="/icon-mark-light.png" alt="Garage IQ" className="w-8 h-8" />

          <div>
            <div className="font-display text-[15px] font-semibold leading-none">Garage IQ</div>
            <div className="text-[11px] text-muted-foreground mt-1">Operations platform</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--signal)] pulse-dot" />
          Bay online
        </div>
      </div>

      <nav className="relative flex-1 py-3 overflow-y-auto">
        {groups.map((g) => (
          <div key={g} className="mb-4">
            <div className="px-5 mb-1.5 text-[10px] tick uppercase tracking-[0.22em] text-muted-foreground/70">
              {g}
            </div>
            <div className="space-y-0.5 px-2">
              {NAV.filter((n) => n.group === g).map((n) => {
                const Icon = n.icon;
                const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
                return (
                  <Link key={n.to} to={n.to} onClick={onNavigate} className="block group">
                    <div
                      className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-md bg-sidebar-accent border border-sidebar-border"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      {active && (
                        <motion.span
                          layoutId="nav-accent"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-primary rounded-r"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon
                        className={`relative w-4 h-4 ${active ? "text-primary" : ""}`}
                        strokeWidth={active ? 2.4 : 1.8}
                      />
                      <span className="relative">{n.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative m-3 p-3 rounded-md border border-sidebar-border bg-sidebar-accent/40">
        <div className="text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">
          Session
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            onNavigate?.();
          }}
          className="mt-2 flex items-center justify-between w-full text-sm hover:text-primary transition-colors"
        >
          <span>Sign out</span>
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}

function AuthedLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-[244px] shrink-0 border-r border-border bg-sidebar flex-col relative">
        <div className="absolute inset-0 dot-bg opacity-40 pointer-events-none" />
        <SidebarContent pathname={pathname} />
      </aside>

      {/* MOBILE SIDEBAR OVERLAY */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-sidebar flex flex-col relative shadow-xl">
            <div className="absolute inset-0 dot-bg opacity-40 pointer-events-none" />
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-md hover:bg-sidebar-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* MAIN */}
      <main className="flex-1 overflow-auto relative min-w-0">
        <div className="absolute inset-0 grid-bg opacity-[0.35] pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="relative sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur px-4 md:px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <GlobalLookup />
        </div>
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
