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
import { cn } from "@/lib/utils";

export type AskHit = {
  spec: ReportSpec;
  title: string;
  explanation: string;
};

export function AskBar({
  suggestions = [],
  onAnswer,
  variant = "hero",
}: {
  suggestions?: { text: string; spec: ReportSpec }[];
  onAnswer?: (hit: AskHit) => void;
  variant?: "hero" | "inline";
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setAsking(true);
    setExplanation(null);
    try {
      const result = await api<AskHit>("/api/ask", { method: "POST", json: { question: trimmed } });
      setExplanation(result.explanation);
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
    <div
      className={cn(
        "space-y-3",
        variant === "hero" && "rounded-3xl border border-primary/20 bg-accent/40 p-4 sm:p-5",
      )}
    >
      {variant === "hero" ? (
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Ask Mosaic</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Mosaic already read this company&apos;s records. Ask the way you would in a meeting —
              it picks the number and the chart.
            </p>
          </div>
        </div>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <div className="relative min-w-0 flex-1">
          {variant === "inline" ? (
            <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary" />
          ) : null}
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What is our yield by machine? Who is closing the most?"
            className={cn("h-12 rounded-2xl text-[15px]", variant === "inline" && "pl-10")}
            aria-label="Ask Mosaic"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 rounded-2xl px-5" disabled={asking || question.trim().length < 3}>
          {asking ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Ask Mosaic
        </Button>
      </form>

      {explanation ? (
        <p className="rounded-xl bg-card/80 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {explanation}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 6).map((item) => (
            <button
              key={item.text}
              type="button"
              onClick={() => {
                if (onAnswer) {
                  onAnswer({ spec: item.spec, title: item.text, explanation: "" });
                  setExplanation(null);
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
