import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiAssistantQuery } from "@/lib/assistant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/assistant/")({
  head: () => ({ meta: [{ title: "AI Assistant" }] }),
  component: Assistant,
});

function Assistant() {
  const fn = useServerFn(aiAssistantQuery);
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    const question = q;
    setQ("");
    try {
      const res = await fn({ data: { question } });
      setHistory((h) => [...h, { question, ...res }]);
    } catch (e: any) {
      setHistory((h) => [...h, { question, error: e.message }]);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask read-only questions about your garage. Examples: "jobs awaiting insurance", "unpaid
          invoices over 1000", "documents in review".
        </p>
      </div>
      <div className="space-y-4">
        {history.map((h, i) => (
          <div key={i} className="border border-border rounded-md p-4 bg-card">
            <div className="text-sm font-medium">Q: {h.question}</div>
            {h.error && <div className="text-xs text-destructive mt-2">{h.error}</div>}
            {h.plan?.explanation && (
              <div className="text-xs text-muted-foreground mt-2 italic">{h.plan.explanation}</div>
            )}
            {h.rows && (
              <div className="mt-3 overflow-x-auto">
                {h.rows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No results.</div>
                ) : (
                  <table className="text-xs border border-border w-full">
                    <thead className="bg-background">
                      <tr>
                        {Object.keys(h.rows[0]).map((k) => (
                          <th key={k} className="p-2 text-left">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {h.rows.map((r: any, idx: number) => (
                        <tr key={idx} className="border-t border-border">
                          {Object.values(r).map((v: any, j: number) => (
                            <td key={j} className="p-2 font-mono">
                              {typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={ask}
        className="flex gap-2 sticky bottom-4 bg-background pt-2 border-t border-border"
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything…" />
        <Button type="submit" disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </Button>
      </form>
    </div>
  );
}
