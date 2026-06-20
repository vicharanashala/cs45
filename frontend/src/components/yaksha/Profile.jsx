import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Bookmark, History, Award, TrendingUp, MessageSquare, Check } from "lucide-react";
import { store, getAuth, getBookmarks } from "@/lib/mockStore";

export function Profile({ user }) {
  const nav = useNavigate();
  const [state, setState] = useState(store.get());
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    const unsub = store.subscribe((s) => setState(s));
    
    // Load local bookmarks
    setBookmarks(getBookmarks());

    // try fetch backend bookmarks if logged in
    const token = localStorage.getItem("yaksha.token.v1");
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/users/bookmarks`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((b) => {
          if (b && b.length > 0) setBookmarks(b);
        })
        .catch(() => {});
    }
    return () => unsub();
  }, []);

  const myQueries = state.queries || [];
  const myAnswers = state.answers || [];
  const notifications = state.notifications || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-1 rounded-2xl border border-border bg-card shadow-soft overflow-hidden"
      >
        <div className="h-24 bg-mesh" />
        <div className="px-6 pb-6 -mt-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-glow border-4 border-card">
            {user.avatar}
          </div>
          <h2 className="mt-4 text-xl font-display font-semibold">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{user.handle} · CSE '26</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Mini label="SP" value={user.sp} />
            <Mini label="Posts" value={myQueries.length} />
            <Mini label="Answers" value={myAnswers.filter((a) => a.status === "approved" || a.status === "approved").length} />
          </div>
          <div className="mt-5 p-3 rounded-xl bg-accent/60 text-accent-foreground">
            <div className="flex items-center gap-2 text-xs font-medium mb-1.5">
              <Award className="w-3.5 h-3.5" /> Next badge: Knowledge Steward
            </div>
            <div className="h-1.5 bg-card rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "62%" }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full bg-gradient-primary"
              />
            </div>
            <p className="text-[11px] mt-1.5 text-muted-foreground">280 SP to go</p>
          </div>
        </div>
      </motion.div>

      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Card
            icon={<TrendingUp className="w-4 h-4" />}
            title="Helpfulness streak"
            value="12 days"
            sub="+3 from last week"
          />
          <Card
            icon={<MessageSquare className="w-4 h-4" />}
            title="Avg. answer rating"
            value="4.8 / 5"
            sub="based on 31 ratings"
          />
        </div>

        <Section icon={<Bookmark className="w-4 h-4" />} title="Bookmarks">
          {bookmarks.length === 0 ? (
            <Row>
              <span className="text-sm text-muted-foreground">No bookmarks yet</span>
            </Row>
          ) : (
            bookmarks.map((b) => {
              const id = b._id || b.id;
              const title = b.title || b.question || b.name || b.label;
              const inMyQueries = myQueries.some((q) => q.id === id);
              
              return (
                <Row key={id}>
                  <Bookmark className="w-3.5 h-3.5 text-primary shrink-0" />
                  <button 
                    onClick={() => {
                      if (inMyQueries) {
                        nav("/my-queries", { state: { scrollTo: id } });
                      } else {
                        nav("/", { state: { view: "community", scrollTo: id } });
                      }
                    }}
                    className="text-sm text-left hover:text-primary transition-colors cursor-pointer"
                  >
                    {title}
                  </button>
                </Row>
              );
            })
          )}
        </Section>

        <Section icon={<History className="w-4 h-4" />} title="Activity log">
          {notifications.length === 0 ? (
            <Row>
              <span className="text-sm text-muted-foreground">No recent activity</span>
            </Row>
          ) : (
            notifications.slice(0, 10).map((n) => (
              <Row key={n._id || n.id}>
                <span className="text-[11px] tabular-nums text-muted-foreground w-20 shrink-0">
                  {new Date(n.createdAt || n.created || Date.now()).toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-primary shrink-0">{n.title || n.type || n.action || 'Activity'}</span>
                <span className="text-sm text-muted-foreground truncate">{n.message || n.content || n.body || ''}</span>
                <Check className="ml-auto w-3.5 h-3.5 text-success/70 shrink-0" />
              </Row>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="p-2 rounded-lg bg-secondary/60">
      <div className="text-base font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Card({ icon, title, value, sub }) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-soft">
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground font-medium">
        {icon} {title}
      </div>
      <div className="mt-2 text-2xl font-display font-bold tracking-tight">{value}</div>
      <div className="text-[11px] text-success mt-0.5">{sub}</div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2 text-sm font-display font-semibold">
        {icon} {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ children }) {
  return (
    <div className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
      {children}
    </div>
  );
}
