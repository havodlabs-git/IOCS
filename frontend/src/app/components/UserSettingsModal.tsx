import { useState, useEffect, useCallback } from 'react';
import {
  X,
  User,
  Bell,
  Palette,
  Shield,
  Save,
  CheckCircle,
  LogOut,
  Moon,
  Sun,
  Monitor,
  ChevronRight,
  Globe,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { AuthData } from './AuthForm';
import { MfaSetupModal } from './MfaSetupModal';
import { getMfaStatus } from '@/app/services/api';

interface UserSettingsModalProps {
  auth: AuthData;
  onClose: () => void;
  onLogout: () => void;
  onUpdateSettings: (settings: UserSettings) => void;
  settings: UserSettings;
}

export interface UserSettings {
  displayName: string;
  theme: 'light' | 'dark' | 'system';
  notifyOnShare: boolean;
  notifyOnUpload: boolean;
  notifyOnExpiry: boolean;
  tablePageSize: number;
  defaultSeverityFilter: string;
  compactMode: boolean;
  showGlobalIocs: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  displayName: '',
  theme: 'light',
  notifyOnShare: true,
  notifyOnUpload: true,
  notifyOnExpiry: false,
  tablePageSize: 50,
  defaultSeverityFilter: '',
  compactMode: false,
  showGlobalIocs: true,
};

type Tab = 'profile' | 'appearance' | 'notifications' | 'security';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',       label: 'Perfil',          icon: <User className="w-4 h-4" /> },
  { id: 'appearance',    label: 'Aparência',        icon: <Palette className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notificações',     icon: <Bell className="w-4 h-4" /> },
  { id: 'security',      label: 'Segurança',        icon: <Shield className="w-4 h-4" /> },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

export function UserSettingsModal({ auth, onClose, onLogout, onUpdateSettings, settings }: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [form, setForm] = useState<UserSettings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const fetchMfaStatus = useCallback(async () => {
    try {
      const res = await getMfaStatus(auth.token);
      setMfaEnabled(res.mfaEnabled);
    } catch {
      setMfaEnabled(false);
    }
  }, [auth.token]);

  useEffect(() => {
    if (activeTab === 'security') fetchMfaStatus();
  }, [activeTab, fetchMfaStatus]);

  const initials = (form.displayName || auth.customerName)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    onUpdateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(auth.token).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  };

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl z-10 overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{form.displayName || auth.customerName}</p>
              <p className="text-xs text-slate-400 font-mono">{auth.customerId.slice(0, 12)}…</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-44 flex-shrink-0 bg-slate-50 border-r border-slate-100 py-3 flex flex-col">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && <ChevronRight className="w-3 h-3 ml-auto" />}
              </button>
            ))}

            <div className="flex-1" />

            {/* Logout */}
            <button
              onClick={onLogout}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors mx-2 rounded-lg"
            >
              <LogOut className="w-4 h-4" />Sair
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* PERFIL */}
            {activeTab === 'profile' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Informações do Perfil</h3>
                  <p className="text-xs text-slate-500">Personalize como o seu nome aparece na interface.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Nome de exibição</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => set('displayName', e.target.value)}
                    placeholder={auth.customerName}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400">Deixe em branco para usar o nome do registo.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Customer ID</label>
                  <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-500 select-all">
                    {auth.customerId}
                  </div>
                  <p className="text-xs text-slate-400">Identificador único — não pode ser alterado.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Itens por página (tabela de IOCs)</label>
                  <select
                    value={form.tablePageSize}
                    onChange={(e) => set('tablePageSize', Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {[25, 50, 100, 200].map((n) => (
                      <option key={n} value={n}>{n} itens</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Filtro de severidade padrão</label>
                  <select
                    value={form.defaultSeverityFilter}
                    onChange={(e) => set('defaultSeverityFilter', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Sem filtro (mostrar todos)</option>
                    <option value="Critical (9-10)">Critical (9-10)</option>
                    <option value="High (7-8)">High (7-8)</option>
                    <option value="Medium (4-6)">Medium (4-6)</option>
                    <option value="Low (1-3)">Low (1-3)</option>
                    <option value="Info (0)">Info (0)</option>
                  </select>
                </div>
              </div>
            )}

            {/* APARÊNCIA */}
            {activeTab === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Aparência</h3>
                  <p className="text-xs text-slate-500">Escolha o tema e o modo de visualização.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Tema</label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: 'light',  label: 'Claro',   icon: <Sun className="w-5 h-5" /> },
                      { value: 'dark',   label: 'Escuro',  icon: <Moon className="w-5 h-5" /> },
                      { value: 'system', label: 'Sistema', icon: <Monitor className="w-5 h-5" /> },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('theme', opt.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          form.theme === opt.value
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {opt.icon}
                        <span className="text-xs font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">O tema escuro e sistema serão aplicados em versão futura.</p>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Modo compacto</p>
                    <p className="text-xs text-slate-500 mt-0.5">Reduz o espaçamento da tabela de IOCs.</p>
                  </div>
                  <Toggle checked={form.compactMode} onChange={(v) => set('compactMode', v)} />
                </div>

                <div className="flex items-center justify-between py-3 border-t border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-purple-600" />
                      <p className="text-sm font-medium text-slate-700">IOCs Globais</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Inclui IOCs globais aprovados na listagem de Meus IOCs.</p>
                    {!form.showGlobalIocs && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">⚠ Apenas os seus IOCs privados estão visíveis.</p>
                    )}
                  </div>
                  <Toggle checked={form.showGlobalIocs} onChange={(v) => set('showGlobalIocs', v)} />
                </div>
              </div>
            )}

            {/* NOTIFICAÇÕES */}
            {activeTab === 'notifications' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Notificações</h3>
                  <p className="text-xs text-slate-500">Escolha quais eventos geram alertas na interface.</p>
                </div>

                {([
                  { key: 'notifyOnUpload' as const, label: 'Upload concluído', desc: 'Alerta ao terminar o upload de um ficheiro de IOCs.' },
                  { key: 'notifyOnShare'  as const, label: 'IOC compartilhado', desc: 'Alerta ao partilhar um IOC globalmente com sucesso.' },
                  { key: 'notifyOnExpiry' as const, label: 'Token a expirar',   desc: 'Aviso quando o token JWT estiver próximo de expirar.' },
                ]).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                    <Toggle checked={form[key] as boolean} onChange={(v) => set(key, v)} />
                  </div>
                ))}
              </div>
            )}

            {/* SEGURANÇA */}
            {activeTab === 'security' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Segurança</h3>
                  <p className="text-xs text-slate-500">Informações sobre a sua sessão atual.</p>
                </div>

                <div className="space-y-3">
                  {/* Informações de sessão */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estado da sessão</span>
                      <span className="flex items-center gap-1.5 text-green-700 font-medium">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Ativa
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Expiração do token</span>
                      <span className="text-slate-700 font-medium">24 horas após login</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tipo de autenticação</span>
                      <span className="text-slate-700 font-medium">JWT Bearer</span>
                    </div>
                  </div>

                  {/* Token de Acesso */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">Token de Acesso</p>
                      <span className="text-xs text-slate-400 font-mono">JWT Bearer</span>
                    </div>
                    <p className="text-xs text-slate-500">Use este token para autenticar chamadas directas à API.</p>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <code className="flex-1 text-xs font-mono text-slate-700 truncate">
                        {showToken ? auth.token : '•'.repeat(Math.min(auth.token.length, 48))}
                      </code>
                      <button
                        onClick={() => setShowToken((v) => !v)}
                        title={showToken ? 'Ocultar token' : 'Mostrar token'}
                        className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0 p-0.5"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleCopyToken}
                        title="Copiar token"
                        className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0 p-0.5"
                      >
                        {tokenCopied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    {tokenCopied && (
                      <p className="text-xs text-green-600 font-medium">Token copiado para a área de transferência.</p>
                    )}
                  </div>

                  {/* MFA */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Autenticação de Dois Fatores</p>
                        <p className="text-xs text-slate-500 mt-0.5">Microsoft Authenticator (TOTP)</p>
                      </div>
                      {mfaEnabled === null ? (
                        <span className="text-xs text-slate-400">A verificar…</span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {mfaEnabled ? 'Activo' : 'Inactivo'}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowMfaModal(true)}
                      className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                        mfaEnabled
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {mfaEnabled ? 'Desactivar MFA' : 'Activar MFA'}
                    </button>
                  </div>

                  <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />Terminar sessão
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400">As alterações são guardadas localmente.</p>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saved ? (
              <><CheckCircle className="w-4 h-4" />Guardado!</>
            ) : (
              <><Save className="w-4 h-4" />Guardar alterações</>
            )}
          </button>
        </div>
      </div>
    </div>

    {/* MFA Modal */}
    {showMfaModal && (
      <MfaSetupModal
        token={auth.token}
        mfaEnabled={mfaEnabled === true}
        onClose={() => setShowMfaModal(false)}
        onStatusChange={(enabled) => {
          setMfaEnabled(enabled);
          setShowMfaModal(false);
        }}
      />
    )}
    </>
  );
}
