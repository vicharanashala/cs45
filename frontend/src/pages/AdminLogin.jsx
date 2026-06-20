import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Shield, Mail, Lock, ArrowRight } from "lucide-react";
import { signIn } from "@/lib/mockStore";
import { toast } from "sonner";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (password === "csfaq1234") {
      try {
        await signIn({ email: "admin@yaksha.in", password: "admin", isAdmin: true });
        toast.success("Admin signed in");
        nav("/admin", { replace: true });
      } catch (err) {
        toast.error(err.message);
      }
    } else {
      toast.error("Incorrect password!");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-mesh px-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-elegant overflow-hidden">
        <div className="px-7 pt-7 pb-5 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Shield className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-2xl font-bold">Sara Admin</span>
          </div>
          <h1 className="font-display text-xl font-semibold">Admin Sign-in</h1>
          <p className="text-xs text-muted-foreground mt-1">Enter the secret admin password</p>
        </div>

        <form onSubmit={submit} className="px-7 pb-7 space-y-3">
          <Field icon={<Lock className="w-4 h-4" />} value={password} onChange={setPassword} placeholder="Admin Password" type="password" required />
          <button type="submit" className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-medium shadow-glow">
            <ArrowRight className="w-4 h-4" /> Enter Admin
          </button>
          <div className="pt-3 border-t border-border text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to FAQs</Link>
            <span className="mx-2">|</span>
            <Link to="/login" className="hover:text-foreground">Student login →</Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function Field({ icon, value, onChange, ...rest }) {
  return (
    <label className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-secondary/60 border border-border focus-within:ring-focus">
      <span className="text-muted-foreground">{icon}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground" {...rest} />
    </label>
  );
}
