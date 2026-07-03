import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Garage IQ" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="min-h-screen relative flex bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-[oklch(0.65_0.18_280)]/10 blur-[140px]" />

      {/* Left: brand panel */}
      <div className="hidden lg:flex relative w-1/2 flex-col justify-between p-12 border-r border-border">
        <div className="flex items-center gap-2.5">
          <img src="/icon-mark-light.png" alt="Garage IQ" className="w-9 h-9" />
          <div>
            <div className="font-display text-base font-semibold leading-none">Garage IQ</div>
            <div className="text-[10px] tick text-muted-foreground tracking-[0.2em] mt-1">
              GARAGE / v1.0
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-[11px] tick uppercase tracking-[0.24em] text-muted-foreground mb-4">
            // pit-lane operations
          </div>
          <h2 className="font-display text-5xl font-semibold leading-[1.02] max-w-md">
            Every claim. Every car. <span className="ember-text">Zero friction.</span>
          </h2>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm">
            AI-orchestrated repair workflows: OCR, classification, insurer state machines, and a
            live ops deck — built for shops that move.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {[
              ["AUTO", "Doc intake"],
              ["LIVE", "State machine"],
              ["NL→SQL", "Assistant"],
            ].map(([k, v]) => (
              <div key={k} className="panel p-3">
                <div className="tick text-[10px] uppercase tracking-[0.18em] text-primary">{k}</div>
                <div className="text-xs mt-1 text-muted-foreground">{v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">
          © {new Date().getFullYear()} Garage IQ · Secured garage infra
        </div>
      </div>

      {/* Right: form */}
      <div className="relative flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <img src="/icon-mark-light.png" alt="Garage IQ" className="w-9 h-9" />
            <div className="font-display text-base font-semibold">Garage IQ</div>
          </div>

          <div className="text-[11px] tick uppercase tracking-[0.24em] text-muted-foreground">
            // access
          </div>
          <h1 className="font-display text-3xl font-semibold mt-2">Sign in to the deck</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Resume where the bay left off.</p>

          <div className="panel p-6 mt-6 space-y-4">
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-[10px] tick uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="pw"
                  className="text-[10px] tick uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Password
                </Label>
                <Input
                  id="pw"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/40"
                />
                <Link
                  to="/reset-password"
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 ember-glow"
              >
                {loading ? "…" : "Sign in →"}
              </Button>
            </form>
            <div className="flex items-center gap-3 text-[10px] tick uppercase tracking-[0.2em] text-muted-foreground">
              <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google}>
              Continue with Google
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground w-full text-center">
            New staff accounts are created by an admin — no public signup.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
