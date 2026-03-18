import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Users, Globe, Clock, CheckCircle, XCircle,
  Trash2, RefreshCw, LogOut, ChevronRight, AlertTriangle,
  Activity, TrendingUp, Eye, EyeOff, Copy, Check
} from 'lucide-react';
import logo from '@/assets/logo-dark.png';
import {
  listPendingIocs, listApprovedGlobalIocs, approveIoc, rejectIoc,
  listGlobalIocs
} from '@/app/services/api';
import type { IocRecordWithCustomer } from '@/app/services/api';

// Admin-specific API calls
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

export interface CustomerRecord {
  id: string;
  name: string;
  createdAt: string;
  iocCount: number;
  pendingCount: number;
}

export interface AdminAuthData {
  adminKey: string;
}

type AdminPage = 'dashboard' | 'pending' | 'global' | 'customers';

const SEVERITY_COLORS: Record<number, string> = {
  1: 'bg-slate-100 text-slate-600',
  2: 'bg-slate-100 text-slate-600',
  3: 'bg-blue-100 text-blue-700',
  4: 'bg-blue-100 text-blue-700',
  5: 'bg-yellow-100 text-yellow-700',
  6: 'bg-yellow-100 text-yellow-700',
  7: 'bg-orange-100 text-orange-700',
  8: 'bg-orange-100 text-orange-700',
  9: 'bg-red-100 text-red-700',
  10: 'bg-red-100 text-red-700',
};

