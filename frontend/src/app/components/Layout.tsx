import { useState } from 'react';
import {
  LayoutDashboard,
  Upload,
  List,
  Key,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Menu,
  X,
  Settings,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import type { AuthData } from './AuthForm';
import { UserSettingsModal, DEFAULT_SETTINGS } from './UserSettingsModal';
import type { UserSettings } from './UserSettingsModal';

export type PageId = 'dashboard' | 'upload' | 'iocs' | 'apikey';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'upload',    label: 'Upload IOCs',  icon: <Upload className="w-5 h-5" /> },
  { id: 'iocs',      label: 'Meus IOCs',    icon: <List className="w-5 h-5" /> },
  { id: 'apikey',    label: 'Chave de API', icon: <Key className="w-5 h-5" /> },
];

interface LayoutProps {
  auth: AuthData;
  onLogout: () => void;
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
  settings?: UserSettings;
  onUpdateSettings?: (settings: UserSettings) => void;
}

export function Layout({ auth, onLogout, activePage, onNavigate, children, settings: externalSettings, onUpdateSettings: externalUpdateSettings }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem('cwo_user_settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS, displayName: auth.customerName };
    } catch {
      return { ...DEFAULT_SETTINGS, displayName: auth.customerName };
    }
  });

  // Usar settings externos (do App) se disponíveis, caso contrário usar locais
  const userSettings = externalSettings ?? localSettings;

  const displayName = userSettings.displayName || auth.customerName;

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleUpdateSettings = (settings: UserSettings) => {
    setLocalSettings(settings);
    try {
      localStorage.setItem('cwo_user_settings', JSON.stringify(settings));
    } catch { /* ignore */ }
    // Propagar para o App.tsx se callback disponível
    if (externalUpdateSettings) externalUpdateSettings(settings);
  };

  const handleLogout = () => {
    setShowSettings(false);
    onLogout();
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <UserSettingsModal
          auth={auth}
          onClose={() => setShowSettings(false)}
          onLogout={handleLogout}
          onUpdateSettings={handleUpdateSettings}
          settings={userSettings}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-30 h-full flex flex-col bg-slate-900 text-white transition-all duration-300
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo / Brand */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-700 ${collapsed ? 'justify-center' : ''}`}>
          <img
            src={logo}
            alt="MEO"
            className={`object-contain flex-shrink-0 ${collapsed ? 'h-7 w-auto' : 'h-8 w-auto'}`}
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm leading-tight text-white">CWO - IOC Manager</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                title={collapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User info + actions */}
        <div className="border-t border-slate-700 p-3 space-y-1">
          {/* Avatar + name — clicável para abrir configurações */}
          <button
            onClick={() => setShowSettings(true)}
            title={collapsed ? 'Configurações' : undefined}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors group ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                {initials || <User className="w-4 h-4" />}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-slate-800 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Settings className="w-2 h-2 text-slate-300" />
              </div>
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate font-mono">{auth.customerId.slice(0, 8)}…</p>
              </div>
            )}
            {!collapsed && (
              <Settings className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 flex-shrink-0 transition-colors" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            title={collapsed ? 'Sair' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full items-center justify-center text-white shadow-md transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-800">
              {NAV_ITEMS.find((n) => n.id === activePage)?.label}
            </h2>
          </div>
          {/* Avatar no header — clicável */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors group"
            title="Configurações do perfil"
          >
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                {initials || <User className="w-3 h-3" />}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <Settings className="w-1.5 h-1.5 text-slate-500" />
              </div>
            </div>
            <span className="hidden sm:block text-sm font-medium text-slate-700">{displayName}</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
