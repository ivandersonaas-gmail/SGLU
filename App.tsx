
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { LiveInterface } from './components/LiveInterface';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { ProcessFormModal } from './components/ProcessFormModal';
import { ProcessDetails } from './components/ProcessDetails';
import { UserManagement } from './components/UserManagement';
import { LegislationPanel } from './components/LegislationPanel';
import { DocumentTemplates } from './components/DocumentTemplates';
import { AuditCockpit } from './components/AuditCockpit/AuditCockpit';
import { AppView, AgentMode, UserProfile, UserRole, Message } from './types';
import { ProcessService, ProjectParameterService } from './services/supabase';
import { AuthService } from './services/auth';
import { Loader2 } from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';

const AppContent: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [currentView, setView] = useState<AppView>(AppView.DASHBOARD);
  const [agentMode, setAgentMode] = useState<AgentMode>(AgentMode.LICENSING);

  // MODAL STATES
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  // Critical Fix: Separate Process ID from Modal Visibility to prevent race conditions
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [refreshDashboard, setRefreshDashboard] = useState(0);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  // NEW STATE: Audit Cockpit Data
  const [auditMarkdown, setAuditMarkdown] = useState<string>('');

  const { addToast } = useToast();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const currentSession = await AuthService.getSession();
      setSession(currentSession);
      if (currentSession?.user) {
        const profile = await AuthService.getUserProfile(currentSession.user.id);
        setUserProfile(profile);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    if (currentView === AppView.ADMIN_PANEL && userProfile && userProfile.role !== UserRole.ADMIN) {
      addToast("Acesso negado ao painel administrativo.", 'error');
      setView(AppView.DASHBOARD);
    }
  }, [currentView, userProfile]);

  const handleLogout = () => {
    setSession(null);
    setUserProfile(null);
    setChatMessages([]);
    addToast("Você saiu do sistema.", 'info');
  };

  // Função Crítica: Link Direto do Processo para o Chat
  // Agora gerencia o fechamento da modal explicitamente sem anular o ID
  const handleOpenChat = (processId: string) => {
    setSelectedProcessId(processId);   // Mantém o ID
    setIsDetailsModalOpen(false);      // Fecha a modal visualmente
    setView(AppView.CHAT);             // Muda a tela
    setAgentMode(AgentMode.LICENSING); // Garante modo correto
  };


  const handleOpenAudit = async (markdown: string) => {
    if (!selectedProcessId) return;

    // Show loading or toast?
    addToast("Processando auditoria...", "info");

    try {
      // 1. Dynamic Import/Use of Parser to avoid circular deps if any
      const { parseAuditMarkdown } = require('./utils/AuditParser'); // Or import at top if clean
      const parsed = parseAuditMarkdown(markdown);

      // 2. Get Current Params to avoid overwriting other matrices
      const existing = await ProjectParameterService.getParameters(selectedProcessId);
      const currentJson = existing?.audit_json || {};

      // 3. Merge
      const newJson = {
        ...currentJson,
        cockpit: parsed
      };

      // 4. Save
      await ProjectParameterService.upsertParameters({
        process_id: selectedProcessId,
        audit_json: newJson
      });

      addToast("Auditoria sincronizada com sucesso!", "success");
    } catch (e) {
      console.error("Erro ao sincronizar auditoria:", e);
      addToast("Erro ao sincronizar dados da auditoria.", "error");
    }

    // Restore Popup behavior:
    setIsDetailsModalOpen(true);
  };

  const handleProcessClick = (id: string) => {
    setSelectedProcessId(id);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    if (currentView !== AppView.CHAT) {
      setSelectedProcessId(null);
    }
  };

  const handleCreateProcess = async (data: any) => {
    try {
      // 1. Create Process in DB
      const newProcess: any = await ProcessService.create(
        { name: data.name, cpf: data.cpf, phone: data.phone, personType: data.personType },
        { type: data.type, address_work: data.address }
      );

      // 2. Handle Multiple File Uploads
      if (data.files && newProcess && newProcess.id) {
        const uploadQueue: Promise<any>[] = [];

        // Helper to add uploads to queue
        const queueFiles = (fileList: File[], type: string) => {
          if (fileList && Array.isArray(fileList)) {
            fileList.forEach(file => {
              uploadQueue.push(ProcessService.uploadDocument(newProcess.id, file, type));
            });
          }
        };

        queueFiles(data.files.personal, 'DOC_PESSOAL');
        queueFiles(data.files.project, 'PROJETO');
        queueFiles(data.files.technical, 'ART');

        // Execute all uploads
        if (uploadQueue.length > 0) {
          await Promise.all(uploadQueue);
        }
      }

      setRefreshDashboard(prev => prev + 1);
      if (currentView !== AppView.DASHBOARD) {
        setView(AppView.DASHBOARD);
      }
      addToast(`Processo #${newProcess.protocol_number} criado com sucesso!`, 'success');
    } catch (err: any) {
      console.error("Falha na criação:", err);
      let msg = "Erro desconhecido";
      if (err instanceof Error) msg = err.message;
      else if (typeof err === 'object') msg = JSON.stringify(err);
      else msg = String(err);
      addToast(msg, 'error');
    }
  };

  if (loadingAuth) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => { checkSession(); }} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      <div className="hidden md:flex h-full">
        <Sidebar
          currentView={currentView}
          setView={(view) => {
            if (view === AppView.PROTOCOL) {
              setIsFormModalOpen(true);
            } else {
              setView(view);
            }
          }}
          setAgentMode={(mode) => {
            if (mode !== agentMode) {
              setChatMessages([]);
              setAgentMode(mode);
            }
          }}
          userProfile={userProfile}
          onLogout={handleLogout}
        />
      </div>

      <main className="flex-1 flex flex-col h-full w-full relative">
        {currentView === AppView.DASHBOARD && (
          <Dashboard
            key={refreshDashboard}
            onProcessClick={handleProcessClick}
            userProfile={userProfile}
          />
        )}
        {currentView === AppView.LIVE && <LiveInterface />}
        {currentView === AppView.CHAT && (
          <ChatInterface
            mode={agentMode}
            messages={chatMessages}
            setMessages={setChatMessages}
            processId={selectedProcessId}
            onOpenAudit={handleOpenAudit}
          />
        )}
        {currentView === AppView.ADMIN_PANEL && <UserManagement userProfile={userProfile} />}
        {currentView === AppView.LEGISLATION && <LegislationPanel userProfile={userProfile} />}
        {currentView === AppView.DOC_TEMPLATES && <DocumentTemplates userProfile={userProfile} />}

        <ProcessFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSubmit={handleCreateProcess}
        />

        {isDetailsModalOpen && (
          <ProcessDetails
            processId={selectedProcessId}
            onClose={handleCloseDetails}
            onOpenChat={handleOpenChat}
          />
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
