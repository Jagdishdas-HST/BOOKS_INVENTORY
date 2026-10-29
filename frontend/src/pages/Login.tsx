import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Shield, Users, LogIn, ChevronRight, X } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { SEO } from "@/components/SEO";

const DEMO_ACCOUNTS = [
  { role: "Super Admin", username: "admin", password: "admin123", color: "#7c3aed", bg: "#ede9fe" },
  { role: "Manager", username: "manager", password: "manager123", color: "#0891b2", bg: "#cffafe" },
  { role: "Distributor · Nitai Chand", username: "nitai", password: "nitai123", color: "#059669", bg: "#d1fae5" },
  { role: "Distributor · Vraja Kishor", username: "vraja", password: "vraja123", color: "#d97706", bg: "#fef3c7" },
  { role: "Distributor · Madhava Dasa", username: "madhava", password: "madhava123", color: "#dc2626", bg: "#fee2e2" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);

  async function handleLogin(u?: string, p?: string) {
    const user = (u ?? username).trim();
    const pass = p ?? password;
    if (!user || !pass) { setError("Please enter username and password."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error?.message ?? "Invalid credentials."); return; }
      login(data.token, data.user);
      navigate("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillAndLogin(acc: (typeof DEMO_ACCOUNTS)[0]) {
    setShowDemo(false);
    setUsername(acc.username);
    setPassword(acc.password);
    handleLogin(acc.username, acc.password);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <SEO title="Sign In – Inventory Tracker" description="Sign in to manage your book inventory." />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-200">
            <Shield size={32} color="#fff" />
          </div>
          <h1 className="text-slate-900 text-3xl font-bold">Inventory Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-1.5">Password</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 focus-within:ring-2 focus-within:ring-violet-400">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter password"
                className="flex-1 py-3 text-slate-900 text-base bg-transparent focus:outline-none"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-slate-400 hover:text-slate-600 ml-2">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={() => handleLogin()}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </div>

        {/* Demo accounts */}
        <button
          onClick={() => setShowDemo(true)}
          className="mt-5 w-full flex items-center justify-between bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 hover:bg-violet-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
              <Users size={18} color="#7c3aed" />
            </div>
            <div className="text-left">
              <p className="text-violet-800 font-semibold text-sm">Try Demo Accounts</p>
              <p className="text-violet-500 text-xs mt-0.5">5 pre-loaded accounts available</p>
            </div>
          </div>
          <ChevronRight size={18} color="#7c3aed" />
        </button>
      </div>

      {/* Demo modal */}
      {showDemo && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-slate-900 text-base font-bold">Demo Accounts</h2>
              <button onClick={() => setShowDemo(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                <X size={18} color="#0f172a" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {DEMO_ACCOUNTS.map((acc) => (
                <div key={acc.username} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3" style={{ backgroundColor: acc.bg }}>
                    <span className="font-bold text-sm" style={{ color: acc.color }}>{acc.role}</span>
                  </div>
                  <div className="px-4 py-3 bg-white">
                    <div className="flex gap-4 mb-3">
                      <div className="flex-1">
                        <p className="text-slate-400 text-xs mb-0.5">Username</p>
                        <p className="text-slate-900 font-semibold text-sm">{acc.username}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-400 text-xs mb-0.5">Password</p>
                        <p className="text-slate-900 font-semibold text-sm">{acc.password}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => fillAndLogin(acc)}
                      className="w-full rounded-xl py-2 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: acc.color }}
                    >
                      Quick Sign In
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4 pt-2">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-amber-700 text-xs text-center">Every action is critically logged with actor name, ID, and timestamp in the Audit Log.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}