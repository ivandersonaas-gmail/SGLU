
import React, { useEffect, useState } from 'react';
import { Process, UserProfile, UserRole } from '../types';
import { ProcessService, isSupabaseConfigured, supabase, AdminService } from '../services/supabase';
import { Loader2, AlertCircle, Search, LayoutList, LayoutGrid, UserCheck, Download, BarChart3, CheckCircle2, AlertTriangle, Users, FilePlus, Clock, MapPin, ArrowRight, PenTool, Trash2 } from 'lucide-react';
import { useToast } from './Toast';
import { Tooltip } from './Tooltip';

interface DashboardProps {
    onProcessClick: (id: string) => void;
    userProfile: UserProfile | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ onProcessClick, userProfile }) => {
    const [processes, setProcesses] = useState<Process[]>([]);
    const [analysts, setAnalysts] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const ITEMS_PER_PAGE = 20;

    const { addToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [adminFilter, setAdminFilter] = useState<string | null>(null);

    const isAdmin = userProfile?.role === UserRole.ADMIN;

    const loadData = async (page = 1) => {
        if (!isSupabaseConfigured()) {
            setLoading(false);
            return;
        }
        try {
            // Não seta loading para true se já tiver dados (refresh silencioso)
            if (processes.length === 0) setLoading(true);

            // 1. Load Processes (Paginated)
            const { data, count } = await ProcessService.getAll(page, ITEMS_PER_PAGE);
            setProcesses(data as Process[]);
            setTotalItems(count);
            setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));

            // 2. Se for Admin, carrega a lista de analistas para o gráfico funcionar
            if (isAdmin && analysts.length === 0) { // Otimização: Só carrega uma vez
                const users = await AdminService.listAllUsers();
                // Filtra apenas quem é do setor de Licenciamento para o gráfico de carga
                setAnalysts(users.filter(u => u.role === UserRole.LICENCIAMENTO || u.role === UserRole.ADMIN));
            }

        } catch (err: any) {
            console.error(err);
            // Não mostra toast em refresh automático para não spamar
            if (processes.length === 0) addToast("Erro ao carregar dados: " + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Carrega dados ao montar ou mudar perfil/página
        loadData(currentPage);

        if (!isSupabaseConfigured()) return;

        // Realtime Expanded: Escuta Processos, Perfis (Analistas) e Requerentes
        const channel = supabase
            .channel('dashboard-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'processes' }, () => loadData(currentPage))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadData(currentPage))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'applicants' }, () => loadData(currentPage))
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userProfile, currentPage]);

    const handleAssignToMe = async (e: React.MouseEvent, processId: string) => {
        e.stopPropagation();
        if (!userProfile) return;

        // Optimistic Update
        setProcesses(prev => prev.map(p => {
            if (p.id === processId) {
                return {
                    ...p,
                    analyst_id: userProfile.id,
                    status: 'EM_ANALISE',
                    current_sector: 'LICENCIAMENTO',
                    analyst_profile: userProfile // Atualiza visualmente na hora
                };
            }
            return p;
        }));

        try {
            await ProcessService.assignProcess(processId, userProfile.id);
            addToast("Processo atribuído à sua mesa.", 'success');
        } catch (e: any) {
            addToast("Erro ao puxar processo: " + e.message, 'error');
            loadData();
        }
    };

    const handleDeleteProcess = async (e: React.MouseEvent, processId: string) => {
        e.stopPropagation();
        if (!isAdmin) return;
        if (!window.confirm("⚠️ ATENÇÃO: Isso apagará o processo E TODOS OS SEUS DOCUMENTOS/HISTÓRICO permanentemente. Deseja continuar?")) return;

        try {
            setLoading(true); // Mostra loading global brevemente
            await ProcessService.deleteProcess(processId);
            addToast("Processo e dados relacionados excluídos.", 'success');
            setProcesses(prev => prev.filter(p => p.id !== processId)); // Remove visualmente
        } catch (e: any) {
            addToast("Erro ao excluir: " + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filtro de Texto e Admin
    const filteredProcesses = processes.filter(p => {
        if (!p || !p.applicants) return false;
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            (p.applicants.name && p.applicants.name.toLowerCase().includes(term)) ||
            p.protocol_number.toString().includes(term) ||
            (p.applicants.cpf && p.applicants.cpf.includes(term))
        );

        if (!matchesSearch) return false;

        if (isAdmin && adminFilter === 'SIGNATURE') {
            return p.status === 'AGUARDANDO_ASSINATURA';
        }

        return true;
    });

    if (!isSupabaseConfigured()) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <AlertCircle size={48} className="text-amber-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Configuração Necessária</h2>
                <p className="text-slate-400 max-w-md">Configure as chaves no arquivo services/supabase.ts</p>
            </div>
        );
    }

    if (loading && processes.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    // --- ROLES LOGIC ---
    const isLicenciamento = userProfile?.role === UserRole.LICENCIAMENTO;
    const isFiscalizacao = userProfile?.role === UserRole.FISCALIZACAO;
    const isProtocolo = userProfile?.role === UserRole.PROTOCOLO || (!isAdmin && !isLicenciamento && !isFiscalizacao);

    // --- ADMIN CALCULATIONS ---
    const stats = {
        total: processes.length,
        delayed: processes.filter(p => {
            const diffTime = Math.abs(Date.now() - new Date(p.created_at!).getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) > 15 && p.status !== 'FINALIZADO';
        }).length,
        active: processes.filter(p => p.status === 'EM_ANALISE').length,
        finished: processes.filter(p => p.status === 'FINALIZADO').length,
        signature: processes.filter(p => p.status === 'AGUARDANDO_ASSINATURA').length
    };

    // --- PROTOCOLO CALCULATIONS ---
    const todayStr = new Date().toLocaleDateString();
    const createdToday = processes.filter(p => new Date(p.created_at!).toLocaleDateString() === todayStr).length;

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            {/* HEADER */}
            <div className={`h-auto min-h-[4rem] border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-4 gap-4
          ${isAdmin ? 'bg-purple-950/20' : isProtocolo ? 'bg-blue-950/20' : 'bg-amber-950/20'}`}>
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAdmin ? 'bg-purple-600' : isProtocolo ? 'bg-blue-600' : 'bg-amber-600'}`}>
                            {isAdmin ? <BarChart3 size={18} /> : isProtocolo ? <LayoutList size={18} /> : <UserCheck size={18} />}
                        </div>
                        {isAdmin ? 'Torre de Controle' : isProtocolo ? 'Painel Protocolo' : 'Mesa de Análise'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 ml-10 flex items-center gap-2">
                        <span>{isAdmin ? 'Visão Geral do Gestor' : isProtocolo ? 'Registro de Entrada e Consulta' : 'Gestão Técnica'}</span>
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] uppercase border border-slate-700 text-slate-500">
                            {userProfile?.role}
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {isAdmin && (
                        <Tooltip text="Filtrar: Aguardando Assinatura">
                            <button
                                onClick={() => setAdminFilter(adminFilter === 'SIGNATURE' ? null : 'SIGNATURE')}
                                className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${adminFilter === 'SIGNATURE' ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-purple-400'}`}
                            >
                                <PenTool size={16} />
                                <span className="text-xs font-bold hidden md:inline">{stats.signature}</span>
                            </button>
                        </Tooltip>
                    )}
                    <button onClick={() => loadData()} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors" title="Atualizar">
                        <Download size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                    <div className={`flex items-center gap-2 mr-2 ${processes.length === 0 ? 'hidden' : ''}`}>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-400 transition-colors"
                        >
                            <ArrowRight size={16} className="rotate-180" />
                        </button>
                        <span className="text-xs text-slate-500 font-mono">
                            {currentPage}/{totalPages || 1}
                        </span>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-400 transition-colors"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </div>

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar Protocolo, Nome ou CPF..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto bg-slate-950 p-6">

                {/* --- ADMIN VIEW --- */}
                {isAdmin && (
                    <div className="space-y-6">
                        {/* KPI CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                <p className="text-xs font-bold text-slate-500 uppercase">Total Processos</p>
                                <div className="flex items-end justify-between mt-2">
                                    <span className="text-3xl font-bold text-white">{stats.total}</span>
                                    <LayoutGrid size={20} className="text-slate-600 mb-1" />
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                <p className="text-xs font-bold text-slate-500 uppercase">Em Análise</p>
                                <div className="flex items-end justify-between mt-2">
                                    <span className="text-3xl font-bold text-blue-400">{stats.active}</span>
                                    <UserCheck size={20} className="text-blue-900 mb-1" />
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => setAdminFilter(adminFilter === 'SIGNATURE' ? null : 'SIGNATURE')}>
                                <p className="text-xs font-bold text-slate-500 uppercase">Para Assinar</p>
                                <div className="flex items-end justify-between mt-2">
                                    <span className="text-3xl font-bold text-purple-400">{stats.signature}</span>
                                    <PenTool size={20} className="text-purple-900 mb-1" />
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-red-900/30 p-4 rounded-xl relative overflow-hidden">
                                <div className="absolute right-0 top-0 p-8 bg-red-500/5 rounded-full blur-xl -mr-4 -mt-4"></div>
                                <p className="text-xs font-bold text-red-400 uppercase">Atrasados (+15 dias)</p>
                                <div className="flex items-end justify-between mt-2 relative z-10">
                                    <span className="text-3xl font-bold text-red-500">{stats.delayed}</span>
                                    <AlertTriangle size={20} className="text-red-900 mb-1" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* WORKLOAD CHART */}
                            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-4">
                                    <Users size={16} className="text-purple-500" />
                                    Carga de Trabalho da Equipe
                                </h3>
                                <div className="space-y-4">
                                    {analysts.map(analyst => {
                                        // Conta processos "EM_ANALISE" que estão com este ID
                                        const count = processes.filter(p => p.analyst_id === analyst.id && p.status === 'EM_ANALISE').length;
                                        const percentage = Math.min(100, (count / 10) * 100); // Assume 10 is max capacity for viz
                                        return (
                                            <div key={analyst.id}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-slate-300 font-medium">{analyst.full_name}</span>
                                                    <span className="text-slate-500">{count} processos</span>
                                                </div>
                                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${count > 5 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {analysts.length === 0 && <p className="text-xs text-slate-500 italic">Nenhum analista cadastrado ou encontrado.</p>}
                                </div>
                            </div>

                            {/* ALL PROCESSES LIST */}
                            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-300 text-sm uppercase flex items-center gap-2">
                                        {adminFilter === 'SIGNATURE' ? <PenTool size={16} className="text-purple-400" /> : null}
                                        {adminFilter === 'SIGNATURE' ? 'Pendências de Assinatura' : 'Todos os Processos'}
                                    </h3>
                                    {adminFilter && <button onClick={() => setAdminFilter(null)} className="text-xs text-blue-400 hover:underline">Limpar Filtro</button>}
                                </div>
                                <ProcessTable
                                    processes={filteredProcesses}
                                    onProcessClick={onProcessClick}
                                    isAdminView={true}
                                    onDeleteProcess={handleDeleteProcess}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PROTOCOLO VIEW (STRICT) --- */}
                {isProtocolo && (
                    <div className="space-y-6">
                        {/* Protocolo Daily Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-900 border border-blue-900/30 p-4 rounded-xl flex items-center gap-4">
                                <div className="p-3 bg-blue-600/10 rounded-lg text-blue-500">
                                    <FilePlus size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Processos Abertos Hoje</p>
                                    <p className="text-2xl font-bold text-white">{createdToday}</p>
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                                <div className="p-3 bg-slate-800 rounded-lg text-slate-400">
                                    <LayoutList size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Total Registrado</p>
                                    <p className="text-2xl font-bold text-white">{processes.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-300 text-sm uppercase flex items-center gap-2">
                                    <Search size={16} />
                                    Consulta de Balcão
                                </h3>
                                <span className="bg-blue-900/30 text-blue-200 px-2 py-0.5 rounded text-xs font-bold border border-blue-800">
                                    Listagem Geral
                                </span>
                            </div>
                            {/* Only show Table. Protocolo cannot see queues or analyst desks. */}
                            <ProcessTable processes={filteredProcesses} onProcessClick={onProcessClick} />
                        </div>
                    </div>
                )}

                {/* --- LICENCIAMENTO VIEW (Includes Admin for convenience) --- */}
                {(isLicenciamento || isAdmin || isFiscalizacao) && !isProtocolo && (
                    <div className="flex flex-col gap-8 mt-2">
                        {/* Only show 'My Desk' if user is Licenciamento role */}
                        {(isLicenciamento || isAdmin) && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <UserCheck className="text-amber-500" size={20} />
                                        {isAdmin ? 'Minha Mesa (Admin)' : 'Minha Mesa de Análise'}
                                    </h2>
                                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                        {filteredProcesses.filter(p => p.analyst_id === userProfile?.id).length} processos
                                    </span>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                    <ProcessTable processes={filteredProcesses.filter(p => p.analyst_id === userProfile?.id)} onProcessClick={onProcessClick} />
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center justify-between border-t border-slate-800 pt-6">
                                <h2 className="text-lg font-bold text-slate-400 flex items-center gap-2">
                                    <LayoutGrid className="text-slate-600" size={20} />
                                    Fila de Distribuição
                                </h2>
                                <span className="text-xs text-slate-500">Aguardando Analista</span>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                                <ProcessTable
                                    processes={filteredProcesses.filter(p => !p.analyst_id && p.status !== 'FINALIZADO')}
                                    onProcessClick={onProcessClick}
                                    showAssignAction={true}
                                    onAssign={handleAssignToMe}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Subcomponent for Table
const ProcessTable: React.FC<{
    processes: Process[],
    onProcessClick: (id: string) => void,
    showAssignAction?: boolean,
    onAssign?: (e: React.MouseEvent, id: string) => void,
    isAdminView?: boolean,
    onDeleteProcess?: (e: React.MouseEvent, id: string) => void
}> = ({ processes, onProcessClick, showAssignAction, onAssign, isAdminView, onDeleteProcess }) => {

    if (processes.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                <LayoutList className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-sm">Nenhum processo encontrado nesta lista.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-950 text-slate-500 font-medium text-xs uppercase">
                    <tr>
                        <th className="px-4 py-3">Protocolo</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Requerente</th>
                        {isAdminView && <th className="px-4 py-3">Responsável Atual</th>}
                        <th className="px-4 py-3">Local / Obra</th>
                        <th className="px-4 py-3">Status</th>
                        {showAssignAction && <th className="px-4 py-3 text-right">Ação</th>}
                        {onDeleteProcess && <th className="px-4 py-3 text-right">Excluir</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {processes.map(p => {
                        const isLate = Math.ceil(Math.abs(Date.now() - new Date(p.created_at!).getTime()) / (1000 * 60 * 60 * 24)) > 15 && p.status !== 'FINALIZADO';
                        return (
                            <tr
                                key={p.id}
                                onClick={() => onProcessClick(p.id)}
                                className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                            >
                                <td className="px-4 py-3 font-mono text-slate-400 group-hover:text-blue-400">
                                    {p.protocol_number}
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                    {new Date(p.created_at!).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-200">
                                    {p.applicants?.name || 'Desconhecido'}
                                    <span className="block text-[10px] text-slate-500 font-mono font-normal">{p.applicants?.cpf}</span>
                                </td>
                                {isAdminView && (
                                    <td className="px-4 py-3 text-slate-300">
                                        {p.analyst_profile?.full_name ? (
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                {p.analyst_profile.full_name}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 italic">Protocolo (Fila)</span>
                                        )}
                                    </td>
                                )}
                                <td className="px-4 py-3 text-slate-400 truncate max-w-[200px]">
                                    {p.address_work}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${p.status === 'PROTOCOLADO' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                                            p.status === 'FINALIZADO' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800' :
                                                p.status === 'AGUARDANDO_ASSINATURA' ? 'bg-purple-900/20 text-purple-400 border-purple-800' :
                                                    p.status === 'PENDENTE_DOC' ? 'bg-amber-900/20 text-amber-400 border-amber-800' :
                                                        p.status === 'ANUENCIA_EMITIDA' ? 'bg-blue-900/20 text-blue-400 border-blue-800' :
                                                            'bg-blue-900/10 text-blue-300 border-blue-800'
                                            }`}>
                                            {p.status.replace(/_/g, ' ')}
                                        </span>
                                        {isLate && (
                                            <Tooltip text="Processo Atrasado (+15 dias)" position="left">
                                                <AlertTriangle size={14} className="text-red-500 animate-pulse" />
                                            </Tooltip>
                                        )}
                                    </div>
                                </td>
                                {showAssignAction && onAssign && (
                                    <td className="px-4 py-3 text-right">
                                        <Tooltip text="Atribuir este processo à minha mesa" position="left">
                                            <button
                                                onClick={(e) => onAssign(e, p.id)}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-lg shadow-blue-900/20 flex items-center gap-1 ml-auto"
                                            >
                                                <ArrowRight size={12} /> Puxar
                                            </button>
                                        </Tooltip>
                                    </td>
                                )}
                                {onDeleteProcess && (
                                    <td className="px-4 py-3 text-right">
                                        <Tooltip text="Excluir processo e documentos (Irreversível)" position="left">
                                            <button
                                                onClick={(e) => onDeleteProcess(e, p.id)}
                                                className="text-red-500 hover:text-red-300 hover:bg-red-900/20 p-1.5 rounded transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </Tooltip>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
