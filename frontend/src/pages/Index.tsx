import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trees,
  Waves,
  Mountain,
  Activity,
  Sparkles,
  Loader2,
} from "lucide-react";

const API_BASE = "http://localhost:5001/api";

interface Analysis {
  emotion: string;
  keywords: string[];
  summary: string;
  cached?: boolean;
}

interface Entry {
  id: string;
  text: string;
  ambience: string;
  date: string;
  analysis?: Analysis;
}

interface Insights {
  totalEntries: number;
  topEmotion: string;
  mostUsedAmbience: string;
  recentKeywords: string[];
}

const ambienceOptions = [
  { id: "forest", icon: Trees, color: "text-emerald-600" },
  { id: "ocean", icon: Waves, color: "text-blue-600" },
  { id: "mountain", icon: Mountain, color: "text-muted-foreground" },
] as const;

export default function Index() {
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState({
    entries: false,
    insights: false,
    submit: false,
    analyzing: null as string | null,
  });
  const [text, setText] = useState("");
  const [ambience, setAmbience] = useState("forest");

  useEffect(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("userId", id);
    }
    setUserId(id);
    fetchEntries(id);
  }, []);

  const fetchEntries = async (id: string) => {
    setLoading((prev) => ({ ...prev, entries: true }));
    try {
      const res = await fetch(`${API_BASE}/journal/${id}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
    setLoading((prev) => ({ ...prev, entries: false }));
  };

  const fetchInsights = async () => {
    if (!userId) return;
    setLoading((prev) => ({ ...prev, insights: true }));
    try {
      const res = await fetch(`${API_BASE}/journal/insights/${userId}`);
      const data = await res.json();
      setInsights(data);
    } catch (e) {
      console.error(e);
    }
    setLoading((prev) => ({ ...prev, insights: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !userId) return;
    setLoading((prev) => ({ ...prev, submit: true }));
    try {
      await fetch(`${API_BASE}/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ambience, text }),
      });
      setText("");
      await fetchEntries(userId);
    } catch (e) {
      console.error(e);
    }
    setLoading((prev) => ({ ...prev, submit: false }));
  };

  const handleAnalyze = async (entryId: string, entryText: string) => {
    setLoading((prev) => ({ ...prev, analyzing: entryId }));
    try {
      const res = await fetch(`${API_BASE}/journal/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, text: entryText }),
      });
      const analysis: Analysis = await res.json();
      setEntries((prev) =>
        prev.map((en) => (en.id === entryId ? { ...en, analysis } : en)),
      );
    } catch (e) {
      console.error(e);
    }
    setLoading((prev) => ({ ...prev, analyzing: null }));
  };

  return (
    <div className="min-h-svh bg-background text-foreground selection:bg-emerald-100 p-6 md:p-12 antialiased">
      <div className="max-w-2xl mx-auto space-y-16">
        {/* Header */}
        <header className="space-y-2">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ letterSpacing: "-0.03em" }}
          >
            Journal
          </h1>
          <p className="label-mono">Session: {userId?.slice(0, 8)}</p>
        </header>

        {/* Section 1: Write */}
        <section className="journal-card">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="flex gap-2">
              {ambienceOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAmbience(item.id)}
                  className={`ambience-chip ${ambience === item.id ? "ambience-chip-active" : "ambience-chip-inactive"}`}
                >
                  <item.icon
                    size={14}
                    className={
                      ambience === item.id
                        ? "text-primary-foreground"
                        : item.color
                    }
                  />
                  {item.id.charAt(0).toUpperCase() + item.id.slice(1)}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full min-h-[160px] p-0 text-lg bg-transparent border-none focus:outline-none resize-none placeholder:text-muted-foreground/40 leading-relaxed"
              style={{ lineHeight: "1.6" }}
            />

            <div className="flex justify-end pt-4 border-t border-border">
              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                disabled={loading.submit}
                className="btn-record"
              >
                {loading.submit && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Enter
              </motion.button>
            </div>
          </form>
        </section>

        {/* Section 2: Previous Entries */}
        <section className="space-y-6">
          <h2 className="section-heading">History</h2>
          <div className="space-y-4">
            {entries.length === 0 && !loading.entries && (
              <div className="empty-state">
                No entries yet. Start writing above.
              </div>
            )}
            {loading.entries && entries.length === 0 && (
              <div className="empty-state flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            )}
            <AnimatePresence>
              {entries.map((entry) => (
                <motion.div
                  layout
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="journal-card"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div
                        className="flex items-center gap-2 label-mono"
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        <span>{new Date(entry.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Activity size={10} /> {entry.ambience}
                        </span>
                      </div>
                      {!entry.analysis && (
                        <button
                          onClick={() => handleAnalyze(entry.id, entry.text)}
                          className="btn-analyze"
                          disabled={loading.analyzing === entry.id}
                        >
                          {loading.analyzing === entry.id ? (
                            <span className="flex items-center gap-1">
                              <Loader2 size={12} className="animate-spin" />{" "}
                              Analyzing...
                            </span>
                          ) : (
                            "Analyze"
                          )}
                        </button>
                      )}
                    </div>

                    <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {entry.text}
                    </p>

                    <AnimatePresence>
                      {entry.analysis && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="pt-4 mt-4 border-t border-border space-y-4"
                        >
                          <div className="flex flex-wrap gap-2">
                            <span className="tag-emotion">
                              {entry.analysis.emotion}
                            </span>
                            {entry.analysis.keywords.map((kw) => (
                              <span key={kw} className="tag-keyword">
                                #{kw}
                              </span>
                            ))}
                            {entry.analysis.cached && (
                              <span className="tag-cached">Cached</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground italic leading-relaxed">
                            "{entry.analysis.summary}"
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Section 3: Insights */}
        <section className="pt-12 border-t border-border">
          <div className="flex justify-between items-center mb-8">
            <h2 className="section-heading">Aggregated Insights</h2>
            <button
              onClick={fetchInsights}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
            >
              <Sparkles
                size={18}
                className={
                  loading.insights
                    ? "animate-pulse text-accent"
                    : "text-muted-foreground"
                }
              />
            </button>
          </div>

          {insights ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total", value: insights.totalEntries },
                { label: "Top Emotion", value: insights.topEmotion },
                { label: "Ambience", value: insights.mostUsedAmbience },
              ].map((stat) => (
                <div key={stat.label} className="stat-card">
                  <p className="label-mono mb-1">{stat.label}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {stat.value}
                  </p>
                </div>
              ))}
              <div className="stat-card col-span-2 md:col-span-1">
                <p className="label-mono mb-2">Recent Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {insights.recentKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="text-[9px] px-1.5 py-0.5 bg-secondary border border-border rounded text-muted-foreground"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={fetchInsights}
              className="w-full py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm hover:border-foreground/20 transition-colors"
            >
              Generate Synthesis
            </button>
          )}
        </section>

        <footer className="py-12 text-center">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.2em]">
            End of Transmission
          </p>
        </footer>
      </div>
    </div>
  );
}
