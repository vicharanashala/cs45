import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MoreHorizontal, Inbox, Flag, Send, Ban, Shield, TrendingDown } from "lucide-react";
import { flagged } from "./mockData";
import { store, updateQuery } from "@/lib/mockStore";
import { toast } from "sonner";

export function AdminPanel() {
  const [queue, setQueue] = useState("personal");
  const [state, setState] = useState(store.get());
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState("");
  const [resolved, setResolved] = useState([]);

  useEffect(() => store.subscribe(setState), []);

  const personalTickets = state.queries.filter(q => q.route === 'personal');
  const list = queue === "personal" ? personalTickets : flagged;

  const resolve = async (id, isValid = true) => {
    try {
      await updateQuery(id, { status: "approved", adminReply: reply, isValid });
      setResolved((r) => [...r, id]);
      setReply("");
      toast.success("Ticket resolved");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Open tickets" value="14" tone="primary" />
        <Metric label="Flagged content" value="3" tone="destructive" />
        <Metric label="Resolved today" value="47" tone="success" />
        <Metric label="Avg. SLA" value="12m" tone="muted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <div className="grid grid-cols-2 border-b border-border">
            <Tab
              active={queue === "personal"}
              onClick={() => {
                setQueue("personal");
                setActive(personalTickets[0]);
              }}
              icon={<Inbox className="w-3.5 h-3.5" />}
              label="Personal"
              count={personalTickets.length}
            />

            <Tab
              active={queue === "flagged"}
              onClick={() => {
                setQueue("flagged");
                setActive(flagged[0]);
              }}
              icon={<Flag className="w-3.5 h-3.5" />}
              label="Flagged"
              count={flagged.length}
            />
          </div>
          <div className="divide-y divide-border max-h-[480px] overflow-auto">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  active?.id === t.id ? "bg-accent/70" : "hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold truncate">{queue === "personal" ? t.title : t.subject}</span>
                  <SevDot s={t.severity || "medium"} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{queue === "personal" ? t.user.handle : t.user}</span>
                  <span>{queue === "personal" ? new Date(t.createdAt).toLocaleDateString() : t.age}</span>
                </div>
                {resolved.includes(t.id) && (
                  <span className="mt-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success/15 text-success">
                    RESOLVED
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-soft p-6">
          {active ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        queue === "personal"
                          ? "bg-primary/15 text-primary"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {queue === "personal" ? "Private ticket" : "Flagged content"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {queue === "personal" ? active.user.handle : active.user} · {queue === "personal" ? new Date(active.createdAt).toLocaleDateString() : active.age}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-semibold">{queue === "personal" ? active.title : active.subject}</h3>
                </div>
                <button className="p-2 rounded-lg hover:bg-secondary">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-secondary/50 border border-border text-sm leading-relaxed">
                {active.body}
              </div>
              
              {queue === "personal" && active.adminReviewBetSp > 0 && (
                <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">SP Bet Attached</span>
                  <p className="text-sm mt-1">This user bet <b>{active.adminReviewBetSp} SP</b> that this query is new and valid.</p>
                </div>
              )}

              {queue === "personal" ? (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Response
                  </label>
                  <textarea
                    rows={5}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Draft a private response to the student…"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-focus resize-none"
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Sent privately to {active.user.handle}.
                    </span>
                    {active.adminReviewBetSp > 0 ? (
                      <div className="flex gap-2">
                         <button
                           disabled={!reply.trim()}
                           onClick={() => resolve(active.id, false)}
                           className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-40"
                         >
                           Invalid (-SP)
                         </button>
                         <button
                           disabled={!reply.trim()}
                           onClick={() => resolve(active.id, true)}
                           className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success text-success-foreground text-sm font-medium disabled:opacity-40"
                         >
                           <Send className="w-3.5 h-3.5" /> Valid (+SP)
                         </button>
                      </div>
                    ) : (
                      <button
                        disabled={!reply.trim()}
                        onClick={() => resolve(active.id, true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" /> Resolve & Notify
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold">User: {active.user}</span>
                      <span className="text-xs text-muted-foreground">3 prior warnings</span>
                    </div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Adjust SP score
                    </label>
                    <SPSlider />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Action icon={<Shield className="w-3.5 h-3.5" />} label="Issue warning" />
                    <Action
                      icon={<TrendingDown className="w-3.5 h-3.5" />}
                      label="Penalize -50 SP"
                      tone="warning"
                    />
                    <Action
                      icon={<Ban className="w-3.5 h-3.5" />}
                      label="Block user"
                      tone="destructive"
                    />
                    <button
                      onClick={() => resolve(active.id)}
                      className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium"
                    >
                      Mark resolved
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-20">
              Select a ticket from the queue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  const toneClass = {
    primary: "text-primary",
    destructive: "text-destructive",
    success: "text-success",
    muted: "text-foreground",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl border border-border bg-card shadow-soft"
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div
        className={`mt-1.5 text-3xl font-display font-bold tracking-tight tabular-nums ${toneClass[tone]}`}
      >
        {value}
      </div>
    </motion.div>
  );
}

function Tab({ active, onClick, icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
        active ? "bg-secondary/60 text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border tabular-nums">
        {count}
      </span>
    </button>
  );
}

function SevDot({ s }) {
  const c = s === "high" ? "bg-destructive" : s === "medium" ? "bg-warning" : "bg-muted-foreground";
  return <span className={`w-1.5 h-1.5 rounded-full ${c}`} />;
}

function Action({ icon, label, tone }) {
  const c =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
      : tone === "warning"
        ? "bg-warning/15 text-warning-foreground hover:bg-warning/25"
        : "bg-secondary hover:bg-accent";
  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${c}`}
    >
      {icon} {label}
    </button>
  );
}

function SPSlider() {
  const [v, setV] = useState(180);
  return (
    <div className="mt-2 space-y-2">
      <input
        type="range"
        min={0}
        max={500}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        className="w-full accent-primary"
      />

      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>0</span>
        <span className="font-semibold text-foreground">{v} SP</span>
        <span>500</span>
      </div>
    </div>
  );
}
