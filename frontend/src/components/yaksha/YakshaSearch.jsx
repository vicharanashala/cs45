import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, ChevronDown, ThumbsUp, ThumbsDown, MessageCircle, ArrowRight,
  Sparkles, BookOpen, Check,
} from "lucide-react";
import { faqs } from "@/data/faqs";
import { searchFaqs, store } from "@/lib/mockStore";

export function YakshaSearch({ onAskCommunity }) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [sectionFilter, setSectionFilter] = useState("All");
  const [storeState, setStoreState] = useState(store.get());

  useEffect(() => store.subscribe(setStoreState), []);

  const isSearching = q.trim().length > 1;
  const matches = useMemo(() => (isSearching ? searchFaqs(q) : []), [q, isSearching]);

  const faqsList = storeState.faqs && storeState.faqs.length > 0 ? storeState.faqs : faqs;

  const sections = useMemo(() => ["All", ...Array.from(new Set(faqsList.map((f) => f.section).filter(Boolean)))], [faqsList]);
  const browseList = useMemo(
    () => (sectionFilter === "All" ? faqsList : faqsList.filter((f) => f.section === sectionFilter)),
    [sectionFilter, faqsList]
  );

  const setFb = (id, v) => setFeedback((p) => ({ ...p, [id]: v }));

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-4">
          <Sparkles className="w-3 h-3" /> Sara FAQ · Vicharanashala Internship
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
          Ask once. <span className="text-gradient">Help everyone.</span>
        </h1>
        <p className="text-muted-foreground text-base max-w-xl mx-auto">
          Browse the official FAQ below or search to find a verified answer instantly.
        </p>
      </div>

      <div className="relative mb-6">
        <div className={`relative flex items-center gap-3 bg-card border rounded-2xl px-5 py-4 shadow-elegant transition-all ${isSearching ? "ring-focus border-primary" : "border-border"}`}>
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setExpanded(null); }}
            placeholder="Search the FAQ — e.g. NOC, stipend, Zoom link…"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-xs text-muted-foreground hover:text-foreground">clear</button>
          )}
          <kbd className="hidden md:inline-flex h-6 px-2 items-center rounded-md bg-secondary text-[10px] font-mono text-muted-foreground border border-border">⌘ K</kbd>
        </div>

        <AnimatePresence>
          {isSearching && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className="mt-3 bg-card border border-border rounded-2xl shadow-elegant overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-pulse-ring" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {matches.length} similar question{matches.length === 1 ? "" : "s"} found
                  </span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">vector match</span>
              </div>

              {matches.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No similar FAQ matched. You can draft a new question.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {matches.map((s) => {
                    const high = s.match >= 60;
                    const isOpen = expanded === s.id;
                    const fb = feedback[s.id] ?? "none";
                    return (
                      <div key={s.id}>
                        <button onClick={() => { setExpanded(isOpen ? null : s.id); setFb(s.id, "none"); }}
                          className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-secondary/60 transition-colors">

                          <span className="flex-1 text-sm font-medium">{s.q}</span>
                          <span className="text-[11px] text-muted-foreground hidden sm:inline">{s.section}</span>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }} className="overflow-hidden bg-gradient-to-b from-secondary/40 to-transparent">
                              <div className="px-5 py-5 space-y-4">
                                <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">{s.a}</p>
                                {fb === "none" ? (
                                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
                                    <span className="text-sm font-medium">Was this answer useful?</span>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => setFb(s.id, "yes")} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-success text-success-foreground">
                                        <ThumbsUp className="w-3.5 h-3.5" /> Yes
                                      </button>
                                      <button onClick={() => setFb(s.id, "no")} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-accent">
                                        <ThumbsDown className="w-3.5 h-3.5" /> No
                                      </button>
                                    </div>
                                  </div>
                                ) : fb === "yes" ? (
                                  <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/30 text-sm">
                                    <Check className="w-4 h-4 text-success" /> Thanks — feedback recorded.
                                  </div>
                                ) : (
                                  <button onClick={onAskCommunity} className="w-full inline-flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-medium text-sm shadow-glow">
                                    <span className="inline-flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Draft a new question for the community</span>
                                    <ArrowRight className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={onAskCommunity}
                className="w-full px-5 py-3 border-t border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center gap-2">
                None of these match — draft a new question <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isSearching && (
        <FaqBrowser sections={sections} active={sectionFilter} setActive={setSectionFilter} list={browseList} />
      )}
    </div>
  );
}

function FaqBrowser({ sections, active, setActive, list }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <BookOpen className="w-4 h-4 text-muted-foreground" />
        <span className="font-display text-lg font-semibold">Browse the FAQ</span>
        <span className="text-xs text-muted-foreground">· {list.length} questions</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button key={s} onClick={() => { setActive(s); setOpen(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${active === s ? "bg-primary text-primary-foreground border-primary shadow-soft" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-soft divide-y divide-border overflow-hidden">
        {list.map((f) => {
          const isOpen = open === f.id;
          return (
            <div key={f.id}>
              <button onClick={() => setOpen(isOpen ? null : f.id)}
                className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-secondary/60 transition-colors">
                <span className="text-[10px] mt-0.5 px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono shrink-0">{f.section}</span>
                <span className="flex-1 text-sm font-medium leading-snug">{f.q}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform mt-0.5 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <div className="px-5 pb-5 pt-1 text-sm text-foreground/85 whitespace-pre-line leading-relaxed">{f.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
