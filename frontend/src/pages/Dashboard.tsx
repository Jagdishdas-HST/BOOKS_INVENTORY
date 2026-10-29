import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, BookOpen, Boxes, Users, BarChart3, LogOut,
  TrendingUp, AlertTriangle, HandCoins, Plus, RefreshCw,
  Activity, Target, Banknote,
} from "lucide-react";
import { useAuthStore, type AuthUser } from "@/lib/authStore";
import { SEO } from "@/components/SEO";
import { ClientOnly } from "@/components/ClientOnly";

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  inventory_manager: "Inventory Manager",
  distributor: "Distributor",
};

function inr(n: number) {
  return `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
}
function inrK(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

async function apiFetch(path: string, token: string) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent ? `${accent}18` : "#f1f5f9" }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-slate-900 text-2xl font-extrabold mt-0.5">{value}</p>
        {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user) as AuthUser | null;
  const token = useAuthStore((s) => s.token) as string;
  const logout = useAuthStore((s) => s.logout);

  const [balance, setBalance] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [monthSummary, setMonthSummary] = useState<any>(null);
  const [conflictCount, setConflictCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDistributor = user?.role === "distributor";
  const isManagerOrAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";

  async function load() {
    if (!user || !token) return;
    try {
      if (isDistributor) {
        const [b, h] = await Promise.all([
          apiFetch("/api/sales/balance", token),
          apiFetch("/api/stock/holdings", token),
        ]);
        setBalance(b);
        setHoldings(h);
      } else {
        const [d, ls, cc, ms] = await Promise.all([
          apiFetch("/api/users/distributors", token),
          apiFetch("/api/stock/low-stock", token),
          apiFetch("/api/conflicts/pending-count", token).catch(() => ({ count: 0 })),
          apiFetch("/api/reports?range=month", token).catch(() => null),
        ]);
        setDistributors(d);
        setLowStock(ls);
        setConflictCount(cc?.count ?? 0);
        setMonthSummary(ms?.summary ?? null);
      }
    } catch (e) {
      console.error("[Dashboard] load error", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    load();
  }, [user]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!user) return null;

  const totalStock = holdings.reduce((a: number, h: any) => a + h.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO title="Dashboard – Inventory Tracker" description="Manage your book inventory, sales, and distributors." />

      {/* Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <p className="text-slate-900 font-bold text-sm leading-tight">Inventory Tracker</p>
              <p className="text-slate-400 text-xs">{roleLabel[user.role]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{user.name[0]}</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-slate-900 font-semibold text-sm">{user.name}</p>
              <p className="text-slate-400 text-xs">@{user.username}</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} color="#475569" className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
              title="Sign out"
            >
              <LogOut size={16} color="#475569" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-slate-900 text-2xl font-extrabold">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Here's what's happening with your inventory today.</p>
        </div>

        <ClientOnly fallback={<div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />}>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : isDistributor ? (
            <>
              {/* Balance hero */}
              <div className="rounded-3xl p-6 text-white" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", boxShadow: "0 8px 32px rgba(15,23,42,0.3)" }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-rose-400" />
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Outstanding Balance</span>
                    </div>
                    <p className="text-4xl font-extrabold">{inr(balance?.outstanding ?? 0)}</p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#f43f5e22" }}>
                    <Target size={22} color="#f43f5e" />
                  </div>
                </div>
                <div className="border-t border-slate-700 pt-4 flex gap-8">
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Debt Sales</p>
                    <p className="text-white text-xl font-extrabold mt-1">{inrK(balance?.debtTotal ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Remitted</p>
                    <p className="text-white text-xl font-extrabold mt-1">{inrK(balance?.remittedTotal ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Cash</p>
                    <p className="text-emerald-400 text-xl font-extrabold mt-1">{inrK(balance?.cashTotal ?? 0)}</p>
                  </div>
                </div>
              </div>

              {/* Distributor stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard label="Books Held" value={String(totalStock)} sub="copies on hand" icon={<Boxes size={20} color="#3b82f6" />} accent="#3b82f6" />
                <StatCard label="Cash Sales" value={inrK(balance?.cashTotal ?? 0)} sub="collected" icon={<Banknote size={20} color="#10b981" />} accent="#10b981" />
              </div>

              {/* Stock on hand */}
              <div>
                <h2 className="text-slate-900 text-base font-extrabold mb-4">My Stock on Hand</h2>
                {holdings.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <Boxes size={32} color="#94a3b8" className="mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No stock assigned yet</p>
                    <p className="text-slate-400 text-sm mt-1">Your manager will assign books to you soon.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {holdings.map((h: any) => (
                      <div key={h.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <BookOpen size={18} color="#d97706" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 font-semibold truncate">{h.title}</p>
                          <p className="text-slate-500 text-xs">{h.category} · {h.language}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-amber-600 text-xl font-extrabold">{h.quantity}</p>
                          <p className="text-slate-400 text-xs">copies</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Admin/Manager: month summary hero */}
              {monthSummary && (
                <div className="rounded-3xl p-6 text-white" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", boxShadow: "0 8px 32px rgba(15,23,42,0.3)" }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">This Month</span>
                      </div>
                      <p className="text-4xl font-extrabold">{inr(monthSummary.totalSalesValue)}</p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#f59e0b22" }}>
                      <BarChart3 size={22} color="#f59e0b" />
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-4 flex gap-8">
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Copies</p>
                      <p className="text-white text-xl font-extrabold mt-1">{monthSummary.totalCopies?.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Cash</p>
                      <p className="text-emerald-400 text-xl font-extrabold mt-1">{inrK(monthSummary.cashTotal)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Outstanding</p>
                      <p className="text-rose-400 text-xl font-extrabold mt-1">{inrK(monthSummary.outstanding)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Distributors" value={String(distributors.length)} sub="active accounts" icon={<Users size={20} color="#7c3aed" />} accent="#7c3aed" />
                <StatCard label="Low Stock Titles" value={String(lowStock.length)} sub="below threshold" icon={<AlertTriangle size={20} color="#f43f5e" />} accent="#f43f5e" />
                <StatCard label="Pending Conflicts" value={String(conflictCount)} sub="need review" icon={<Activity size={20} color="#f59e0b" />} accent="#f59e0b" />
              </div>

              {/* Low stock alert */}
              {lowStock.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
                      <AlertTriangle size={18} color="#f43f5e" />
                    </div>
                    <p className="text-rose-700 font-bold">{lowStock.length} title{lowStock.length === 1 ? "" : "s"} low on stock</p>
                  </div>
                  <div className="space-y-2">
                    {lowStock.slice(0, 5).map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between py-1">
                        <p className="text-slate-800 text-sm font-medium truncate flex-1">{b.title}</p>
                        <span className="text-rose-600 text-sm font-bold ml-4">{b.warehouseStock} left</span>
                      </div>
                    ))}
                    {lowStock.length > 5 && (
                      <p className="text-rose-500 text-xs font-medium">+{lowStock.length - 5} more below threshold</p>
                    )}
                  </div>
                </div>
              )}

              {/* Distributors list */}
              <div>
                <h2 className="text-slate-900 text-base font-extrabold mb-4 flex items-center gap-2">
                  <Users size={18} color="#0f172a" />
                  Distributors
                  {distributors.length > 0 && (
                    <span className="ml-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">{distributors.length} active</span>
                  )}
                </h2>
                {distributors.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <Users size={32} color="#94a3b8" className="mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No distributors yet</p>
                    <p className="text-slate-400 text-sm mt-1">Create distributor accounts from the mobile app.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {distributors.map((d: any) => (
                      <div key={d.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
                        <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-base">{d.name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 font-semibold">{d.name}</p>
                          <p className="text-slate-500 text-xs">@{d.username}{!d.active ? " · inactive" : ""}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${d.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {d.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </ClientOnly>
      </main>
    </div>
  );
}