import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Users, Globe, Clock, CheckCircle, XCircle,
  Trash2, RefreshCw, LogOut, AlertTriangle,
  TrendingUp, Eye, EyeOff, Copy, Check,
  ChevronDown, LayoutDashboard, ListChecks, Database, UserCog,
  ArrowUpRight, Zap, Lock, Search, Filter, X
} from 'lucide-react';
import logoLight from '@/assets/logo.png';
import {
  listPendingIocs, listApprovedGlobalIocs, approveIoc, rejectIoc,
} from '@/app/services/api';
import type { IocRecordWithCustomer } from '@/app/services/api';

// ─── Admin-specific API calls ─────────────────────────────────────────────────

async function listCustomers(adminKey: string): Promise<{ total: number; data: CustomerRecord[] }> {
  const res = await fetch('/api/customer/list', {
    headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

async function deleteCustomer(id: string, adminKey: string): Promise<void> {
  const res = await fetch(`/api/customer/delete?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-key': adminKey }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
}

async function deleteGlobalIoc(id: string, adminKey: string): Promise<void> {
  const res = await fetch(`/api/IOCS/delete?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-key': adminKey }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerRecord {
  id: string;
  name: string;
  createdAt: string;
  iocCount: number;
  pendingCount: number;
}

type AdminPage = 'dashboard' | 'pending' | 'global' | 'customers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<number, string> = {
  1: 'Info', 2: 'Info', 3: 'Low', 4: 'Low',
  5: 'Medium', 6: 'Medium', 7: 'High', 8: 'High',
  9: 'Critical', 10: 'Critical'
};

function severityClass(s: number): string {
  if (s <= 2) return 'text-slate-400 bg-slate-800 border-slate-700';
  if (s <= 4) return 'text-sky-300 bg-sky-950 border-sky-800';
  if (s <= 6) return 'text-amber-300 bg-amber-950 border-amber-800';
  if (s <= 8) return 'text-orange-300 bg-orange-950 border-orange-800';
  return 'text-red-300 bg-red-950 border-red-800';
}

function SeverityBadge({ severity }: { severity: number | string }) {
  const s = Number(severity);
  const label = SEVERITY_LABEL[s] ?? String(s);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-wide ${severityClass(s)}`}>
      {s} · {label}
    </span>
  );
}

const TYPE_STYLE: Record<string, string> = {
  ip:     'text-violet-300 bg-violet-950 border-violet-800',
  domain: 'text-blue-300 bg-blue-950 border-blue-800',
  url:    'text-cyan-300 bg-cyan-950 border-cyan-800',
  hash:   'text-amber-300 bg-amber-950 border-amber-800',
  email:  'text-emerald-300 bg-emerald-950 border-emerald-800',
};

const IOC_TYPES = ['ip', 'domain', 'url', 'hash', 'email'];
const SEVERITY_GROUPS = [
  { label: 'Info (1-2)',     min: 1, max: 2 },
  { label: 'Low (3-4)',      min: 3, max: 4 },
  { label: 'Medium (5-6)',   min: 5, max: 6 },
  { label: 'High (7-8)',     min: 7, max: 8 },
  { label: 'Critical (9-10)',min: 9, max: 10 },
];

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_STYLE[type?.toLowerCase()] ?? 'text-slate-300 bg-slate-800 border-slate-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-widest uppercase ${cls}`}>
      {type}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-600">
        {icon}
      </div>
      <p className="text-slate-300 font-semibold text-base">{title}</p>
      {sub && <p className="text-slate-500 text-sm">{sub}</p>}
    </div>
  );
}

// ─── FilterBar component ──────────────────────────────────────────────────────

interface GlobalFilterState {
  search: string;
  type: string;
  severity: string;
}

interface CustomerFilterState {
  search: string;
}

interface IocByCustomerFilterState {
  search: string;
  type: string;
  severity: string;
  customerId: string;
}

function FilterBar({
  children,
  count,
  total,
  onReset,
}: {
  children: React.ReactNode;
  count: number;
  total: number;
  onReset: () => void;
}) {
  const filtered = count < total;
  return (
    <div className="rounded-xl border border-white/5 bg-[#0d1117] p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        {filtered && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors h-9"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
        <div className="ml-auto text-xs text-slate-500 self-center">
          {filtered
            ? <span><span className="text-white font-semibold">{count}</span> de {total} resultado{total !== 1 ? 's' : ''}</span>
            : <span><span className="text-white font-semibold">{total}</span> resultado{total !== 1 ? 's' : ''}</span>
          }
        </div>
      </div>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 min-w-[180px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Pesquisar…'}
        className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-white/25 focus:bg-white/8 transition-colors"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function SelectFilter({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 pl-7 pr-8 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-medium focus:outline-none focus:border-white/25 transition-colors appearance-none cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AdminPanelProps {
  adminKey: string;
  onLogout: () => void;
}

export function AdminPanel({ adminKey, onLogout }: AdminPanelProps) {
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [pending, setPending] = useState<IocRecordWithCustomer[]>([]);
  const [globalIocs, setGlobalIocs] = useState<IocRecordWithCustomer[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Filter states ──
  const [globalFilter, setGlobalFilter] = useState<GlobalFilterState>({ search: '', type: '', severity: '' });
  const [customerFilter, setCustomerFilter] = useState<CustomerFilterState>({ search: '' });
  const [iocByCustomerFilter, setIocByCustomerFilter] = useState<IocByCustomerFilterState>({
    search: '', type: '', severity: '', customerId: ''
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, g, c] = await Promise.all([
        listPendingIocs(adminKey),
        listApprovedGlobalIocs(adminKey),
        listCustomers(adminKey),
      ]);
      setPending(p.data ?? []);
      setGlobalIocs(g.data ?? []);
      setCustomers(c.data ?? []);
    } catch {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Filtered data ──

  const filteredGlobalIocs = useMemo(() => {
    return globalIocs.filter(ioc => {
      const q = globalFilter.search.toLowerCase();
      if (q && !ioc.value.toLowerCase().includes(q) && !(ioc.description ?? '').toLowerCase().includes(q)) return false;
      if (globalFilter.type && ioc.type?.toLowerCase() !== globalFilter.type) return false;
      if (globalFilter.severity) {
        const grp = SEVERITY_GROUPS.find(g => g.label === globalFilter.severity);
        if (grp && (Number(ioc.severity) < grp.min || Number(ioc.severity) > grp.max)) return false;
      }
      return true;
    });
  }, [globalIocs, globalFilter]);

  const filteredCustomers = useMemo(() => {
    const q = customerFilter.search.toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [customers, customerFilter]);

  // IOCs por cliente: todos os IOCs globais + pendentes filtrados por customer
  const allIocs = useMemo(() => [...globalIocs, ...pending], [globalIocs, pending]);

  const filteredIocsByCustomer = useMemo(() => {
    return allIocs.filter(ioc => {
      const q = iocByCustomerFilter.search.toLowerCase();
      if (q && !ioc.value.toLowerCase().includes(q) && !(ioc.description ?? '').toLowerCase().includes(q)) return false;
      if (iocByCustomerFilter.type && ioc.type?.toLowerCase() !== iocByCustomerFilter.type) return false;
      if (iocByCustomerFilter.severity) {
        const grp = SEVERITY_GROUPS.find(g => g.label === iocByCustomerFilter.severity);
        if (grp && (Number(ioc.severity) < grp.min || Number(ioc.severity) > grp.max)) return false;
      }
      if (iocByCustomerFilter.customerId && ioc.customerId !== iocByCustomerFilter.customerId) return false;
      return true;
    });
  }, [allIocs, iocByCustomerFilter]);

  const handleApprove = async (iocId: string) => {
    setActionLoading(iocId);
    try {
      await approveIoc(iocId, adminKey, 'Aprovado via painel admin');
      showToast('IOC aprovado com sucesso');
      await loadAll();
    } catch { showToast('Erro ao aprovar IOC', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (iocId: string) => {
    setActionLoading(iocId + '_r');
    try {
      await rejectIoc(iocId, adminKey, 'Rejeitado via painel admin');
      showToast('IOC rejeitado e devolvido ao customer');
      await loadAll();
    } catch { showToast('Erro ao rejeitar IOC', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleDeleteIoc = async (iocId: string) => {
    if (!confirm('Remover este IOC global permanentemente?')) return;
    setActionLoading(iocId + '_d');
    try {
      await deleteGlobalIoc(iocId, adminKey);
      showToast('IOC removido');
      await loadAll();
    } catch { showToast('Erro ao remover IOC', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Remover o customer "${name}" e todos os seus IOCs? Esta acção é irreversível.`)) return;
    setActionLoading(id + '_d');
    try {
      await deleteCustomer(id, adminKey);
      showToast(`Customer "${name}" removido`);
      await loadAll();
    } catch { showToast('Erro ao remover customer', 'error'); }
    finally { setActionLoading(null); }
  };

  // ── Nav items ──
  const nav: { id: AdminPage; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard',    icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'pending',   label: 'Pendentes',    icon: <ListChecks className="w-4 h-4" />, badge: pending.length },
    { id: 'global',    label: 'IOCs Globais', icon: <Database className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers',    icon: <UserCog className="w-4 h-4" /> },
  ];

  const pageTitle = nav.find(n => n.id === page)?.label ?? '';

  // Customer options for select
  const customerOptions = useMemo(() =>
    customers.map(c => ({ value: c.id, label: c.name })),
    [customers]
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] flex font-sans antialiased">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border transition-all
          ${toast.type === 'success'
            ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
            : 'bg-red-950 border-red-700 text-red-200'}`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-200 flex flex-col bg-[#0d1117] border-r border-white/5 flex-shrink-0`}>

        {/* Logo area */}
        <div className="h-16 flex items-center px-4 border-b border-white/5 gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src={logoLight} alt="MEO" className="h-5 w-auto object-contain" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold leading-tight truncate">CWO · IOC Manager</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Lock className="w-3 h-3 text-red-400" />
                <span className="text-red-400 text-[11px] font-bold tracking-wide uppercase">Blue Team Admin</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="ml-auto text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${sidebarOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(item => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative
                  ${active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
              >
                <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {!sidebarOpen && item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r-full" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 space-y-2">
          {sidebarOpen && (
            <div className="bg-white/5 rounded-lg px-3 py-2.5 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">X-Admin-Key</p>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono text-slate-400 truncate flex-1 select-all">
                  {showKey ? adminKey : '••••••••••••••••••••••••••••••••'}
                </span>
                <button onClick={() => setShowKey(v => !v)} className="p-1 text-slate-600 hover:text-slate-400 transition-colors">
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <CopyButton text={adminKey} />
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            title={!sidebarOpen ? 'Sair' : undefined}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span>Terminar sessão</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-16 bg-[#0d1117] border-b border-white/5 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-semibold text-base">{pageTitle}</h1>
            <p className="text-slate-500 text-xs">CWO · IOC Manager — Painel de Administração</p>
          </div>
          <div className="flex items-center gap-2">
            {pending.length > 0 && (
              <button
                onClick={() => setPage('pending')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                {pending.length} pendente{pending.length !== 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">

          {/* ════════════════════════════════════════
              DASHBOARD
          ════════════════════════════════════════ */}
          {page === 'dashboard' && (
            <div className="space-y-6 max-w-6xl">

              {/* Stat cards */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Customers', value: customers.length,
                    icon: <Users className="w-5 h-5" />,
                    color: 'text-blue-400', border: 'border-blue-500/20',
                    bg: 'bg-blue-500/5',
                  },
                  {
                    label: 'IOCs Globais', value: globalIocs.length,
                    icon: <Globe className="w-5 h-5" />,
                    color: 'text-emerald-400', border: 'border-emerald-500/20',
                    bg: 'bg-emerald-500/5',
                  },
                  {
                    label: 'Pendentes', value: pending.length,
                    icon: <Clock className="w-5 h-5" />,
                    color: pending.length > 0 ? 'text-amber-400' : 'text-slate-400',
                    border: pending.length > 0 ? 'border-amber-500/30' : 'border-white/5',
                    bg: pending.length > 0 ? 'bg-amber-500/5' : 'bg-white/2',
                  },
                  {
                    label: 'Total IOCs', value: globalIocs.length + pending.length,
                    icon: <TrendingUp className="w-5 h-5" />,
                    color: 'text-violet-400', border: 'border-violet-500/20',
                    bg: 'bg-violet-500/5',
                  },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-xl border ${stat.border} ${stat.bg} p-5 flex flex-col gap-3`}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{stat.label}</span>
                      <span className={`${stat.color} opacity-70`}>{stat.icon}</span>
                    </div>
                    <p className={`text-4xl font-bold ${stat.color} leading-none`}>{stat.value}</p>
                    {stat.label === 'Pendentes' && pending.length > 0 && (
                      <p className="text-amber-400 text-xs flex items-center gap-1">
                        <Zap className="w-3 h-3" />Requer atenção
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Pending quick view */}
              {pending.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/3 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-amber-500/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-white font-semibold text-sm">IOCs aguardando aprovação</span>
                      <span className="bg-amber-500/20 text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                        {pending.length}
                      </span>
                    </div>
                    <button onClick={() => setPage('pending')} className="text-amber-400 hover:text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors">
                      Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/5">
                    {pending.slice(0, 5).map(ioc => (
                      <div key={ioc.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <TypeBadge type={ioc.type} />
                          <span className="text-slate-200 font-mono text-sm truncate">{ioc.value}</span>
                          {ioc.submittedByCustomerName && (
                            <span className="text-slate-600 text-xs hidden lg:block">— {ioc.submittedByCustomerName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <SeverityBadge severity={ioc.severity} />
                          <button
                            onClick={() => handleApprove(ioc.id)}
                            disabled={actionLoading === ioc.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => handleReject(ioc.id)}
                            disabled={actionLoading === ioc.id + '_r'}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/40 text-xs font-semibold transition-colors disabled:opacity-40"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Rejeitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers quick view */}
              <div className="rounded-xl border border-white/5 bg-white/2 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <span className="text-white font-semibold text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    Customers registados
                  </span>
                  <button onClick={() => setPage('customers')} className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
                    Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {customers.length === 0
                  ? <p className="text-slate-500 text-sm px-5 py-6">Sem customers registados.</p>
                  : (
                    <div className="divide-y divide-white/5">
                      {customers.slice(0, 6).map(c => (
                        <div key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-slate-200 text-sm font-medium">{c.name}</p>
                              {c.pendingCount > 0 && (
                                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30">
                                  {c.pendingCount} pendente{c.pendingCount !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600 text-[11px] font-mono mt-0.5 truncate">{c.id}</p>
                          </div>
                          <span className="text-slate-500 text-xs flex-shrink-0 ml-4">{c.iocCount} IOCs</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              PENDING IOCs
          ════════════════════════════════════════ */}
          {page === 'pending' && (
            <div className="max-w-5xl space-y-3">
              {loading && <p className="text-slate-500 text-sm">A carregar…</p>}
              {!loading && pending.length === 0 && (
                <EmptyState
                  icon={<CheckCircle className="w-7 h-7" />}
                  title="Sem IOCs pendentes"
                  sub="Todos os IOCs foram processados."
                />
              )}
              {pending.map(ioc => (
                <div key={ioc.id} className="rounded-xl border border-white/5 bg-[#0d1117] hover:border-white/10 transition-colors overflow-hidden">
                  <div className="flex items-start gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2.5">
                        <TypeBadge type={ioc.type} />
                        <SeverityBadge severity={ioc.severity} />
                        <span className="text-[11px] text-slate-600 bg-white/5 border border-white/5 px-2 py-0.5 rounded-md uppercase tracking-wide font-semibold">
                          {ioc.status}
                        </span>
                      </div>
                      <p className="text-white font-mono text-base font-semibold break-all leading-snug">{ioc.value}</p>
                      {ioc.description && (
                        <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{ioc.description}</p>
                      )}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-600">
                        {ioc.submittedByCustomerName && (
                          <span>Submetido por <span className="text-slate-400 font-medium">{ioc.submittedByCustomerName}</span></span>
                        )}
                        <span>{new Date(ioc.createdAt).toLocaleString('pt-PT')}</span>
                        {ioc.tags && ioc.tags.length > 0 && (
                          <span className="flex gap-1.5">
                            {ioc.tags.map(t => (
                              <span key={t} className="bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-md text-[11px]">{t}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(ioc.id)}
                        disabled={actionLoading === ioc.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleReject(ioc.id)}
                        disabled={actionLoading === ioc.id + '_r'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/40 text-sm font-semibold transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        <XCircle className="w-4 h-4" />
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ════════════════════════════════════════
              GLOBAL IOCs — com filtros
          ════════════════════════════════════════ */}
          {page === 'global' && (
            <div className="max-w-5xl">
              {loading && <p className="text-slate-500 text-sm mb-4">A carregar…</p>}

              {/* Filter bar */}
              <FilterBar
                count={filteredGlobalIocs.length}
                total={globalIocs.length}
                onReset={() => setGlobalFilter({ search: '', type: '', severity: '' })}
              >
                <SearchInput
                  value={globalFilter.search}
                  onChange={v => setGlobalFilter(f => ({ ...f, search: v }))}
                  placeholder="Pesquisar valor ou descrição…"
                />
                <SelectFilter
                  value={globalFilter.type}
                  onChange={v => setGlobalFilter(f => ({ ...f, type: v }))}
                  placeholder="Todos os tipos"
                  options={IOC_TYPES.map(t => ({ value: t, label: t.toUpperCase() }))}
                />
                <SelectFilter
                  value={globalFilter.severity}
                  onChange={v => setGlobalFilter(f => ({ ...f, severity: v }))}
                  placeholder="Todas as severidades"
                  options={SEVERITY_GROUPS.map(g => ({ value: g.label, label: g.label }))}
                />
              </FilterBar>

              {/* Table */}
              <div className="space-y-2">
                {!loading && filteredGlobalIocs.length === 0 && (
                  <EmptyState
                    icon={<Globe className="w-7 h-7" />}
                    title={globalIocs.length === 0 ? 'Sem IOCs globais' : 'Nenhum resultado'}
                    sub={globalIocs.length === 0 ? 'Nenhum IOC foi aprovado ainda.' : 'Tente ajustar os filtros.'}
                  />
                )}
                {filteredGlobalIocs.length > 0 && (
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-[11px] text-slate-600 uppercase tracking-wider font-semibold">
                    <span>Tipo</span>
                    <span>Valor</span>
                    <span>Severidade</span>
                    <span>Data</span>
                    <span></span>
                  </div>
                )}
                {filteredGlobalIocs.map(ioc => (
                  <div key={ioc.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center rounded-xl border border-white/5 bg-[#0d1117] hover:border-white/10 px-4 py-3.5 transition-colors">
                    <TypeBadge type={ioc.type} />
                    <div className="min-w-0">
                      <p className="text-slate-200 font-mono text-sm font-semibold truncate">{ioc.value}</p>
                      {ioc.description && <p className="text-slate-600 text-xs mt-0.5 truncate">{ioc.description}</p>}
                    </div>
                    <SeverityBadge severity={ioc.severity} />
                    <span className="text-slate-600 text-xs whitespace-nowrap">{new Date(ioc.createdAt).toLocaleDateString('pt-PT')}</span>
                    <button
                      onClick={() => handleDeleteIoc(ioc.id)}
                      disabled={actionLoading === ioc.id + '_d'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-slate-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/40 text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              CUSTOMERS — com filtros + IOCs por cliente
          ════════════════════════════════════════ */}
          {page === 'customers' && (
            <div className="max-w-5xl space-y-6">

              {/* ── Secção Customers ── */}
              <div>
                <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Customers registados
                </h2>

                {loading && <p className="text-slate-500 text-sm mb-4">A carregar…</p>}

                <FilterBar
                  count={filteredCustomers.length}
                  total={customers.length}
                  onReset={() => setCustomerFilter({ search: '' })}
                >
                  <SearchInput
                    value={customerFilter.search}
                    onChange={v => setCustomerFilter({ search: v })}
                    placeholder="Pesquisar por nome ou ID…"
                  />
                </FilterBar>

                <div className="space-y-2">
                  {!loading && filteredCustomers.length === 0 && (
                    <EmptyState
                      icon={<Users className="w-7 h-7" />}
                      title={customers.length === 0 ? 'Sem customers' : 'Nenhum resultado'}
                      sub={customers.length === 0 ? 'Nenhum customer registado ainda.' : 'Tente ajustar a pesquisa.'}
                    />
                  )}
                  {filteredCustomers.length > 0 && (
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-[11px] text-slate-600 uppercase tracking-wider font-semibold">
                      <span>Customer</span>
                      <span>IOCs</span>
                      <span>Registado em</span>
                      <span></span>
                    </div>
                  )}
                  {filteredCustomers.map(c => (
                    <div key={c.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center rounded-xl border border-white/5 bg-[#0d1117] hover:border-white/10 px-4 py-4 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-slate-200 font-semibold text-sm">{c.name}</p>
                          {c.pendingCount > 0 && (
                            <span className="bg-amber-500/15 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/25">
                              {c.pendingCount} pendente{c.pendingCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="text-slate-600 text-[11px] font-mono truncate">{c.id}</p>
                          <CopyButton text={c.id} />
                        </div>
                      </div>
                      <span className="text-slate-400 text-sm font-semibold text-right">{c.iocCount}</span>
                      <span className="text-slate-600 text-xs whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString('pt-PT')}</span>
                      <button
                        onClick={() => handleDeleteCustomer(c.id, c.name)}
                        disabled={actionLoading === c.id + '_d'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-slate-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/40 text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Secção IOCs por Cliente ── */}
              <div>
                <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-violet-400" />
                  IOCs por cliente
                  <span className="text-slate-600 font-normal text-xs">(globais + pendentes)</span>
                </h2>

                <FilterBar
                  count={filteredIocsByCustomer.length}
                  total={allIocs.length}
                  onReset={() => setIocByCustomerFilter({ search: '', type: '', severity: '', customerId: '' })}
                >
                  <SearchInput
                    value={iocByCustomerFilter.search}
                    onChange={v => setIocByCustomerFilter(f => ({ ...f, search: v }))}
                    placeholder="Pesquisar valor ou descrição…"
                  />
                  <SelectFilter
                    value={iocByCustomerFilter.customerId}
                    onChange={v => setIocByCustomerFilter(f => ({ ...f, customerId: v }))}
                    placeholder="Todos os clientes"
                    options={customerOptions}
                  />
                  <SelectFilter
                    value={iocByCustomerFilter.type}
                    onChange={v => setIocByCustomerFilter(f => ({ ...f, type: v }))}
                    placeholder="Todos os tipos"
                    options={IOC_TYPES.map(t => ({ value: t, label: t.toUpperCase() }))}
                  />
                  <SelectFilter
                    value={iocByCustomerFilter.severity}
                    onChange={v => setIocByCustomerFilter(f => ({ ...f, severity: v }))}
                    placeholder="Todas as severidades"
                    options={SEVERITY_GROUPS.map(g => ({ value: g.label, label: g.label }))}
                  />
                </FilterBar>

                <div className="space-y-2">
                  {!loading && filteredIocsByCustomer.length === 0 && (
                    <EmptyState
                      icon={<Database className="w-7 h-7" />}
                      title={allIocs.length === 0 ? 'Sem IOCs' : 'Nenhum resultado'}
                      sub={allIocs.length === 0 ? 'Nenhum IOC disponível.' : 'Tente ajustar os filtros.'}
                    />
                  )}
                  {filteredIocsByCustomer.length > 0 && (
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-[11px] text-slate-600 uppercase tracking-wider font-semibold">
                      <span>Tipo</span>
                      <span>Valor / Cliente</span>
                      <span>Severidade</span>
                      <span>Estado</span>
                      <span>Data</span>
                    </div>
                  )}
                  {filteredIocsByCustomer.map(ioc => {
                    const owner = customers.find(c => c.id === ioc.customerId);
                    const isPending = ioc.approvalStatus === 'PENDING';
                    return (
                      <div key={ioc.id} className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center rounded-xl border px-4 py-3.5 transition-colors
                        ${isPending
                          ? 'border-amber-500/20 bg-amber-500/3 hover:border-amber-500/30'
                          : 'border-white/5 bg-[#0d1117] hover:border-white/10'}`}>
                        <TypeBadge type={ioc.type} />
                        <div className="min-w-0">
                          <p className="text-slate-200 font-mono text-sm font-semibold truncate">{ioc.value}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {owner && (
                              <span className="text-slate-600 text-[11px] truncate">
                                <span className="text-slate-500">{owner.name}</span>
                              </span>
                            )}
                            {ioc.description && (
                              <span className="text-slate-700 text-[11px] truncate hidden lg:block">{ioc.description}</span>
                            )}
                          </div>
                        </div>
                        <SeverityBadge severity={ioc.severity} />
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isPending
                            ? 'text-amber-300 bg-amber-950 border-amber-800'
                            : 'text-emerald-300 bg-emerald-950 border-emerald-800'
                        }`}>
                          {isPending ? 'Pendente' : 'Aprovado'}
                        </span>
                        <span className="text-slate-600 text-xs whitespace-nowrap">{new Date(ioc.createdAt).toLocaleDateString('pt-PT')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
