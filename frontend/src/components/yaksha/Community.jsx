import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUp, ArrowDown, MessageSquare, Bookmark, ShieldCheck,
  Plus, Send,
} from "lucide-react";
import { store, addAnswer, fetchQuestionDetails, voteQuestion, hasBookmark, toggleBookmark } from "@/lib/mockStore";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function Community() {
  const location = useLocation();
  const [sort, setSort] = useState("top");
  const [state, setState] = useState(store.get());
  const [votes, setVotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("yaksha.votes.v1") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => store.subscribe(setState), []);

  useEffect(() => {
    if (location.state?.scrollTo) {
      setTimeout(() => {
        const el = document.getElementById(`query-${location.state.scrollTo}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [location.state, state.threads]);

  const sorted = [...state.threads].sort((a, b) => {
    if (sort === "top") return (b.upvotes ?? 0) - (a.upvotes ?? 0);
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });

  const vote = async (id, dir) => {
    const currentVote = votes[id] || 0;
    const val = currentVote === dir ? -dir : dir;
    try {
      await voteQuestion(id, val);
      const newVotes = { ...votes, [id]: currentVote === dir ? 0 : dir };
      setVotes(newVotes);
      localStorage.setItem("yaksha.votes.v1", JSON.stringify(newVotes));
      toast.success("Vote recorded");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="inline-flex p-1 rounded-xl bg-secondary border border-border">
            {["top", "new"].map((k) => (
              <button key={k} onClick={() => setSort(k)}
                className={`relative px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${sort === k ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {sort === k && <motion.div layoutId="sort-pill" className="absolute inset-0 bg-card shadow-soft rounded-lg -z-10" />}
                {k === "new" ? "Newest" : "Top"}
              </button>
            ))}
          </div>
          <Link to="/my-queries"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow hover:opacity-95 transition">
            <Plus className="w-4 h-4" /> Ask a Question
          </Link>
        </div>

        {sorted.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">No threads yet.</div>
        ) : (
          <div className="space-y-3">
            {sorted.map((t, i) => (
              <ThreadCard
                key={t.id || t._id}
                t={t}
                i={i}
                answers={state.answers.filter((a) => a.threadId === (t.id || t._id))}
                vote={votes[t.id || t._id] ?? 0}
                onVote={(d) => vote(t.id || t._id, d)}
              />
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display font-semibold text-sm mb-3">Community Pulse</h3>
          <Stat label="Threads" value={state.threads.length} />
          <Stat label="Answers" value={state.answers.length} />
          <Stat label="Avg. response" value="4.2m" />
        </div>
        <div className="rounded-2xl border border-border bg-mesh p-5 shadow-soft">
          <h3 className="font-display font-semibold text-sm mb-2">Tip</h3>
          <p className="text-xs text-muted-foreground">
            Questions are submitted from the <strong>My Queries</strong> page. Private ones go
            to admins; generic ones appear here.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function Stat({ label, value }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ThreadCard({ t, i, answers, vote, onVote }) {
  const [expand, setExpand] = useState(false);
  const [body, setBody] = useState("");
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(hasBookmark(t.id || t._id));

  const handleSave = () => {
    setIsSaved(toggleBookmark(t));
    toast.success(isSaved ? "Removed from bookmarks" : "Saved to bookmarks");
  };

  const submitAnswer = async () => {
    if (!body.trim()) return;
    try {
      await addAnswer(t.id || t._id, body, user?.handle || "@you");
      setBody("");
      toast.success("Answer submitted!");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleExpand = () => {
    if (!expand) fetchQuestionDetails(t.id || t._id);
    setExpand(!expand);
  };

  const authorName = t.author?.name || t.author || "Community";
  const bodyText   = t.body || t.content || "";

  return (
    <motion.article
      id={`query-${t.id || t._id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-elegant transition-all"
    >
      <div className="flex gap-4">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={() => onVote(1)}
            className={`p-1.5 rounded-lg ${vote === 1 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <span className={`text-sm font-bold tabular-nums ${vote === 1 ? "text-primary" : vote === -1 ? "text-destructive" : "text-foreground"}`}>
            {(t.upvotes ?? 0) + vote}
          </span>
          <button
            onClick={() => onVote(-1)}
            className={`p-1.5 rounded-lg ${vote === -1 ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <ArrowDown className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 text-xs">
            {t.tag && (
              <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium">{t.tag}</span>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{authorName}</span>
          </div>
          <h3 className="font-display text-lg font-semibold leading-snug mb-1.5">{t.title}</h3>
          {bodyText && <p className="text-sm text-muted-foreground">{bodyText}</p>}

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <button onClick={toggleExpand} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              {expand ? "Hide answers" : `View ${answers.length} answer${answers.length !== 1 ? "s" : ""}`}
            </button>
            <button onClick={handleSave} className={`inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer ${isSaved ? "text-primary" : ""}`}>
              <Bookmark className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} /> {isSaved ? "Saved" : "Save"}
            </button>
          </div>

          {!expand && t.latestAnswer && (
            <div className="mt-3 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-medium text-foreground">Latest answer</span>
                <span>{t.latestAnswer.author?.name || t.latestAnswer.author || "@mentor"}</span>
              </div>
              <p className="line-clamp-2">{t.latestAnswer.body || t.latestAnswer.content}</p>
            </div>
          )}
        </div>
      </div>

      {/* Expanded answers + reply box */}
      <AnimatePresence>
        {expand && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-4 pl-12"
          >
            <div className="space-y-2">
              {answers.length === 0 && (
                <div className="text-xs text-muted-foreground py-2">No answers yet. Be the first!</div>
              )}
              {answers.map((a) => (
                <div
                  key={a.id || a._id}
                  className={`p-3 rounded-xl text-sm border ${
                    a.isAccepted
                      ? "bg-success/10 border-success/30"
                      : a.status === "rejected"
                      ? "bg-destructive/10 border-destructive/30 opacity-60"
                      : "bg-secondary/40 border-border"
                  }`}
                >
                  {a.isAccepted && (
                    <div className="text-[10px] uppercase font-bold tracking-wider mb-1 text-success inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Accepted answer
                    </div>
                  )}
                  <p>{a.body || a.content}</p>
                  <div className="text-[10px] text-muted-foreground mt-1.5">
                    {a.author?.name || a.author || "Community member"}
                  </div>
                </div>
              ))}

              {user && (
                <div className="flex gap-2 pt-2">
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitAnswer()}
                    placeholder="Write an answer…"
                    className="flex-1 px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm outline-none focus:ring-focus"
                  />
                  <button
                    onClick={submitAnswer}
                    disabled={!body.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Submit
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
