import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Users, Car, FileText, ShieldCheck, Receipt, Search, Bot, Inbox, LogOut } from "lucide-react";

function AuthedLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/jobs", label: "Jobs", icon: Briefcase },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/vehicles", label: "Vehicles", icon: Car },
    { to: "/documents", label: "Documents", icon: FileText },
    { to: "/review-queue", label: "Review Queue", icon: Inbox },
    { to: "/claims", label: "Claims", icon: ShieldCheck },
    { to: "/invoices", label: "Invoices", icon: Receipt },
    { to: "/search", label: "Search", icon: Search },
    { to: "/assistant", label: "AI Assistant", icon: Bot },
  ];
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm uppercase tracking-widest text-muted-foreground">Workshop</div>
          <div className="text-lg font-semibold">OpsDeck</div>
        </div>
        <nav className="flex-1 py-2 space-y-0.5">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-3 px-5 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                activeProps={{ className: "bg-accent text-accent-foreground border-l-2 border-primary" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.invalidate();
            navigate({ to: "/auth" });
          }}
          className="m-3 flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border hover:bg-accent"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
