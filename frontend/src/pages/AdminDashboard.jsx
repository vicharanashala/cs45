import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Shield, LogOut, Sparkles, Check, X, Wand2, Send, Inbox, Flag, MessageSquare,
  AlertTriangle, Ban, TrendingDown, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { store, updateQuery, decideAnswer, generateAIAnswer, signOut } from "@/lib/mockStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("queries");
  const [activeAiId, setActiveAiId] = useState(null);
  const [state, setState] = useState(store.get());

  useEffect(() => store.subscribe(setState), []);

  const personalQueries = state.queries.filter((q) => q.route === "personal" && !q.flagged);
  const flaggedQueries = state.queries.filter((q) => q.flagged);
  const allQueries = state.queries;
  const aiPanelQueries = state.queries.filter((q) => 
    q.route === "community" || q.route === "generic" || (q.route === "personal" && q.status === "approved")
  );
  const pendingAnswers = state.answers.filter((a) => a.status === "pending");

  const logout = () => { signOut(); nav("/admin/login"); };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-mesh pointer-events-none opacity-80" />
      <div className="relative">
        <header className="sticky top-0 z-50 glass border-b border-border/60">
          <div className="mx-auto max-w-7xl px-6 h-16 flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Shield className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="leading-none">
                <div className="font-display font-bold text-lg">Sara Admin</div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Control plane</div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-4 text-sm">
              {[
                { id: "queries", l: "All Queries", n: allQueries.length },
                { id: "answers", l: "Pending Answers", n: pendingAnswers.length },
                { id: "personal", l: "Personal & Flagged", n: personalQueries.length + flaggedQueries.length },
                { id: "ai", l: "Query Resolution", n: null },
              ].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`relative px-3.5 py-1.5 font-medium rounded-lg transition-colors ${tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.l}{t.n != null && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border tabular-nums">{t.n}</span>}
                  {tab === t.id && <motion.div layoutId="admin-tab" className="absolute inset-0 bg-secondary rounded-lg -z-10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                </button>
              ))}
            </nav>
            <div className="flex-1" />
            <ThemeToggle />
          
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-10">
          {tab === "queries" && <AllQueries items={allQueries} setTab={setTab} setActiveAiId={setActiveAiId} />}
          {tab === "answers" && <AnswerApproval items={pendingAnswers} threads={state.threads} />}
          {tab === "personal" && <PersonalFlagged personal={personalQueries} flagged={flaggedQueries} />}
          {tab === "ai" && <AIPanel items={aiPanelQueries} activeId={activeAiId} setActiveId={setActiveAiId} threads={state.threads} />}
        </main>
      </div>
    </div>
  );
}

// ─────────── All Queries with approve/reject + feedback bar ───────────
function AllQueries({ items, setTab, setActiveAiId }) {
  const [active, setActive] = useState(null);
  const cur = items.find((q) => q.id === active);
  const [feedback, setFeedback] = useState("");

  const decide = async (id, status) => {
    try {
      await updateQuery(id, { status, decidedAt: Date.now() });
      toast.success(`Query ${status}`);
    } catch (err) {
      toast.error(err.message || "Failed to update query");
    }
  };
  const submitFeedback = async () => {
    if (!feedback.trim() || !cur) return;
    try {
      await updateQuery(cur.id, { adminFeedback: feedback });
      toast.success("Feedback saved");
      setFeedback("");
    } catch (err) {
      toast.error(err.message || "Failed to save feedback");
    }
  };

  if (items.length === 0) return <Empty msg="Inbox is clear." />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
      <div className="space-y-3">
        <h2 className="font-display text-2xl font-bold">All student queries</h2>
        {items.map((q) => (
          <motion.button key={q.id} layout onClick={() => { setActive(q.id); setFeedback(q.adminFeedback || ""); }}
            className={`w-full text-left p-5 rounded-2xl border bg-card shadow-soft transition-all ${active === q.id ? "border-primary ring-focus" : "border-border hover:border-primary/40"}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="font-display font-semibold truncate">{q.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{q.user.handle} · {timeAgo(q.createdAt)}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge tone={q.route === "personal" ? "primary" : "success"}>{q.route}</Badge>
                <Badge tone={q.status === "approved" ? "success" : q.status === "rejected" ? "destructive" : "muted"}>{q.status}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{q.body}</p>
            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              {q.route === "personal" ? (
                <>
                  <button
                    onClick={() => {
                      decide(q.id, "approved");
                      setActiveAiId(q.id);
                      setTab("ai");
                    }}
                    disabled={q.status === "approved" || q.status === "answered"}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      q.status === "approved" || q.status === "answered"
                        ? "bg-success/20 text-success cursor-default opacity-80"
                        : "bg-success text-success-foreground hover:bg-success/90"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" /> Accept &amp; Resolve
                  </button>
                  <button
                    onClick={() => {
                      decide(q.id, "rejected");
                      setActiveAiId(q.id);
                      setTab("ai");
                    }}
                    disabled={q.status === "rejected"}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      q.status === "rejected"
                        ? "bg-destructive/20 text-destructive cursor-default opacity-80"
                        : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    }`}
                  >
                    <X className="w-3.5 h-3.5" /> Reject &amp; Resolve
                  </button>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-auto bg-secondary px-2 py-1 rounded-md">
                    <Check className="w-3 h-3 text-success" />
                    {store.get().answers.filter(a => a.threadId === q.id && a.isAccepted).length} Verified Answers
                  </span>
                  <button
                    onClick={() => {
                      updateQuery(q.id, { flagged: true });
                      toast.success("Query flagged for review");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
                  >
                    <Flag className="w-3.5 h-3.5" /> Flag
                  </button>
                </>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 self-start">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Feedback
        </h2>
        {cur ? (
          <div className="p-5 rounded-2xl border border-border bg-card shadow-soft space-y-3">
            <div className="text-xs text-muted-foreground">Feedback on:</div>
            <div className="font-medium text-sm">{cur.title}</div>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={5} placeholder="Write internal feedback / triage notes…"
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-focus resize-none" />
            <button onClick={submitFeedback} disabled={!feedback.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow disabled:opacity-40">
              <Send className="w-3.5 h-3.5" /> Save feedback
            </button>
            {cur.adminFeedback && (
              <div className="text-[11px] text-muted-foreground">Last saved: "{cur.adminFeedback}"</div>
            )}
          </div>
        ) : (
          <div className="p-5 rounded-2xl border border-dashed border-border text-sm text-muted-foreground text-center">
            Click a query to leave feedback.
          </div>
        )}
      </aside>
    </div>
  );
}

// ─────────── Pending answers approval ───────────
function AnswerApproval({ items, threads }) {
  if (items.length === 0) return <Empty msg="No pending answers." />;
  return (
    <div className="grid gap-4">
      <h2 className="font-display text-2xl font-bold">Pending student answers</h2>
      {items.map((a) => {
        const t = threads.find((x) => x.id === a.threadId);
        return (
          <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl border border-border bg-card shadow-soft">
            <div className="text-xs text-muted-foreground mb-1">On thread: {t?.title ?? "—"}</div>
            <p className="text-sm leading-relaxed mb-4">{a.body}</p>
            <div className="flex gap-2">
              <button onClick={() => { decideAnswer(a.id, "approved"); toast.success("Approved"); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success text-success-foreground">
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button onClick={() => { decideAnswer(a.id, "rejected"); toast.success("Rejected"); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive text-destructive-foreground">
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─────────── Personal + Flagged with moderation actions ───────────
function PersonalFlagged({ personal, flagged }) {
  const [tab, setTab] = useState("personal");
  const list = tab === "personal" ? personal : flagged;

  const warn = (q) => { updateQuery(q.id, { warnings: (q.warnings || 0) + 1 }); toast.success(`Warning issued to ${q.user.handle}`); };
  const penalize = (q) => { updateQuery(q.id, { sp: Math.max(0, (q.sp || 0) - 50) }); toast.success(`-50 SP from ${q.user.handle}`); };
  const restrict = (q) => { updateQuery(q.id, { status: "restricted" }); toast.success(`${q.user.handle} restricted`); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Personal & flagged queue</h2>
        <div className="inline-flex p-1 rounded-xl bg-secondary border border-border text-sm">
          <Tab on={tab === "personal"} onClick={() => setTab("personal")} icon={<Inbox className="w-3.5 h-3.5" />} label="Personal" n={personal.length} />
          <Tab on={tab === "flagged"} onClick={() => setTab("flagged")} icon={<Flag className="w-3.5 h-3.5" />} label="Flagged" n={flagged.length} />
        </div>
      </div>

      {list.length === 0 ? <Empty msg="Queue is empty." /> : list.map((q) => (
        <div key={q.id} className="p-5 rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="font-display font-semibold">{q.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{q.user.handle} · {q.warnings} warnings · {q.sp} SP</div>
            </div>
            <Badge tone={q.flagged ? "destructive" : "primary"}>{q.flagged ? "FLAGGED" : "PRIVATE"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{q.body}</p>
          <div className="flex flex-wrap gap-2">
            <ActionBtn icon={<Shield className="w-3.5 h-3.5" />} label="Issue warning" onClick={() => warn(q)} />
            <ActionBtn icon={<TrendingDown className="w-3.5 h-3.5" />} label="Penalize -50 SP" tone="warning" onClick={() => penalize(q)} />
            <ActionBtn icon={<Ban className="w-3.5 h-3.5" />} label="Restrict user" tone="destructive" onClick={() => restrict(q)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────── AI Answer generator: click query → generate ───────────
import { addAnswer } from "@/lib/mockStore";

function AIPanel({ items, activeId, setActiveId, threads }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const cur = items.find((q) => q.id === activeId);

  const generate = () => {
    if (!cur) return;
    setBusy(true);
    setTimeout(() => {
      if (cur.route === "generic" || cur.route === "community") {
        const communityAnswers = threads.filter(a => a.threadId === cur.id);
        if (communityAnswers.length > 0) {
          setDraft(`Based on community consensus:\n\n${communityAnswers.map(a => `- ${a.body}`).join("\n")}`);
        } else {
          setDraft(generateAIAnswer(cur));
        }
      } else {
        setDraft(generateAIAnswer(cur));
      }
      setBusy(false);
    }, 600);
  };

  const addToFaqs = async () => {
    if (!cur || !draft.trim()) return;
    try {
      const token = localStorage.getItem("yaksha.token.v1");
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/admin/summarize/${cur.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Query sent to AI FAQ generation queue!");
      } else {
        toast.success("Query summarized and added to FAQs (Mock)");
      }
      setDraft(""); setActiveId(null);
    } catch (e) {
      toast.success("Query summarized and added to FAQs (Mock)");
    }
  };

  const send = async () => {
    if (!cur || !draft.trim()) return;
    try {
      if (cur.route === "generic" || cur.route === "community") {
        await addAnswer(cur.id, draft, "Admin");
      } else {
        await updateQuery(cur.id, { adminReply: draft, aiAnswer: draft, status: "answered" });
      }
      toast.success("AI answer posted");
      setDraft(""); setActiveId(null);
    } catch (err) {
      toast.error(err.message || "Failed to post answer");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-6">
      <div className="space-y-3">
        <h2 className="font-display text-2xl font-bold">AI Answer Generator</h2>
        <p className="text-sm text-muted-foreground">Click any query to instantly draft an AI-generated answer.</p>
        {items.map((q) => (
          <button key={q.id} onClick={() => { setActiveId(q.id); setDraft(""); }}
            className={`w-full text-left p-4 rounded-xl border bg-card shadow-soft transition-all ${activeId === q.id ? "border-primary ring-focus" : "border-border hover:border-primary/40"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{q.title}</div>
                <div className="text-[11px] text-muted-foreground">{q.user.handle} · {q.route}</div>
              </div>
              <Wand2 className="w-4 h-4 text-primary shrink-0" />
            </div>
          </button>
        ))}
      </div>

      <aside className="lg:sticky lg:top-24 self-start">
        {cur ? (
          <div className="p-5 rounded-2xl border border-border bg-card shadow-soft space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> AI Draft
            </div>
            <div className="text-sm font-medium">{cur.title}</div>
            <div className="text-xs text-muted-foreground border-l-2 border-border pl-3">{cur.body}</div>
            {!draft && (
              <button onClick={generate} disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow disabled:opacity-50">
                <Wand2 className="w-4 h-4" /> {busy ? "Generating…" : "Generate AI answer"}
              </button>
            )}
            {draft && (
              <>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-focus resize-none" />
                <div className="flex gap-2">
                  <button onClick={send} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-success text-success-foreground text-sm font-medium">
                    <Send className="w-3.5 h-3.5" /> Post Response
                  </button>
                  {(cur.route === "generic" || cur.route === "community") && (
                    <button onClick={addToFaqs} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                      <Sparkles className="w-3.5 h-3.5" /> Add to FAQs
                    </button>
                  )}
                  <button onClick={generate} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm">
                    <Wand2 className="w-3.5 h-3.5" /> Regenerate
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-5 rounded-2xl border border-dashed border-border text-sm text-muted-foreground text-center">
            Select a query on the left to generate an answer.
          </div>
        )}
      </aside>
    </div>
  );
}

// ─────────── helpers ───────────
function Badge({ tone, children }) {
  const c = { primary: "bg-primary/15 text-primary", success: "bg-success/15 text-success", destructive: "bg-destructive/15 text-destructive", muted: "bg-secondary text-muted-foreground" }[tone] || "bg-secondary text-muted-foreground";
  return <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${c}`}>{children}</span>;
}
function Tab({ on, onClick, icon, label, n }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 ${on ? "bg-card shadow-soft text-foreground" : "text-muted-foreground"}`}>
      {icon}{label}<span className="text-[10px] px-1 rounded bg-secondary border border-border tabular-nums">{n}</span>
    </button>
  );
}
function ActionBtn({ icon, label, tone, onClick }) {
  const c = tone === "destructive" ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
    : tone === "warning" ? "bg-warning/15 text-warning-foreground hover:bg-warning/25"
    : "bg-secondary hover:bg-accent";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${c}`}>
      {icon} {label}
    </button>
  );
}
function Empty({ msg }) { return <div className="text-center py-20 text-muted-foreground text-sm">{msg}</div>; }
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
