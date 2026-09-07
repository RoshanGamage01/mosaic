"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { encodeSpec } from "@/lib/spec-link";
import type { ReportSpec } from "@/lib/types";

export type AskHit = {
  spec: ReportSpec;
  title: string;
  explanation: string;
};

export function AskBar({
  suggestions = [],
  onAnswer,
}: {
  suggestions?: { text: string; spec: ReportSpec }[];
  onAnswer?: (hit: AskHit) => void;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setAsking(true);
    try {
      const result = await api<AskHit>("/api/ask", { method: "POST", json: { question: trimmed } });
      if (onAnswer) {
        onAnswer(result);
        setQuestion("");
      } else {
        router.push(`/reports/new?name=${encodeURIComponent(result.title)}&spec=${encodeSpec(result.spec)}`);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "I could not answer that.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary" />
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask anything — revenue this month, yield by machine, pipeline by rep…"
            className="h-12 rounded-2xl pl-10 text-[15px]"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 rounded-2xl px-5" disabled={asking || question.trim().length < 3}>
          {asking ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Show me
        </Button>
      </form>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 6).map((item) => (
            <button
              key={item.text}
              type="button"
              onClick={() => {
                if (onAnswer) {
                  onAnswer({ spec: item.spec, title: item.text, explanation: "" });
                } else {
                  router.push(`/reports/new?name=${encodeURIComponent(item.text)}&spec=${encodeSpec(item.spec)}`);
                }
              }}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {item.text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
