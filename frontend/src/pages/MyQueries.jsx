import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Inbox, MessageSquare, Users, Sparkles, Clock, CheckCircle2,
  XCircle, Trash2, Plus, X, Loader2, Check, AlertTriangle, ShieldAlert, AlertCircle, Bookmark,
} from "lucide-react";
import { Navbar } from "@/components/yaksha/Navbar";
import { useAuth } from "@/lib/auth";
import { store, addQuery, deleteQuery, hasBookmark, toggleBookmark, searchFaqs, checkFaqSimilarity, checkToxicity } from "@/lib/mockStore";
import { toast } from "sonner";

export default function MyQueries() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [state, setState] = useState(store.get());
  const [askOpen, setAskOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null); // id of query pending delete

  useEffect(() => store.subscribe(setState), []);

  useEffect(() => {
    if (location.state?.scrollTo) {
      setTimeout(() => {
        const el = document.getElementById(`query-${location.state.scrollTo}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [location.state, state.queries]);

  const mine = state.queries.filter(
    (q) => q.user?.email === user?.email || q.user?.handle === user?.handle
  );

  const navUser = {
    name: user?.name || "Student",
    handle: user?.handle || "@you",
    sp: user?.sp || 220,
    avatar: user?.avatar || "ST",
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-mesh pointer-events-none opacity-80" />
      <div className="relative">
        <Navbar user={navUser} active="queries" isAdmin={isAdmin} />
        <main className="mx-auto max-w-4xl px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-3xl font-bold">My Queries</h1>
              <p className="text-sm text-muted-foreground mt-1">
                All queries you've submitted and their current status.
              </p>
            </div>
            <button
              onClick={() => setAskOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow hover:opacity-95 transition"
            >
              <Plus className="w-4 h-4" /> Submit a Query
            </button>
          </div>

          {mine.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground text-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
                <Inbox className="w-5 h-5" />
              </div>
              No queries yet. Hit "Submit a Query" and AI will route it for you.
            </div>
          ) : (
            <div className="space-y-3">
              {mine.map((q, i) => (
                <QueryCard key={q.id} q={q} i={i} onDeleteRequest={() => setConfirmId(q.id)} />
              ))}
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {askOpen && <AskForm onClose={() => setAskOpen(false)} />}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {confirmId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-md"
            onClick={() => setConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-elegant p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-display font-semibold">Delete this query?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone. Any SP escrow will be refunded.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmId(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-secondary hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteQuery(confirmId).catch((e) => toast.error(e.message));
                    setConfirmId(null);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Status badge ─────────────────────────────────────────────────────────── */
function StatusBadge({ status, adminReviewRequested }) {
  const map = {
    pending: {
      color: adminReviewRequested
        ? "bg-primary/15 text-primary border-primary/40"
        : "bg-warning/15 text-warning-foreground border-warning/40",
      icon: adminReviewRequested
        ? <ShieldAlert className="w-3 h-3" />
        : <Clock className="w-3 h-3" />,
      label: adminReviewRequested ? "Awaiting Admin Review" : "Pending",
    },
    approved: {
      color: "bg-success/15 text-success border-success/40",
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "Approved",
    },
    answered: {
      color: "bg-success/15 text-success border-success/40",
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "Answered",
    },
    rejected: {
      color: "bg-destructive/15 text-destructive border-destructive/40",
      icon: <XCircle className="w-3 h-3" />,
      label: "Rejected",
    },
    restricted: {
      color: "bg-destructive/15 text-destructive border-destructive/40",
      icon: <XCircle className="w-3 h-3" />,
      label: "Restricted",
    },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

/* ─── Query card ───────────────────────────────────────────────────────────── */
function QueryCard({ q, i, onDeleteRequest }) {
  const isPersonal = q.route === "personal";
  const routeBadge = isPersonal
    ? { color: "bg-primary/15 text-primary", label: "Personal — Admin queue", icon: <Inbox className="w-3 h-3" /> }
    : { color: "bg-accent text-accent-foreground", label: "Posted to Community", icon: <Users className="w-3 h-3" /> };

  const [isSaved, setIsSaved] = useState(hasBookmark(q.id));

  const handleSave = () => {
    setIsSaved(toggleBookmark(q));
    toast.success(isSaved ? "Removed from bookmarks" : "Saved to bookmarks");
  };

  return (
    <motion.div
      id={`query-${q.id}`}
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
      className="p-5 rounded-2xl border border-border bg-card shadow-soft"
    >
      <div className="flex items-start justify-between mb-2 gap-3">
        <h3 className="font-display font-semibold">{q.title}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={q.status} adminReviewRequested={q.adminReviewRequested} />
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${routeBadge.color}`}>
            {routeBadge.icon} {routeBadge.label}
          </span>
          <button
            onClick={handleSave}
            className={`p-1 ml-1 rounded transition-colors ${isSaved ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
            title={isSaved ? "Remove bookmark" : "Bookmark query"}
          >
            <Bookmark className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => onDeleteRequest && onDeleteRequest()}
            className="p-1 ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
            title="Delete query"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{q.body || q.content}</p>

      {/* SP bet indicator */}
      {q.adminReviewRequested && q.adminReviewBetSp > 0 && (
        <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-xs font-medium text-primary">
          <ShieldAlert className="w-3 h-3" />
          {q.status === "pending"
            ? `${q.adminReviewBetSp} SP in escrow — awaiting verdict`
            : q.status === "approved"
            ? `Bet won! +${q.adminReviewBetSp * 2} SP`
            : `Bet lost — ${q.adminReviewBetSp * 2} SP deducted`}
        </div>
      )}

      {/* Admin reply */}
      {q.adminReply && (
        <div className="mt-3 p-3 rounded-xl bg-accent/60 text-accent-foreground border border-border">
          <div className="text-[11px] uppercase tracking-wider font-bold mb-1 inline-flex items-center gap-1.5">
            {q.aiAnswer ? <Sparkles className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
            {q.aiAnswer ? "AI-assisted admin reply" : "Admin reply"}
          </div>
          <p className="text-sm leading-relaxed">{q.adminReply}</p>
        </div>
      )}

      {/* Awaiting admin note */}
      {!q.adminReply && (isPersonal || q.adminReviewRequested) && q.status === "pending" && (
        <div className="text-xs text-muted-foreground mt-1">
          {q.adminReviewRequested
            ? "An admin will review your query and resolve the SP bet."
            : "An admin will reply privately here."}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Ask form modal ───────────────────────────────────────────────────────── */
function AskForm({ onClose }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [stage, setStage] = useState("draft"); // draft | checking | faqBlocked | faqMatch | toxicBlocked | ok | flagged
  const [requestAdminReview, setRequestAdminReview] = useState(false);
  const [betSp, setBetSp] = useState(10);
  const [matchedFaq, setMatchedFaq] = useState(null);
  const [matchScore, setMatchScore] = useState(0);
  const [toxicReason, setToxicReason] = useState("");

  const handlePreCheck = async () => {
    if (!title.trim()) return;
    setStage("checking");
    
    // 1. Strict Toxicity Pre-check
    const toxicity = await checkToxicity(`${title}\n${body}`);
    if (toxicity.isToxic) {
      setToxicReason(toxicity.reason);
      setStage("toxicBlocked");
      return;
    }

    // 2. Semantically check against all FAQs in the knowledge base
    const result = await checkFaqSimilarity(title);
    if (result.isDuplicate && result.matchedFaq) {
      // Hard block: ≥80% — this question is already answered in the FAQ
      setMatchedFaq(result.matchedFaq);
      setMatchScore(result.score);
      setStage("faqBlocked");
    } else if (result.isNearMatch && result.matchedFaq) {
      // Soft warn: 50–79% — similar but let user decide
      setMatchedFaq(result.matchedFaq);
      setMatchScore(result.score);
      setStage("faqMatch");
    } else {
      submit();
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    setStage("checking");
    try {
      const q = await addQuery({ title, body, requestAdminReview, betSp });
      setStage(q.route === "personal" ? "flagged" : "ok");
      if (q.route === "generic") setTimeout(onClose, 1600);
    } catch (err) {
      toast.error(err.message || "Failed to submit query");
      setStage("draft");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-elegant overflow-hidden"
      >
        {/* Draft stage */}
        {stage === "draft" && (
          <>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-display text-lg font-semibold">Submit a Query</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI screens for toxicity, then routes it — private or community.
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title — be specific"
                className="w-full bg-secondary/50 rounded-xl px-4 py-3 outline-none focus:ring-focus border border-border"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add context… AI will decide whether this is private or generic."
                rows={5}
                className="w-full bg-secondary/50 rounded-xl px-4 py-3 outline-none focus:ring-focus border border-border resize-none"
              />

              {/* SP Bet panel */}
              <div className="flex flex-col gap-2 p-3 border border-border rounded-xl bg-secondary/30">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={requestAdminReview}
                    onChange={(e) => setRequestAdminReview(e.target.checked)}
                    className="rounded border-border accent-primary w-4 h-4"
                  />
                  Request Priority Admin Review &amp; Bet SP
                </label>
                {requestAdminReview && (
                  <div className="mt-1 pl-6 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Bet 10–50 SP. Win = double back. Lose (duplicate/invalid) = lose double.
                    </p>
                    <div className="flex items-center gap-4">
                      <input
                        type="range" min="10" max="50" step="5" value={betSp}
                        onChange={(e) => setBetSp(Number(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="font-bold tabular-nums text-primary text-sm w-12 text-right">
                        {betSp} SP
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handlePreCheck}
                disabled={!title.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-medium shadow-glow disabled:opacity-40"
              >
                Analyze &amp; Submit
              </button>
            </div>
          </>
        )}

        {/* Toxicity Blocked Stage */}
        {stage === "toxicBlocked" && (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center border border-destructive/30">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <div className="text-center w-full max-w-sm">
              <h3 className="font-display text-lg font-semibold mb-1 text-destructive">Content Blocked</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your query was flagged by our automated moderation system for violating community guidelines.
              </p>
              
              <div className="text-left bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-5">
                <h4 className="font-semibold text-xs text-destructive mb-1">Reason:</h4>
                <p className="text-sm text-destructive/80 font-medium">{toxicReason}</p>
              </div>

              <button
                onClick={() => setStage("draft")}
                className="w-full px-4 py-2.5 rounded-xl bg-foreground text-background font-medium text-sm"
              >
                Go back and edit
              </button>
            </div>
          </div>
        )}

        {/* FAQ Blocked Stage — hard block, ≥80% similarity */}
        {stage === "faqBlocked" && matchedFaq && (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center border border-destructive/30">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <div className="text-center w-full max-w-sm">
              <h3 className="font-display text-lg font-semibold mb-1">This is already in the FAQ</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Your question is <strong>{matchScore}% semantically identical</strong> to an existing answer — it cannot be posted to the community.
              </p>

              {/* Confidence badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/25 text-xs font-bold text-destructive mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                {matchScore}% Semantic Match — Duplicate Blocked
              </div>

              <div className="text-left bg-secondary/30 border border-border rounded-xl p-4 mb-5">
                <h4 className="font-medium text-sm mb-2">{matchedFaq.q}</h4>
                <p className="text-xs text-muted-foreground line-clamp-4">{matchedFaq.a}</p>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 rounded-xl bg-foreground text-background font-medium text-sm"
              >
                Got it, close
              </button>
            </div>
          </div>
        )}

        {/* FAQ Match Stage — soft warn, 50–79% similarity */}
        {stage === "faqMatch" && matchedFaq && (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center border border-border">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center w-full max-w-sm">
              <h3 className="font-display text-lg font-semibold mb-1">We found a similar answer</h3>
              <p className="text-sm text-muted-foreground mb-3">This looks similar to your query — check if it helps first.</p>

              {/* Confidence badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/30 text-xs font-bold text-warning-foreground mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                {matchScore}% Semantic Similarity
              </div>
              
              <div className="text-left bg-secondary/30 border border-border rounded-xl p-4 mb-5">
                <h4 className="font-medium text-sm mb-2">{matchedFaq.q}</h4>
                <p className="text-xs text-muted-foreground line-clamp-4">{matchedFaq.a}</p>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-success text-success-foreground font-medium text-sm"
                >
                  Yes, this helped!
                </button>
                <button
                  onClick={submit}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 font-medium text-sm transition-colors"
                >
                  No, ask anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checking stage */}
        {stage === "checking" && (
          <div className="p-12 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Loader2 className="w-7 h-7 text-primary-foreground animate-spin" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold mb-1">AI Routing Engine…</h3>
              <p className="text-sm text-muted-foreground">Checking toxicity &amp; classifying your query.</p>
            </div>
          </div>
        )}

        {/* Submitted → community */}
        {stage === "ok" && (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-success text-success-foreground">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">Posted to Community</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                AI classified your query as generic. It's live on the community feed.
              </p>
            </div>
          </div>
        )}

        {/* Submitted → personal / admin */}
        {stage === "flagged" && (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-warning text-warning-foreground">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">Routed Privately to Admins</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                AI detected personal content (or you requested a priority review). It's in your queries list below.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background"
            >
              Back to My Queries
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
