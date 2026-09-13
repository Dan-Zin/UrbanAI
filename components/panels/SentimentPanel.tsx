"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, MessageSquareText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useStore } from "@/lib/store";
import { analyzeSentiment, MOCK_MODE } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SentimentPanel() {
  const selected = useStore((s) => s.selected);
  const sentiment = useStore((s) => s.sentiment);
  const loading = useStore((s) => s.sentimentLoading);
  const setSentiment = useStore((s) => s.setSentiment);
  const setLoading = useStore((s) => s.setSentimentLoading);

  // Pillar 1: run NLP analysis on every new site selection
  useEffect(() => {
    if (!selected) return;
    let stale = false;
    setLoading(true);
    analyzeSentiment(selected.lng, selected.lat)
      .then((r) => !stale && setSentiment(r))
      .catch(() => !stale && setSentiment(null))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [selected, setSentiment, setLoading]);

  const SentimentIcon =
    sentiment?.sentiment === "positive"
      ? TrendingUp
      : sentiment?.sentiment === "negative"
        ? TrendingDown
        : Minus;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-emerald-400" />
          Настроения жителей
        </CardTitle>
        <Badge variant="secondary">{MOCK_MODE.nlp ? "Макет" : "OpenRouter"}</Badge>
      </CardHeader>
      <CardContent>
        <div>
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-3 animate-pulse rounded bg-white/[0.07]"
                  style={{ width: `${90 - i * 20}%` }}
                />
              ))}
              <div className="pt-1 text-[11px] text-muted-foreground">
                Разбираю обращения жителей…
              </div>
            </motion.div>
          ) : sentiment ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <Badge>
                  <MessageSquareText className="h-3 w-3" />
                  {sentiment.category}
                </Badge>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${
                    sentiment.sentiment === "positive"
                      ? "text-emerald-400"
                      : sentiment.sentiment === "negative"
                        ? "text-rose-400"
                        : "text-slate-400"
                  }`}
                >
                  <SentimentIcon className="h-3.5 w-3.5" />
                  {(sentiment.score * 100).toFixed(0)}%
                </span>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {sentiment.summary}
              </p>

              <div className="space-y-1.5">
                {sentiment.topRequests.map((r) => (
                  <div key={r.label} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 text-muted-foreground">
                      {r.label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, (r.count / 45) * 100)}%`,
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full bg-emerald-500/70"
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums text-emerald-300">
                      {r.count}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground"
            >
              Выберите точку на карте — разберём, чего просят жители в этом месте.
            </motion.p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
