import { useState, useCallback } from 'react';
import {
  Search,
  X,
  Filter,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Shield,
  RefreshCw,
  AlertCircle,
  Share2,
  Globe,
  CheckCircle,
  Loader2,
  Plus,
  Download,
  Tag,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckSquare,
  Square,
  Minus,
} from 'lucide-react';
import { shareCustomerIoc, addCustomerIoc, updateCustomerIoc, deleteCustomerIoc } from '@/app/services/api';
import type { IocRecord } from '@/app/services/api';
import type { AuthData } from './AuthForm';
import type { UserSettings } from './UserSettingsModal';

interface IocListPageProps {
  iocs: IocRecord[];
  loading: boolean;
  onRefresh: () => void;
  auth: AuthData;
  settings?: UserSettings;
}

type SortField = 'type' | 'value' | 'severity' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helpers de severidade
// ---------------------------------------------------------------------------

function severityNum(s: unknown): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function severityLabel(s: unknown): string {
  const n = severityNum(s);
  if (n >= 9) return `Critical (${n})`;
  if (n >= 7) return `High (${n})`;
  if (n >= 4) return `Medium (${n})`;
  if (n >= 1) return `Low (${n})`;
  return `Info (${n})`;
}

function severityColor(s: unknown): string {
  const n = severityNum(s);
  if (n >= 9) return 'bg-red-100 text-red-800 border-red-300';
  if (n >= 7) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (n >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (n >= 1) return 'bg-blue-100 text-blue-800 border-blue-300';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function severityIcon(s: unknown) {
  const n = severityNum(s);
  if (n >= 7) return <AlertTriangle className="w-3 h-3" />;
  return <Shield className="w-3 h-3" />;
}

function statusColor(s: string) {
  switch (s?.toLowerCase()) {
    case 'active':   return 'bg-green-100 text-green-800';
    case 'inactive': return 'bg-slate-100 text-slate-600';
    default:         return 'bg-slate-100 text-slate-600';
  }
}

// ---------------------------------------------------------------------------
// Exportação CSV
// ---------------------------------------------------------------------------

function exportCSV(iocs: IocRecord[], filename = 'iocs-export.csv') {
  const headers = ['id', 'type', 'value', 'severity', 'severity_label', 'status', 'scope', 'description', 'tags', 'source', 'createdAt', 'updatedAt'];
  const rows = iocs.map((ioc) => [
    ioc.id,
    ioc.type,
    ioc.value,
    ioc.severity,
    severityLabel(ioc.severity),
    ioc.status ?? '',
    ioc.scope ?? '',
    (ioc.description ?? '').replace(/,/g, ';'),
    (ioc.tags ?? []).join(';'),
    (ioc.source ?? '').replace(/,/g, ';'),
    ioc.createdAt,
    ioc.updatedAt,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Modal de adição manual de IOC
// ---------------------------------------------------------------------------

const IOC_TYPES = ['ip', 'ipv6', 'domain', 'url', 'email', 'md5', 'sha1', 'sha256', 'unknown'];
const SEVERITY_OPTIONS = [
  { label: 'Info (0)',       value: 0 },
  { label: 'Low (2)',        value: 2 },
  { label: 'Medium (5)',     value: 5 },
  { label: 'High (8)',       value: 8 },
  { label: 'Critical (10)', value: 10 },
];

interface AddIocModalProps {
  auth: AuthData;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddIocModal({ auth, onSuccess, onCancel }: AddIocModalProps) {
  const [form, setForm] = useState({
    type: 'ip',
    value: '',
    severity: 5,
    status: 'active',
    description: '',
    source: '',
    tagsInput: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (field: string, val: unknown) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.value.trim()) { setError('O valor do IOC é obrigatório.'); return; }
    setSaving(true);
    setError('');
    try {
      const tags = form.tagsInput
        .split(/[,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      await addCustomerIoc({
        customerId: auth.customerId,
        type: form.type,
        value: form.value.trim(),
        severity: String(form.severity),
        status: form.status,
        description: form.description.trim(),
        source: form.source.trim(),
        tags,
      }, auth.token);
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (msg === 'DUPLICATE_IOC') setError('Este IOC já existe na sua base.');
      else setError(`Erro ao adicionar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (done) onSuccess();
    else onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!saving ? handleClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto">
        {!done ? (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2.5 rounded-xl">
                  <Plus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Adicionar IOC</h3>
                  <p className="text-xs text-slate-500">Preencha os campos para registar um novo IOC</p>
                </div>
              </div>
              <button type="button" onClick={handleClose} disabled={saving}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo <span className="text-red-500">*</span></label>
                  <select value={form.type} onChange={(e) => set('type', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {IOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Valor <span className="text-red-500">*</span></label>
                  <input type="text" value={form.value} onChange={(e) => set('value', e.target.value)}
                    placeholder="ex: 192.168.1.1, evil.com, hash..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Severidade</label>
                  <select value={form.severity} onChange={(e) => set('severity', Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Descrição</label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                  placeholder="Contexto sobre este IOC..." rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</span>
                  </label>
                  <input type="text" value={form.tagsInput} onChange={(e) => set('tagsInput', e.target.value)}
                    placeholder="malware, c2, phishing"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Source</label>
                  <input type="text" value={form.source} onChange={(e) => set('source', e.target.value)}
                    placeholder="SIEM, EDR, TI..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
              <button type="button" onClick={handleClose} disabled={saving}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-60">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : <><Plus className="w-4 h-4" />Adicionar IOC</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center py-10 px-6 text-center">
            <div className="mb-4">
              <div className="bg-green-100 p-4 rounded-full"><CheckCircle className="w-10 h-10 text-green-600" /></div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">IOC Adicionado!</h3>
            <p className="text-sm text-slate-500 mb-6">
              <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{form.value}</code> foi registado com sucesso.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setDone(false); setForm({ type: 'ip', value: '', severity: 5, status: 'active', description: '', source: '', tagsInput: '' }); }}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">Adicionar outro</button>
              <button onClick={handleClose}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de compartilhar IOC
// ---------------------------------------------------------------------------

interface ShareModalProps {
  ioc: IocRecord;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function ShareModal({ ioc, onConfirm, onCancel }: ShareModalProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await onConfirm();
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (msg === 'IOC_ALREADY_GLOBAL') setError('Este IOC já está disponível globalmente.');
      else if (msg === 'IOC_ALREADY_PENDING_APPROVAL') setError('Este IOC já está pendente de aprovação pelo Blue Team.');
      else setError(`Erro ao compartilhar: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!loading ? onCancel : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10">
        {!done ? (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2.5 rounded-xl"><Share2 className="w-5 h-5 text-blue-600" /></div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Compartilhar IOC</h3>
                <p className="text-xs text-slate-500">O IOC será submetido ao escopo global para aprovação</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Tipo</span><span className="font-medium">{ioc.type}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Valor</span><code className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-slate-200">{ioc.value}</code></div>
              <div className="flex justify-between"><span className="text-slate-500">Severidade</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor(ioc.severity)}`}>{severityLabel(ioc.severity)}</span></div>
            </div>
            {error && <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="flex gap-3 justify-end">
              <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleConfirm} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Compartilhando...</> : <><Share2 className="w-4 h-4" />Confirmar</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 px-6 text-center">
            <div className="bg-amber-100 p-4 rounded-full mb-4">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Aguardando Aprovação</h3>
            <p className="text-sm text-slate-500 mb-2">
              <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{ioc.value}</code>
            </p>
            <p className="text-sm text-slate-500 mb-6">
              O IOC foi submetido e está <strong className="text-amber-600">pendente de aprovação</strong> pela equipa Blue Team da MEO antes de ficar disponível globalmente.
            </p>
            <button onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de confirmação de bulk action
// ---------------------------------------------------------------------------

interface BulkConfirmModalProps {
  action: 'delete' | 'activate' | 'deactivate';
  count: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function BulkConfirmModal({ action, count, onConfirm, onCancel }: BulkConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const meta = {
    delete:     { icon: <Trash2 className="w-5 h-5 text-red-600" />,    bg: 'bg-red-100',    label: 'Excluir',      btnClass: 'bg-red-600 hover:bg-red-700',    msg: `${count} IOC(s) serão excluídos permanentemente.` },
    activate:   { icon: <ToggleRight className="w-5 h-5 text-green-600" />, bg: 'bg-green-100', label: 'Ativar',    btnClass: 'bg-green-600 hover:bg-green-700', msg: `${count} IOC(s) serão marcados como active.` },
    deactivate: { icon: <ToggleLeft className="w-5 h-5 text-slate-600" />,  bg: 'bg-slate-100', label: 'Desativar', btnClass: 'bg-slate-600 hover:bg-slate-700', msg: `${count} IOC(s) serão marcados como inactive.` },
  }[action];

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); setDone(true); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!loading ? onCancel : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6">
        {!done ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className={`${meta.bg} p-2.5 rounded-xl`}>{meta.icon}</div>
              <div>
                <h3 className="text-base font-bold text-slate-800">{meta.label} {count} IOC(s)</h3>
                <p className="text-xs text-slate-500">Esta ação será aplicada imediatamente</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5 bg-slate-50 rounded-lg p-3">{meta.msg}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleConfirm} disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium text-white ${meta.btnClass} rounded-lg transition-colors disabled:opacity-60`}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</> : <>{meta.label}</>}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-4 text-center">
            <div className={`${meta.bg} p-4 rounded-full mb-3`}><CheckCircle className="w-8 h-8 text-green-600" /></div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Concluído!</h3>
            <p className="text-sm text-slate-500 mb-4">{count} IOC(s) processados com sucesso.</p>
            <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IocListPage
// ---------------------------------------------------------------------------

export function IocListPage({ iocs, loading, onRefresh, auth, settings }: IocListPageProps) {
  const showGlobal = settings?.showGlobalIocs !== false;
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sharingIoc, setSharingIoc] = useState<IocRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Seleção
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'delete' | 'activate' | 'deactivate' | null>(null);

  // Ações individuais em progresso
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Aplicar preferência de visibilidade de IOCs globais
  const visibleIocs = showGlobal ? iocs : iocs.filter((ioc) => ioc.scope !== 'GLOBAL');

  const types    = Array.from(new Set(visibleIocs.map((i) => i.type))).sort();
  const statuses = Array.from(new Set(visibleIocs.map((i) => i.status ?? ''))).filter(Boolean).sort();
  const scopes   = Array.from(new Set(visibleIocs.map((i) => i.scope ?? ''))).filter(Boolean).sort();

  const severityBuckets = [
    { label: 'Critical (9-10)', min: 9, max: 10 },
    { label: 'High (7-8)',      min: 7, max: 8 },
    { label: 'Medium (4-6)',    min: 4, max: 6 },
    { label: 'Low (1-3)',       min: 1, max: 3 },
    { label: 'Info (0)',        min: 0, max: 0 },
  ];

  const filtered = visibleIocs
    .filter((ioc) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        ioc.value.toLowerCase().includes(q) ||
        ioc.type.toLowerCase().includes(q) ||
        (ioc.description ?? '').toLowerCase().includes(q) ||
        (ioc.source ?? '').toLowerCase().includes(q) ||
        (ioc.tags ?? []).some((t) => t.toLowerCase().includes(q));
      const matchType   = !filterType   || ioc.type   === filterType;
      const matchStatus = !filterStatus || ioc.status  === filterStatus;
      const matchScope  = !filterScope  || ioc.scope   === filterScope;
      let matchSeverity = true;
      if (filterSeverity) {
        const bucket = severityBuckets.find((b) => b.label === filterSeverity);
        if (bucket) { const n = severityNum(ioc.severity); matchSeverity = n >= bucket.min && n <= bucket.max; }
      }
      return matchSearch && matchType && matchSeverity && matchStatus && matchScope;
    })
    .sort((a, b) => {
      let va: string, vb: string;
      if (sortField === 'severity') {
        va = String(severityNum(a.severity)).padStart(3, '0');
        vb = String(severityNum(b.severity)).padStart(3, '0');
      } else {
        va = String((a as Record<string, unknown>)[sortField] ?? '');
        vb = String((b as Record<string, unknown>)[sortField] ?? '');
      }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  // Apenas IOCs CUSTOMER podem ser selecionados (GLOBAL não pode ser editado)
  const selectableIds = filtered.filter((i) => i.scope === 'CUSTOMER').map((i) => i.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selectableIds.some((id) => selected.has(id));
  const selectedCount = Array.from(selected).filter((id) => selectableIds.includes(id)).length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected((prev) => { const s = new Set(prev); selectableIds.forEach((id) => s.delete(id)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); selectableIds.forEach((id) => s.add(id)); return s; });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const clearSelection = () => setSelected(new Set());

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  const hasFilters = search || filterType || filterSeverity || filterStatus || filterScope;
  const clearFilters = () => { setSearch(''); setFilterType(''); setFilterSeverity(''); setFilterStatus(''); setFilterScope(''); };

  const handleShareConfirm = async () => {
    if (!sharingIoc) return;
    await shareCustomerIoc(auth.customerId, sharingIoc.id, auth.token);
    onRefresh();
  };

  const handleExportCSV = () => {
    const date = new Date().toISOString().slice(0, 10);
    exportCSV(filtered, `iocs-${date}.csv`);
  };

  // Ação individual: toggle status
  const handleToggleStatus = useCallback(async (ioc: IocRecord) => {
    setTogglingId(ioc.id);
    try {
      const newStatus = ioc.status === 'active' ? 'inactive' : 'active';
      await updateCustomerIoc(auth.customerId, ioc.id, { status: newStatus }, auth.token);
      onRefresh();
    } finally {
      setTogglingId(null);
    }
  }, [auth, onRefresh]);

  // Bulk actions
  const handleBulkConfirm = async () => {
    const ids = Array.from(selected).filter((id) => selectableIds.includes(id));
    if (bulkAction === 'delete') {
      await Promise.allSettled(ids.map((id) => deleteCustomerIoc(auth.customerId, id, auth.token)));
    } else if (bulkAction === 'activate') {
      await Promise.allSettled(ids.map((id) => updateCustomerIoc(auth.customerId, id, { status: 'active' }, auth.token)));
    } else if (bulkAction === 'deactivate') {
      await Promise.allSettled(ids.map((id) => updateCustomerIoc(auth.customerId, id, { status: 'inactive' }, auth.token)));
    }
    clearSelection();
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Modals */}
      {sharingIoc && (
        <ShareModal ioc={sharingIoc} onConfirm={handleShareConfirm} onCancel={() => setSharingIoc(null)} />
      )}
      {showAddModal && (
        <AddIocModal
          auth={auth}
          onSuccess={() => { setShowAddModal(false); onRefresh(); }}
          onCancel={() => setShowAddModal(false)}
        />
      )}
      {bulkAction && (
        <BulkConfirmModal
          action={bulkAction}
          count={selectedCount}
          onConfirm={handleBulkConfirm}
          onCancel={() => setBulkAction(null)}
        />
      )}

      {/* Banner: IOCs globais desactivados */}
      {!showGlobal && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Globe className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Os <strong>IOCs globais</strong> estão ocultos. Ative-os em <strong>Configurações → Aparência</strong> para os ver.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Meus IOCs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Carregando...' : `${filtered.length} de ${visibleIocs.length} IOC(s)${!showGlobal ? ' (globais ocultos)' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} disabled={filtered.length === 0}
            title="Exportar IOCs filtrados em CSV"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" />Exportar CSV
          </button>
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 bg-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm">
            <Plus className="w-4 h-4" />Adicionar IOC
          </button>
        </div>
      </div>

      {/* Barra de Bulk Actions — aparece quando há seleção */}
      {someSelected && selectedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-md flex-wrap">
          <div className="flex items-center gap-2 font-medium text-sm">
            <CheckSquare className="w-4 h-4" />
            <span>{selectedCount} IOC(s) selecionado(s)</span>
          </div>
          <div className="flex-1" />
          <button onClick={() => setBulkAction('activate')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-400 text-white rounded-lg transition-colors">
            <ToggleRight className="w-3.5 h-3.5" />Ativar
          </button>
          <button onClick={() => setBulkAction('deactivate')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-500 hover:bg-slate-400 text-white rounded-lg transition-colors">
            <ToggleLeft className="w-3.5 h-3.5" />Desativar
          </button>
          <button onClick={() => setBulkAction('delete')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />Excluir
          </button>
          <button onClick={clearSelection}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-200 hover:text-white hover:bg-blue-500 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5" />Limpar seleção
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Pesquisar valor, tipo, descrição, tags..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {[
            { value: filterType,   setter: setFilterType,   options: types,    placeholder: 'Tipo' },
            { value: filterStatus, setter: setFilterStatus, options: statuses, placeholder: 'Status' },
            { value: filterScope,  setter: setFilterScope,  options: scopes,   placeholder: 'Escopo' },
          ].map(({ value, setter, options, placeholder }) => (
            <div key={placeholder} className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select value={value} onChange={(e) => setter(e.target.value)}
                className="pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer">
                <option value="">Todos {placeholder}s</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
              className="pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer">
              <option value="">Todas Severidades</option>
              {severityBuckets.map((b) => <option key={b.label} value={b.label}>{b.label}</option>)}
            </select>
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200">
              <X className="w-3 h-3" />Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" /><span>Carregando IOCs...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <AlertCircle className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhum IOC encontrado</p>
              {hasFilters && <button onClick={clearFilters} className="mt-2 text-xs text-blue-500 hover:underline">Limpar filtros</button>}
              {!hasFilters && (
                <button onClick={() => setShowAddModal(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />Adicionar primeiro IOC
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr>
                  {/* Checkbox "selecionar todos" */}
                  <th className="px-3 py-3 w-10">
                    <button onClick={toggleSelectAll} title={allSelected ? 'Desselecionar todos' : 'Selecionar todos'}
                      className="flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors">
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-blue-600" />
                        : someSelected
                          ? <Minus className="w-4 h-4 text-blue-400" />
                          : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  {([
                    { label: 'Tipo',       field: 'type'      as SortField },
                    { label: 'Valor',      field: 'value'     as SortField },
                    { label: 'Severidade', field: 'severity'  as SortField },
                    { label: 'Status',     field: 'status'    as SortField },
                    { label: 'Criado em',  field: 'createdAt' as SortField },
                  ]).map(({ label, field }) => (
                    <th key={field} onClick={() => toggleSort(field)}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap">
                      <span className="flex items-center gap-1">{label}<SortIcon field={field} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Descrição / Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Escopo</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((ioc, idx) => {
                  const isCustomer = ioc.scope === 'CUSTOMER';
                  const isSelected = selected.has(ioc.id);
                  const isToggling = togglingId === ioc.id;
                  const isActive = ioc.status === 'active';

                  return (
                    <tr key={ioc.id}
                      className={`transition-colors ${isSelected ? 'bg-blue-50 hover:bg-blue-100/60' : idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/50 hover:bg-blue-50/40'}`}>
                      {/* Checkbox individual */}
                      <td className="px-3 py-3 w-10">
                        {isCustomer ? (
                          <button onClick={() => toggleSelect(ioc.id)}
                            className="flex items-center justify-center text-slate-300 hover:text-blue-600 transition-colors">
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 text-blue-600" />
                              : <Square className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="block w-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{ioc.type}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <code className="text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono break-all">{ioc.value}</code>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${severityColor(ioc.severity)}`}>
                          {severityIcon(ioc.severity)}{severityLabel(ioc.severity)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(ioc.status ?? '')}`}>{ioc.status ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                        {ioc.createdAt ? new Date(ioc.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {ioc.description && <p className="text-xs text-slate-600 truncate mb-1">{ioc.description}</p>}
                        {ioc.tags && ioc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ioc.tags.map((tag) => <span key={tag} className="px-1.5 py-0.5 text-xs rounded bg-blue-50 text-blue-700 border border-blue-100">{tag}</span>)}
                          </div>
                        )}
                        {!ioc.description && (!ioc.tags || ioc.tags.length === 0) && <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ioc.scope === 'GLOBAL' && ioc.approvalStatus === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300">
                            <Loader2 className="w-3 h-3 animate-spin" />Pendente Aprovação
                          </span>
                        ) : ioc.scope === 'GLOBAL' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            <Globe className="w-3 h-3" />Global
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                            Privado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isCustomer ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Toggle ativar/desativar individual */}
                            <button
                              onClick={() => handleToggleStatus(ioc)}
                              disabled={isToggling}
                              title={isActive ? 'Desativar IOC' : 'Ativar IOC'}
                              className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 disabled:opacity-50 ${
                                isActive
                                  ? 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200'
                                  : 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200'
                              }`}>
                              {isToggling
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : isActive
                                  ? <ToggleLeft className="w-3.5 h-3.5" />
                                  : <ToggleRight className="w-3.5 h-3.5" />}
                              {isActive ? 'Desativar' : 'Ativar'}
                            </button>
                            {/* Compartilhar */}
                            <button onClick={() => setSharingIoc(ioc)} title="Compartilhar globalmente"
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 rounded-lg transition-all duration-150">
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : ioc.approvalStatus === 'PENDING' ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-amber-600 font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />Pendente
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1 text-xs text-purple-500 font-medium">
                            <Globe className="w-3.5 h-3.5" />Global
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
            <span>
              Exibindo <strong>{filtered.length}</strong> de <strong>{iocs.length}</strong> IOC(s)
              {selectedCount > 0 && <span className="ml-2 text-blue-600 font-semibold">· {selectedCount} selecionado(s)</span>}
            </span>
            <span>Ordenado por: <strong>{sortField}</strong> ({sortDir === 'asc' ? '↑' : '↓'})</span>
          </div>
        )}
      </div>
    </div>
  );
}
