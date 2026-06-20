import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Navbar } from "@/components/yaksha/Navbar";
import { YakshaSearch } from "@/components/yaksha/YakshaSearch";
import { Community } from "@/components/yaksha/Community";
import { Profile } from "@/components/yaksha/Profile";
import { useAuth } from "@/lib/auth";

export default function Index() {
  const location = useLocation();
  const [view, setView] = useState(location.state?.view || "search");
  const { user, profile, isAdmin } = useAuth();
  const nav = useNavigate();

  const requireAuth = (next) => {
    if (!user) return nav("/login", { state: { from: "/" } });
    setView(next);
  };

  const onNavigate = (v) => {
    if (v === "search") return setView(v);
    requireAuth(v);
  };

  const navUser = {
    name: profile?.name || "Guest",
    handle: profile?.handle || "@guest",
    sp: profile?.sp || 220,
    avatar: profile?.avatar || "G",
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-mesh pointer-events-none opacity-80" />
      <div className="relative">
        <Navbar user={navUser} active={view} onNavigate={onNavigate} isAdmin={isAdmin} />
        <main className="mx-auto max-w-7xl px-6 py-10 md:py-14">
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
              {view === "search" && (
                <div className="space-y-12">
                  <YakshaSearch onAskCommunity={() => requireAuth("community")} />
                  <Highlights />
                </div>
              )}
              {view === "community" && user && <Community />}
              {view === "profile" && user && <Profile user={navUser} />}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-border/60 mt-16">
          <div className="mx-auto max-w-7xl px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>© Yaksha · Campus Knowledge OS</span>
            <span className="font-mono">Public search · Login required for community & queries</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Highlights() {
  const items = [
    { k: "Redundancy prevented", v: "1,284", d: "Questions resolved via vector match this month — saved 47 hours of mentor time." },
    { k: "Avg. confidence", v: "87%", d: "Top match score across student queries — green-badge threshold is 80%." },
    { k: "Private tickets routed", v: "62", d: "PII-flagged queries escalated to admins automatically, off the public feed." },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
      {items.map((it, i) => (
        <motion.div key={it.k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
          className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur shadow-soft">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{it.k}</div>
          <div className="mt-1.5 text-3xl font-display font-bold tracking-tight text-gradient">{it.v}</div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{it.d}</p>
        </motion.div>
      ))}
    </div>
  );
}