function SeverityBadge({ severity }: { severity: number | string }) {
  const s = Number(severity);
  const cls = SEVERITY_COLORS[s] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {s}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ip: 'bg-purple-100 text-purple-700',
    domain: 'bg-blue-100 text-blue-700',
    url: 'bg-cyan-100 text-cyan-700',
    hash: 'bg-amber-100 text-amber-700',
    email: 'bg-green-100 text-green-700',
  };
  const cls = colors[type?.toLowerCase()] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase ${cls}`}>
      {type}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="ml-1 text-slate-400 hover:text-slate-600 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

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

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
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
    } catch (e) {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleApprove = async (iocId: string) => {
    setActionLoading(iocId);
    try {
      await approveIoc(iocId, adminKey, 'Aprovado via painel admin');
      showToast('IOC aprovado com sucesso');
      await loadAll();
    } catch (e) {
      showToast('Erro ao aprovar IOC', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (iocId: string) => {
    setActionLoading(iocId + '_reject');
    try {
      await rejectIoc(iocId, adminKey, 'Rejeitado via painel admin');
      showToast('IOC rejeitado');
      await loadAll();
    } catch (e) {
      showToast('Erro ao rejeitar IOC', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteIoc = async (iocId: string) => {
    if (!confirm('Remover este IOC global?')) return;
    setActionLoading(iocId + '_del');
    try {
      await deleteGlobalIoc(iocId, adminKey);
      showToast('IOC removido');
      await loadAll();
    } catch (e) {
      showToast('Erro ao remover IOC', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCustomer = async (customerId: string, name: string) => {
    if (!confirm(`Remover o customer "${name}" e todos os seus IOCs?`)) return;
    setActionLoading(customerId + '_del');
    try {
      await deleteCustomer(customerId, adminKey);
      showToast(`Customer "${name}" removido`);
      await loadAll();
    } catch (e) {
      showToast('Erro ao remover customer', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const navItems: { id: AdminPage; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
    { id: 'pending', label: 'Pendentes', icon: <Clock className="w-4 h-4" />, badge: pending.length },
    { id: 'global', label: 'IOCs Globais', icon: <Globe className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src={logo} alt="MEO" className="h-7 w-auto" />
            <div>
              <p className="text-xs font-bold text-white tracking-wide">CWO · IOC Manager</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400 font-semibold">Admin</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                page === item.id
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${page === item.id ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>
                  {item.badge}
                </span>
              )}
              {page === item.id && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ))}
        </nav>

        {/* Admin Key + Logout */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="bg-slate-800 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500 mb-1">X-Admin-Key</p>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-slate-300 truncate flex-1">
                {showKey ? adminKey : '••••••••••••••••••••'}
              </span>
              <button onClick={() => setShowKey(v => !v)} className="text-slate-500 hover:text-slate-300">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <CopyButton text={adminKey} />
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg">
              {navItems.find(n => n.id === page)?.label}
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Painel de administração — Blue Team</p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        <div className="p-6">
          {/* ── DASHBOARD ── */}
          {page === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Customers', value: customers.length, icon: <Users className="w-5 h-5" />, color: 'text-blue-400', bg: 'bg-blue-900/30' },
                  { label: 'IOCs Globais', value: globalIocs.length, icon: <Globe className="w-5 h-5" />, color: 'text-green-400', bg: 'bg-green-900/30' },
                  { label: 'Pendentes', value: pending.length, icon: <Clock className="w-5 h-5" />, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
                  { label: 'Total IOCs', value: globalIocs.length + pending.length, icon: <TrendingUp className="w-5 h-5" />, color: 'text-purple-400', bg: 'bg-purple-900/30' },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-400 text-sm">{stat.label}</span>
                      <div className={`${stat.bg} ${stat.color} p-2 rounded-lg`}>{stat.icon}</div>
                    </div>
                    <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Pending quick list */}
              {pending.length > 0 && (
                <div className="bg-slate-900 border border-yellow-800/50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      IOCs Pendentes de Aprovação
                      <span className="bg-yellow-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
                    </h2>
                    <button onClick={() => setPage('pending')} className="text-yellow-400 hover:text-yellow-300 text-sm font-medium">
                      Ver todos →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {pending.slice(0, 5).map(ioc => (
                      <div key={ioc.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <TypeBadge type={ioc.type} />
                          <span className="text-white font-mono text-sm truncate">{ioc.value}</span>
                          {ioc.submittedByCustomerName && (
                            <span className="text-slate-500 text-xs hidden lg:block">por {ioc.submittedByCustomerName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <SeverityBadge severity={ioc.severity} />
                          <button
                            onClick={() => handleApprove(ioc.id)}
                            disabled={actionLoading === ioc.id}
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => handleReject(ioc.id)}
                            disabled={actionLoading === ioc.id + '_reject'}
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
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

              {/* Customers quick list */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    Customers Registados
                  </h2>
                  <button onClick={() => setPage('customers')} className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                    Ver todos →
                  </button>
                </div>
                <div className="space-y-2">
                  {customers.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium">{c.name}</p>
                        <p className="text-slate-500 text-xs font-mono truncate">{c.id}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <span className="text-slate-400 text-xs">{c.iocCount} IOCs</span>
                        {c.pendingCount > 0 && (
                          <span className="bg-yellow-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{c.pendingCount} pendentes</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PENDING ── */}
          {page === 'pending' && (
            <div className="space-y-4">
              {loading && <p className="text-slate-400 text-sm">A carregar...</p>}
              {!loading && pending.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-white font-semibold">Sem IOCs pendentes</p>
                  <p className="text-slate-400 text-sm mt-1">Todos os IOCs foram processados.</p>
                </div>
              )}
              {pending.map(ioc => (
                <div key={ioc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <TypeBadge type={ioc.type} />
                        <SeverityBadge severity={ioc.severity} />
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{ioc.status}</span>
                      </div>
                      <p className="text-white font-mono text-base font-semibold break-all">{ioc.value}</p>
                      {ioc.description && <p className="text-slate-400 text-sm mt-1">{ioc.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        {ioc.submittedByCustomerName && <span>Submetido por: <span className="text-slate-300">{ioc.submittedByCustomerName}</span></span>}
                        <span>Criado: {new Date(ioc.createdAt).toLocaleString('pt-PT')}</span>
                        {ioc.tags && ioc.tags.length > 0 && (
                          <span className="flex gap-1">{ioc.tags.map(t => <span key={t} className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{t}</span>)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(ioc.id)}
                        disabled={actionLoading === ioc.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleReject(ioc.id)}
                        disabled={actionLoading === ioc.id + '_reject'}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
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

          {/* ── GLOBAL IOCS ── */}
          {page === 'global' && (
            <div className="space-y-3">
              {loading && <p className="text-slate-400 text-sm">A carregar...</p>}
              {!loading && globalIocs.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
                  <Globe className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-white font-semibold">Sem IOCs globais</p>
                </div>
              )}
              {globalIocs.map(ioc => (
                <div key={ioc.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <TypeBadge type={ioc.type} />
                      <SeverityBadge severity={ioc.severity} />
                    </div>
                    <p className="text-white font-mono text-sm font-semibold break-all">{ioc.value}</p>
                    {ioc.description && <p className="text-slate-400 text-xs mt-0.5">{ioc.description}</p>}
                    <p className="text-slate-600 text-xs mt-1">{new Date(ioc.createdAt).toLocaleString('pt-PT')}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteIoc(ioc.id)}
                    disabled={actionLoading === ioc.id + '_del'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── CUSTOMERS ── */}
          {page === 'customers' && (
            <div className="space-y-3">
              {loading && <p className="text-slate-400 text-sm">A carregar...</p>}
              {!loading && customers.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-white font-semibold">Sem customers registados</p>
                </div>
              )}
              {customers.map(c => (
                <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold">{c.name}</p>
                      {c.pendingCount > 0 && (
                        <span className="bg-yellow-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{c.pendingCount} pendentes</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-slate-500 text-xs font-mono">{c.id}</p>
                      <CopyButton text={c.id} />
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                      <span>{c.iocCount} IOCs privados</span>
                      <span>Registado em {new Date(c.createdAt).toLocaleDateString('pt-PT')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCustomer(c.id, c.name)}
                    disabled={actionLoading === c.id + '_del'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
