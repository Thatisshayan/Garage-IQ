import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wrench, ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/update-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Update Password — Garage IQ" }] }),
  component: UpdatePasswordPage,
});

function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm mx-4"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-md bg-[var(--gradient-ember)] grid place-items-center ember-glow">
            <Wrench className="w-4 h-4 text-[var(--ember-foreground)]" strokeWidth={2.5} />
          </div>
          <div className="font-display text-base font-semibold">Garage IQ</div>
        </div>

        <div className="text-[11px] tick uppercase tracking-[0.24em] text-muted-foreground">
          // update password
        </div>
        <h1 className="font-display text-3xl font-semibold mt-2">
          {done ? "Password updated" : "Set new password"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {done
            ? "Your password has been changed successfully."
            : "Choose a strong new password for your account."}
        </p>

        <div className="panel p-6 mt-6">
          {done ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 grid place-items-center">
                <Check className="w-6 h-6 text-primary" />
              </div>
              <Button
                asChild
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 ember-glow"
              >
                <Link to="/">Continue to dashboard</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="pw"
                  className="text-[10px] tick uppercase tracking-[0.18em] text-muted-foreground"
                >
                  New password
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
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm"
                  className="text-[10px] tick uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Confirm password
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-background/40"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 ember-glow"
              >
                {loading ? "…" : "Update password →"}
              </Button>
            </form>
          )}
        </div>

        <Link
          to="/auth"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
