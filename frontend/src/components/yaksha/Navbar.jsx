import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Sparkles, Shield, Bell, LogIn, LogOut, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { store, markNotificationRead } from "@/lib/mockStore";

export function Navbar({ user: navUser, active, onNavigate, isAdmin: adminProp, onOpenFaqs }) {
  const { user: authUser, profile, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [storeState, setStoreState] = useState(store.get());
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => store.subscribe(setStoreState), []);

  const notifications = storeState.notifications || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loggedOutTabs = [{ id: "faqs", label: "FAQs", path: "/" }];
  const loggedInTabs = [
    { id: "community", label: "Community", path: "/" },
    { id: "queries", label: "My Queries", path: "/my-queries" },
    { id: "profile", label: "Profile", path: "/" },
  ];
  const tabs = authUser ? loggedInTabs : loggedOutTabs;

  const go = (t) => {
    if (t.path !== "/") return nav(t.path);
    nav("/", { state: { view: t.id } });
    onNavigate?.(t.id);
  };

  const display = {
    name: profile?.name ?? profile?.display_name ?? navUser?.name ?? "Guest",
    initials: profile?.avatar ?? profile?.avatar_initials ?? navUser?.avatar ?? "G",
    sp: profile?.sp ?? navUser?.sp ?? 0,
  };
  const max = 500;
  const pct = Math.min(100, (display.sp / max) * 100);

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-lg tracking-tight">Sara</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Campus Knowledge OS
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => go(t)}
              className={`relative px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                active === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {active === t.id && (
                <motion.div layoutId="nav-active" className="absolute inset-0 bg-secondary rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
            </button>
          ))}
          <Link to="/admin/login" className="px-3.5 py-1.5 text-sm font-medium rounded-lg text-warning-foreground bg-warning/30 hover:bg-warning/40 inline-flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Admin
          </Link>
        </nav>

        <div className="flex-1" />

        {authUser && (
          <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-secondary/70 border border-border/60">
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reputation</span>
              <span className="text-sm font-semibold tabular-nums">{display.sp} SP</span>
            </div>
            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-primary" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
            </div>
          </div>
        )}

        {authUser && (
          <button
            onClick={onOpenFaqs ? onOpenFaqs : () => nav("/", { state: { view: "faqs" } })}
            title="Browse FAQs"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-secondary/70 hover:bg-secondary text-foreground"
          >
            <BookOpen className="w-3.5 h-3.5" /> FAQs
          </button>
        )}

        <ThemeToggle />

        {authUser ? (
          <>
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-[10px] font-bold text-primary-foreground rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-card p-4 shadow-xl z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                    <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs text-muted-foreground font-medium">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => {
                            if (!n.isRead) {
                              markNotificationRead(n._id);
                            }
                          }}
                          className={`p-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                            n.isRead
                              ? "bg-transparent text-muted-foreground hover:bg-secondary/40"
                              : "bg-primary/5 border border-primary/10 hover:bg-primary/10"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{n.title}</p>
                              <p className="mt-0.5 leading-relaxed text-muted-foreground">{n.message}</p>
                              <span className="text-[10px] text-muted-foreground block mt-1">
                                {timeAgo(new Date(n.createdAt).getTime())}
                              </span>
                            </div>
                            {!n.isRead && (
                              <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0 mt-1" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-secondary/60">
              <div className="w-8 h-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                {display.initials}
              </div>
              <span className="hidden sm:inline text-sm font-medium">{display.name}</span>
              <button onClick={() => { signOut(); nav("/"); }} className="p-1.5 hover:bg-card rounded-md text-muted-foreground hover:text-foreground" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <Link to="/login" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow">
            <LogIn className="w-4 h-4" /> Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function timeAgo(ts) {
  if (!ts) return "some time ago";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
