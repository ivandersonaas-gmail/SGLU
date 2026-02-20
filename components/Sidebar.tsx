
import React from 'react';
import { AppView, AgentMode, UserProfile, UserRole } from '../types';
import { AuthService } from '../services/auth';
import { LayoutDashboard, FolderPlus, FileText, Mic, Users, LogOut, UserCircle, Database, BookOpen, PenTool, Bug } from 'lucide-react';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  setAgentMode: (mode: AgentMode) => void;
  userProfile: UserProfile | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, setAgentMode, userProfile, onLogout }) => {

  const handleLogout = async () => {
    await AuthService.signOut();
    onLogout();
  };

  const isAdmin = userProfile?.role === UserRole.ADMIN;
  const isProtocolo = userProfile?.role === UserRole.PROTOCOLO || isAdmin;
  const isLicenciamento = userProfile?.role === UserRole.LICENCIAMENTO || isAdmin;

  // Permite acesso à Biblioteca para Protocolo e Licenciamento (Leitura) e Admin (Escrita)
  const canViewLaws = isProtocolo || isLicenciamento;
  // Permite acesso aos Modelos de Documentos para Licenciamento e Admin
  const canEditTemplates = isLicenciamento || isAdmin;

  return (
    <div className="w-full md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
          <Database className="text-white" size={18} />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-white">SGLU</h1>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Prefeitura Municipal</p>
        </div>
      </div>

      <div className="px-4 mb-2 flex-1 overflow-y-auto">

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">Gestão</p>
        <nav className="space-y-1">
          <button
            onClick={() => setView(AppView.DASHBOARD)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                ${currentView === AppView.DASHBOARD
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          {isProtocolo && (
            <button
              onClick={() => { setView(AppView.PROTOCOL); }}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                  ${currentView === AppView.PROTOCOL
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
            >
              <FolderPlus size={18} />
              <span>Novo Processo</span>
            </button>
          )}
        </nav>

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Consultas & Auditoria</p>
        <nav className="space-y-1">
          {canViewLaws && (
            <button
              onClick={() => setView(AppView.LEGISLATION)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                    ${currentView === AppView.LEGISLATION
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
            >
              <BookOpen size={18} />
              <span>Biblioteca de Leis</span>
            </button>
          )}
        </nav>

        {isLicenciamento && (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Técnico</p>
            <nav className="space-y-1">
              <button
                onClick={() => { setView(AppView.CHAT); setAgentMode(AgentMode.LICENSING); }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                      ${currentView === AppView.CHAT
                    ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
              >
                <FileText size={18} />
                <span>Analista (Auditor IA)</span>
              </button>

              <button
                onClick={() => { setView(AppView.LIVE); }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                    ${currentView === AppView.LIVE
                    ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
              >
                <Mic size={18} />
                <span>Voz ao Vivo</span>
              </button>
            </nav>
          </>
        )}

        {/* ADMINISTRAÇÃO E CONFIGURAÇÃO */}
        {canEditTemplates && (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Administração</p>
            <nav className="space-y-1">
              {isAdmin && (
                <button
                  onClick={() => setView(AppView.ADMIN_PANEL)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                    ${currentView === AppView.ADMIN_PANEL
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                >
                  <Users size={18} />
                  <span>Gestão de Usuários</span>
                </button>
              )}

              <button
                onClick={() => setView(AppView.DOC_TEMPLATES)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                  ${currentView === AppView.DOC_TEMPLATES
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
              >
                <PenTool size={18} />
                <span>Modelos de Documentos</span>
              </button>

              <button
                onClick={() => setView(AppView.DEBUG_TEST)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                  ${currentView === AppView.DEBUG_TEST
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
              >
                <Bug size={18} />
                <span>Debug API</span>
              </button>
            </nav>
          </>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
            <UserCircle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{userProfile?.full_name || 'Usuário'}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{userProfile?.role?.toLowerCase() || 'Convidado'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-red-400 transition-colors text-xs font-medium">
          <LogOut size={14} /> Sair do Sistema
        </button>
      </div>
    </div>
  );
};
