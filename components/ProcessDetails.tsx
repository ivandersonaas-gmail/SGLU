
import React, { useState, useEffect } from 'react';
import { X, FileText, Upload, Loader2, Clock, Eye, Printer, ArrowRightLeft, Gavel, Save, AlertTriangle, Scale, ShieldCheck, Trash2, Lock, Edit2, ArrowRight, ArrowLeft, CheckCircle2, MinusCircle, XCircle, Calculator, Briefcase, Ruler, Calendar, SendHorizontal, Undo2, PenTool, Link, Map, Search, Zap, Bot } from 'lucide-react';
import { Process, Document, UserProfile, UserRole, ProcessStatus, ProjectParameters, ProcessHistory, ComparisonItem } from '../types';
import { ProcessService, ProjectParameterService, supabase, AdminService } from '../services/supabase';
import { AuthService } from '../services/auth';
import { generateOfficialDocument } from '../services/documents';
import { useToast } from './Toast';
import { Tooltip } from './Tooltip';
import { TourViewer } from './TourViewer';
import { MapViewer } from './MapViewer';

// Zonas atualizadas com Cores Fiéis à Imagem do Mapa
const ZONES = ['EIXO 1', 'INTENSIVO', 'EIXO 2', 'MODERADO', 'HISTÓRICA', 'TRANSIÇÃO 1', 'TRANSIÇÃO 2'];

const ZONE_STYLES: Record<string, string> = {
    'EIXO 1': 'bg-[#8e44ad] text-white border-[#732d91]', // Roxo Escuro
    'INTENSIVO': 'bg-[#4dd0e1] text-black border-[#00bcd4]', // Azul Ciano
    'EIXO 2': 'bg-[#f39c12] text-black border-[#e67e22]', // Laranja
    'MODERADO': 'bg-[#fff9c4] text-black border-[#fff59d]', // Creme/Amarelo Pálido
    'HISTÓRICA': 'bg-[#ef5350] text-white border-[#e53935]', // Vermelho Salmão
    'TRANSIÇÃO 1': 'bg-[#aed581] text-black border-[#8bc34a]', // Verde Claro
    'TRANSIÇÃO 2': 'bg-[#ffeb3b] text-black border-[#fdd835]', // Amarelo Vivo
};

interface ProcessDetailsProps {
    processId: string | null;
    onClose: () => void;
    onOpenChat?: (processId: string) => void;
}

export const ProcessDetails: React.FC<ProcessDetailsProps> = ({ processId, onClose, onOpenChat }) => {
    const [process, setProcess] = useState<Process | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [auditParams, setAuditParams] = useState<ProjectParameters | null>(null);
    const [history, setHistory] = useState<ProcessHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [docToDelete, setDocToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState<'INFO' | 'DOCS' | 'AUDIT' | 'GEO' | 'TOUR' | 'HISTORY'>('INFO');
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [isTransferMode, setIsTransferMode] = useState(false);
    const [analysts, setAnalysts] = useState<UserProfile[]>([]);
    const [decisionNote, setDecisionNote] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [savingAudit, setSavingAudit] = useState(false);
    const [evidenceDoc, setEvidenceDoc] = useState<string>('');
    const { addToast } = useToast();

    useEffect(() => {
        const fetchUser = async () => {
            const session = await AuthService.getSession();
            if (session?.user) {
                const profile = await AuthService.getUserProfile(session.user.id);
                setCurrentUser(profile);
            }
        }
        fetchUser();
    }, []);

    useEffect(() => {
        if (processId) {
            loadDetails();
            if (activeTab === 'AUDIT') loadAuditParams();
            if (activeTab === 'HISTORY') loadHistory();
        }
    }, [processId]);

    useEffect(() => {
        if (processId) {
            if (activeTab === 'AUDIT') loadAuditParams();
            if (activeTab === 'HISTORY') loadHistory();
        }
    }, [activeTab]);

    useEffect(() => {
        if (!processId) return;
        const channel = supabase
            .channel(`process-${processId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'processes', filter: `id=eq.${processId}` }, (payload: any) => {
                setProcess(prev => ({ ...prev, ...payload.new }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_parameters', filter: `process_id=eq.${processId}` }, () => {
                loadAuditParams();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `process_id=eq.${processId}` }, () => {
                loadDocuments();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [processId]);

    const loadDocuments = async () => {
        if (!processId) return;
        const docsData = await ProcessService.getDocuments(processId);
        setDocuments(docsData as Document[]);
        if (docsData.length > 0 && !evidenceDoc) {
            const bestDoc = docsData.find((d: Document) => d.file_type === 'PROJETO') || docsData[0];
            setEvidenceDoc(bestDoc.name);
        }
    };

    const loadDetails = async () => {
        if (!processId) return;
        try {
            setLoading(true);
            const procData = await ProcessService.getById(processId);
            setProcess(procData as Process);
            setDecisionNote(procData?.technical_notes || '');
            await loadDocuments();
        } catch (error) {
            addToast("Falha ao carregar detalhes", 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadAuditParams = async () => {
        if (!processId) return;
        try {
            const params = await ProjectParameterService.getParameters(processId);
            setAuditParams(params);
            if (params) {
                if (params.audit_json?.current_step) {
                    setWizardStep(params.audit_json.current_step);
                }
            }
        } catch (e) { console.error(e); }
    };

    const loadHistory = async () => {
        if (!processId) return;
        try {
            const data = await ProcessService.getHistory(processId);
            setHistory(data);
        } catch (e) { console.error(e); }
    };

    const handleStartManualAudit = async () => {
        if (!processId) return;
        const emptyParams: ProjectParameters = {
            process_id: processId,
            status_compliance: 'PENDENTE',
            ai_validation_summary: 'Auditoria Manual Iniciada pelo Analista.',
            audit_json: {
                current_step: 1,
                steps_validated: { preliminary: false, documentation: false, cross_reference: false, responsibility: false },
                checklist_matrix: {}, titularity_matrix: {}, location_matrix: {}, dimension_matrix: {}, responsibility_matrix: {}
            }
        };
        try {
            await ProjectParameterService.upsertParameters(emptyParams);
            await loadAuditParams();
            addToast("Auditoria Manual Iniciada.", 'success');
        } catch (e) { addToast("Erro ao iniciar", 'error'); }
    };

    const handleSaveWizardStep = async (stepValidated: string, nextStep?: number) => {
        if (!processId || !auditParams) return;
        setSavingAudit(true);
        const updatedAuditJson = {
            ...auditParams.audit_json,
            current_step: nextStep || wizardStep,
            steps_validated: { ...auditParams.audit_json?.steps_validated, [stepValidated]: true },
            ...auditParams.audit_json
        };
        try {
            await ProjectParameterService.upsertParameters({ ...auditParams, process_id: processId, audit_json: updatedAuditJson } as ProjectParameters);
            await loadAuditParams();
            if (nextStep) setWizardStep(nextStep);
            addToast(`Etapa ${stepValidated} salva com sucesso!`, 'success');
        } catch (e: any) { addToast("Erro: " + e.message, 'error'); }
        finally { setSavingAudit(false); }
    };

    const updateAuditJson = (section: string, key: string, value: any, persist: boolean = true) => {
        if (!auditParams) return;
        const currentSection = (auditParams.audit_json as any)?.[section] || {};
        const updatedParams = {
            ...auditParams,
            audit_json: { ...auditParams.audit_json, [section]: { ...currentSection, [key]: value } }
        };
        setAuditParams(updatedParams as ProjectParameters);
        if (persist) ProjectParameterService.upsertParameters(updatedParams as ProjectParameters).catch(console.error);
    };

    const handleEntityTypeChange = (type: 'PF' | 'PJ') => {
        if (!auditParams) return;
        const currentSection = auditParams.audit_json?.entity_validation || {};
        const updatedParams = { ...auditParams, audit_json: { ...auditParams.audit_json, entity_validation: { ...currentSection, person_type: type } } };
        setAuditParams(updatedParams as ProjectParameters);
        ProjectParameterService.upsertParameters(updatedParams as ProjectParameters).catch(console.error);
    };

    const updateRootParam = (field: string, value: any, persist: boolean = true) => {
        if (!auditParams) return;
        const updatedParams = { ...auditParams, [field]: value };
        setAuditParams(updatedParams);
        if (persist) ProjectParameterService.upsertParameters(updatedParams as ProjectParameters).catch(console.error);
    };

    const handleMatrixChange = (section: string, key: string, field: string, value: any, persist: boolean = true) => {
        if (!auditParams) return;
        const currentItem = (auditParams.audit_json as any)?.[section]?.[key] || {};
        const newItem = { ...currentItem, [field]: value, timestamp: Date.now() };
        if (field === 'status') {
            newItem.evidence_doc = evidenceDoc;
            if (value !== 'IRREGULAR' && value !== 'DIVERGENTE') newItem.irregularity_note = '';
        }
        const newSection = { ...(auditParams.audit_json as any)?.[section], [key]: newItem };
        const updatedParams = { ...auditParams, audit_json: { ...auditParams.audit_json, [section]: newSection } };
        setAuditParams(updatedParams as ProjectParameters);
        if (persist) ProjectParameterService.upsertParameters(updatedParams as ProjectParameters).catch(console.error);
    };

    const handleLoadAnalysts = async () => {
        setIsTransferMode(true);
        const list = await ProcessService.getAnalysts();
        setAnalysts(list.filter(u => u.id !== currentUser?.id));
    };

    const handleTransfer = async (targetId: string) => {
        if (!process) return;
        try {
            await ProcessService.transferProcess(process.id, targetId);
            setIsTransferMode(false);
            loadDetails();
            addToast("Processo transferido.", 'success');
        } catch (e) { addToast("Erro ao transferir.", 'error'); }
    };

    const handleUpdateStatus = async (newStatus: ProcessStatus) => {
        if (!process) return;
        if ((newStatus === 'PENDENTE_DOC' || newStatus === 'EM_ANALISE') && !decisionNote.trim()) {
            addToast("É obrigatório escrever uma nota.", 'error');
            return;
        }
        setUpdatingStatus(true);
        try {
            await ProcessService.updateStatus(process.id, newStatus, decisionNote);
            await loadDetails();
            addToast(`Status alterado.`, 'success');
        } catch (e: any) { addToast("Erro: " + e.message, 'error'); }
        finally { setUpdatingStatus(false); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !processId) return;
        const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!ALLOWED_TYPES.includes(file.type)) {
            addToast("Formato inválido. Apenas PDF ou Imagens.", 'error');
            return;
        }
        try {
            setUploading(true);
            await ProcessService.uploadDocument(processId, file);
            await loadDetails();
            addToast("Documento enviado.", 'success');
        } catch (error: any) { addToast("Erro no upload: " + error.message, 'error'); }
        finally { setUploading(false); }
    };

    const handleDeleteDocument = async (docId: string, fileUrl: string) => {
        const previousDocs = [...documents];
        setDocuments(prev => prev.filter(d => d.id !== docId));
        setDocToDelete(null); setIsDeleting(false);
        try {
            await ProcessService.deleteDocument(docId, fileUrl);
            addToast("Documento removido.", 'success');
        } catch (e: any) {
            setDocuments(previousDocs);
            console.error("Falha:", e);
            window.alert("Erro ao deletar: " + (e.message || "Verifique conexão."));
        }
    };

    const handlePrint = async () => {
        if (process) {
            addToast("Gerando documento...", 'info');
            const bgUrl = AdminService.getTemplateBackgroundUrl();
            await generateOfficialDocument(process, auditParams, bgUrl);
        }
    };

    const handleStartAiAudit = () => {
        if (processId && onOpenChat) {
            onOpenChat(processId);
        }
    };

    // --- DERIVED VARIABLES ---
    const isAdmin = currentUser?.role === UserRole.ADMIN;
    const isAnalyst = currentUser?.role === UserRole.LICENCIAMENTO;
    const isAnalystOrAdmin = isAdmin || isAnalyst;
    const currentStatus = process?.status;
    const isAssignedToMe = process?.analyst_id === currentUser?.id;
    const isFinalized = currentStatus === 'FINALIZADO';
    const isPendingSignature = currentStatus === 'AGUARDANDO_ASSINATURA';

    const canEdit = (isAdmin || (isAnalyst && isAssignedToMe)) && !isFinalized;
    const canDeleteDocs = canEdit;

    const isHabiteSe = process?.type ? (process.type.toUpperCase().includes('HABITE') || process.type === 'HABITE_SE') : false;

    // Audit derived variables
    const entityType = auditParams?.audit_json?.entity_validation?.person_type || 'PF';
    const areaTerreno = auditParams?.area_terreno || 0;
    const areaTotal = auditParams?.area_total || 0;
    const areaPermeavel = auditParams?.permeabilidade || 0;

    const tsnPercent = areaTerreno > 0 ? ((areaPermeavel / areaTerreno) * 100).toFixed(2) : '0.00';
    const caCalculated = areaTerreno > 0 ? (areaTotal / areaTerreno).toFixed(2) : '0.00';

    const prevStep = () => setWizardStep(prev => Math.max(1, prev - 1));
    const nextStep = () => {
        let stepName = 'preliminary';
        if (wizardStep === 2) stepName = 'documentation';
        else if (wizardStep === 3) stepName = 'cross_reference';
        else if (wizardStep === 4) stepName = 'responsibility';

        handleSaveWizardStep(stepName, Math.min((isHabiteSe ? 3 : 4), wizardStep + 1));
    };

    // -- FUNÇÃO renderEvidenceSelector REMOVIDA --

    const renderDocTable = () => {
        const items = isHabiteSe ? [
            { id: 1, label: "Licença de Construção", key: "licenca_construcao" },
            { id: 2, label: "Taxa BCI", key: "taxa_bci" },
            { id: 3, label: "Taxa CND", key: "taxa_cnd" },
            { id: 4, label: "Documento Escritura", key: "documento_escritura" },
            { id: 5, label: "Documento Inteiro Teor", key: "documento_inteiro_teor" },
            { id: 6, label: "Checklist do fiscal", key: "checklist_fiscal" },
            { id: 7, label: "Projetos Aprovados", key: "projetos_aprovados" },
            { id: 8, label: "Empresa (Contrato social)", key: "empresa_contrato" },
            { id: 9, label: "Pessoa Física (Doc + Proc)", key: "pessoa_fisica_doc" },
            { id: 10, label: "Nome e Endereço Consistência", key: "nome_endereco_consistencia" }
        ] : [
            { id: 1, label: "Protocolo", key: "protocolo" },
            { id: 2, label: "Boletim de Cadastro Imobiliário (BCI)", key: "bci" },
            { id: 3, label: "Certidão Negativa de Débitos (CND)", key: "cnd" },
            { id: 4, label: "Certidão de Inteiro Teor / Escritura", key: "inteiro_teor" },
            { id: 5, label: "ART/RRT de Projeto", key: "art_projeto" },
            { id: 6, label: "ART/RRT de Execução", key: "art_execucao" },
            { id: 7, label: "Documento de Identificação (Proprietário)", key: "doc_identificacao" },
        ];

        return (
            <div className="border border-slate-700 rounded overflow-hidden mt-4">
                <table className="w-full text-xs">
                    <thead className="bg-slate-800 text-slate-300 font-bold uppercase"><tr><th className="p-2 text-center w-10 border-r border-slate-700">Nº</th><th className="p-2 text-left border-r border-slate-700">DOCUMENTO</th><th className="p-2 text-center w-24 border-r border-slate-700">STATUS</th><th className="p-2 text-left">OBSERVAÇÃO</th></tr></thead>
                    <tbody className="bg-slate-950 divide-y divide-slate-800">
                        {items.map((item) => {
                            const section = 'documents_checklist';
                            const auditItem = (auditParams?.audit_json as any)?.[section]?.[item.key] || {};
                            const status = auditItem.status;
                            return (
                                <tr key={item.id} className="hover:bg-slate-900">
                                    <td className="p-2 text-center text-slate-500 font-bold border-r border-slate-800">{item.id}</td>
                                    <td className="p-2 text-slate-300 font-medium border-r border-slate-800">{item.label}</td>
                                    <td className="p-2 text-center border-r border-slate-800">
                                        <Tooltip text={status === 'CONFORME' ? 'Marcar como Pendente' : 'Marcar como Conforme'}>
                                            <button onClick={() => handleMatrixChange(section as any, item.key, 'status', status === 'CONFORME' ? 'PENDENTE' : 'CONFORME', true)} disabled={!canEdit}>
                                                {status === 'CONFORME' ? <CheckCircle2 size={20} className="text-emerald-500 mx-auto fill-emerald-950" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600 mx-auto"></div>}
                                            </button>
                                        </Tooltip>
                                    </td>
                                    <td className="p-2"><input type="text" value={auditItem.irregularity_note || ''} onChange={(e) => handleMatrixChange(section as any, item.key, 'irregularity_note', e.target.value, false)} onBlur={(e) => handleMatrixChange(section as any, item.key, 'irregularity_note', e.target.value, true)} disabled={!canEdit} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs outline-none focus:border-blue-500" placeholder="..." /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderComparisonRow = (section: string, key: string, labelA: string, labelB: string, labelC?: string, labelD?: string) => {
        // (Mantido igual ao original)
        const item: ComparisonItem = (auditParams?.audit_json as any)?.[section]?.[key] || {};
        const status = item.status;
        const KEY_LABELS: Record<string, string> = {
            'protocol_vs_deed': 'REQUERENTE (PROTOCOLO) vs PROPRIETÁRIO (ESCRITURA)',
            'protocol_vs_project': 'REQUERENTE (PROTOCOLO) vs PROPRIETÁRIO (PROJETO)',
            'protocol_vs_art': 'REQUERENTE (PROTOCOLO) vs CONTRATANTE (ART/RRT)',
            'lot_block_compare': 'LOTE E QUADRA (BCI vs ESCRITURA vs PROJETO)',
            'street_compare': 'LOGRADOURO/RUA (BCI vs PROTOCOLO vs CHECKLIST vs PROJETO)',
            'neighborhood_compare': 'BAIRRO/LOTEAMENTO (TODAS AS FONTES)',
            'land_area_compare': 'ÁREA DO TERRENO (ESCRITURA vs PROJETO vs BCI)',
            'built_area_compare': 'ÁREA CONSTRUÍDA (PROJETO APROVADO vs LICENÇA)',
        };
        const displayLabel = KEY_LABELS[key] || key.replace(/_/g, ' ').toUpperCase();

        return (
            <div className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-950 border-b border-slate-800 last:border-0 text-xs">
                <div className="col-span-3 font-bold text-slate-400 uppercase text-[10px] leading-tight">{displayLabel}</div>
                <div className="col-span-7 grid grid-cols-2 gap-2">
                    <div className="flex flex-col"><span className="text-[9px] text-slate-600 uppercase">{labelA}</span><input type="text" value={item.source_a || ''} onChange={e => handleMatrixChange(section, key, 'source_a', e.target.value, false)} onBlur={e => handleMatrixChange(section, key, 'source_a', e.target.value, true)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none" disabled={!canEdit} placeholder="---" /></div>
                    <div className="flex flex-col"><span className="text-[9px] text-slate-600 uppercase">{labelB}</span><input type="text" value={item.source_b || ''} onChange={e => handleMatrixChange(section, key, 'source_b', e.target.value, false)} onBlur={e => handleMatrixChange(section, key, 'source_b', e.target.value, true)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none" disabled={!canEdit} placeholder="---" /></div>
                    {labelC && <div className="flex flex-col mt-1"><span className="text-[9px] text-slate-600 uppercase">{labelC}</span><input type="text" value={item.source_c || ''} onChange={e => handleMatrixChange(section, key, 'source_c', e.target.value, false)} onBlur={e => handleMatrixChange(section, key, 'source_c', e.target.value, true)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none" disabled={!canEdit} placeholder="---" /></div>}
                    {labelD && <div className="flex flex-col mt-1"><span className="text-[9px] text-slate-600 uppercase">{labelD}</span><input type="text" value={item.source_d || ''} onChange={e => handleMatrixChange(section, key, 'source_d', e.target.value, false)} onBlur={e => handleMatrixChange(section, key, 'source_d', e.target.value, true)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none" disabled={!canEdit} placeholder="---" /></div>}
                </div>
                <div className="col-span-2 flex justify-end">
                    <Tooltip text={status === 'CONFORME' ? 'Alternar para Divergente' : 'Marcar como Conforme'}>
                        <button onClick={() => handleMatrixChange(section, key, 'status', status === 'CONFORME' ? 'DIVERGENTE' : 'CONFORME', true)} disabled={!canEdit} className={`flex items-center gap-1 px-2 py-1 rounded border ${status === 'CONFORME' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : status === 'DIVERGENTE' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                            {status === 'CONFORME' ? <CheckCircle2 size={14} /> : status === 'DIVERGENTE' ? <XCircle size={14} /> : <MinusCircle size={14} />}
                            <span className="text-[10px] font-bold">{status || 'PENDENTE'}</span>
                        </button>
                    </Tooltip>
                </div>
            </div>
        );
    };

    const renderMatrixRow = (section: any, label: string, key: string, unit: string = '') => {
        // (Mantido igual ao original)
        const item = auditParams?.audit_json?.[section]?.[key] || {};
        const status = item.status;
        const value = item.value !== undefined ? item.value : (item.ai_value || '');
        const BOOLEAN_ITEMS = ['projeto_assinado', 'medidas_conferem', 'confrontantes_conferem', 'piso_tatil', 'janelas_vizinhanca', 'habitabilidade', 'calcada_padrao', 'numeracao_predial', 'rrt_projeto_check', 'art_execucao_check', 'compatibilidade_autoria', 'area_uso_comum', 'atividade_tecnica_descrita', 'art_rrt_projeto', 'art_rrt_execucao', 'certidao_data_check'];
        const hideInput = BOOLEAN_ITEMS.includes(key);

        return (
            <div className="flex flex-col p-3 hover:bg-slate-900 rounded border border-transparent hover:border-slate-800 transition-colors mb-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">{label}</span>
                    <div className="flex items-center gap-2">
                        {!hideInput ? (
                            <><input type="text" value={value} onChange={(e) => handleMatrixChange(section, key, 'value', e.target.value, false)} onBlur={(e) => handleMatrixChange(section, key, 'value', e.target.value, true)} placeholder="---" disabled={!canEdit} className="w-20 bg-slate-950 border border-slate-700 text-white text-xs rounded px-2 py-1 text-right outline-none focus:border-blue-500" />{unit && <span className="text-[10px] text-slate-500">{unit}</span>}</>
                        ) : (item.ai_value && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-800/50 truncate max-w-[100px]" title={item.ai_value.toString()}>IA: {item.ai_value}</span>)}
                        <div className="flex gap-1 ml-2">
                            <Tooltip text="Conforme"><button onClick={() => handleMatrixChange(section, key, 'status', 'CONFORME', true)} disabled={!canEdit} className={`p-1 rounded ${status === 'CONFORME' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-emerald-400'}`}><CheckCircle2 size={14} /></button></Tooltip>
                            <Tooltip text="Irregular"><button onClick={() => handleMatrixChange(section, key, 'status', 'IRREGULAR', true)} disabled={!canEdit} className={`p-1 rounded ${status === 'IRREGULAR' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-red-400'}`}><XCircle size={14} /></button></Tooltip>
                            <Tooltip text="Não se Aplica"><button onClick={() => handleMatrixChange(section, key, 'status', 'NA', true)} disabled={!canEdit} className={`p-1 rounded ${status === 'NA' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-white'}`}><MinusCircle size={14} /></button></Tooltip>
                        </div>
                    </div>
                </div>
                {!hideInput && item.ai_value && <p className="text-[10px] text-blue-400 mt-0.5 ml-1">IA Sugeriu: {item.ai_value}{unit}</p>}
                {status === 'IRREGULAR' && <textarea value={item.irregularity_note || ''} onChange={(e) => handleMatrixChange(section, key, 'irregularity_note', e.target.value, false)} onBlur={(e) => handleMatrixChange(section, key, 'irregularity_note', e.target.value, true)} placeholder="Descreva a pendência..." className="mt-2 w-full bg-red-900/10 border border-red-900/30 text-red-200 text-xs rounded p-2 outline-none focus:border-red-500" rows={2} disabled={!canEdit} />}
            </div>
        );
    };

    const renderCoatingTable = () => {
        // (Mantido igual)
        const section = 'checklist_matrix'; const key = 'revestimento_impermeavel';
        const item = (auditParams?.audit_json as any)?.[section]?.[key] || {};
        const customData = item.custom_data || { ceramico: false, tinta: false, laudo: 'NAO' };
        const updateCustom = (field: string, val: any) => {
            const newData = { ...customData, [field]: val };
            const newItem = { ...item, custom_data: newData, status: 'CONFORME' };
            const updatedParams = { ...auditParams, audit_json: { ...auditParams!.audit_json, [section]: { ...auditParams!.audit_json![section], [key]: newItem } } };
            setAuditParams(updatedParams as ProjectParameters);
            ProjectParameterService.upsertParameters(updatedParams as ProjectParameters).catch(console.error);
        };
        return (
            <div className="bg-slate-950 border border-slate-800 rounded p-4 mb-4">
                <div className="flex justify-between items-center mb-3"><span className="text-sm font-medium text-slate-300">Verificar se tem revestimento cerâmico ou solução equivalente (Áreas Molhadas)</span>{item.ai_value && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-1 rounded">IA: {item.ai_value}</span>}</div>
                <div className="grid grid-cols-2 border border-slate-700 rounded overflow-hidden">
                    <div className="border-r border-slate-700"><div className="bg-slate-800 text-slate-400 text-[10px] font-bold p-2 text-center border-b border-slate-700">Cerâmico &nbsp;&nbsp;|&nbsp;&nbsp; Tinta Imp.</div><div className="flex justify-around p-3 bg-slate-900"><div className="flex flex-col items-center gap-1"><span className="text-[10px] text-slate-500">SIM</span><input type="checkbox" checked={customData.ceramico} onChange={e => updateCustom('ceramico', e.target.checked)} disabled={!canEdit} className="w-4 h-4 rounded bg-slate-800 border-slate-600" /></div><div className="flex flex-col items-center gap-1"><span className="text-[10px] text-slate-500">SIM</span><input type="checkbox" checked={customData.tinta} onChange={e => updateCustom('tinta', e.target.checked)} disabled={!canEdit} className="w-4 h-4 rounded bg-slate-800 border-slate-600" /></div></div></div>
                    <div><div className="bg-slate-800 text-slate-400 text-[10px] font-bold p-2 text-center border-b border-slate-700">Laudo Eng.</div><div className="flex justify-around p-3 bg-slate-900 items-center"><label className="flex flex-col items-center gap-1 cursor-pointer"><span className="text-[10px] text-slate-500">SIM</span><input type="radio" name="laudo_eng" checked={customData.laudo === 'SIM'} onChange={() => updateCustom('laudo', 'SIM')} disabled={!canEdit} className="w-4 h-4" /></label><label className="flex flex-col items-center gap-1 cursor-pointer"><span className="text-[10px] text-slate-500">NSAP</span><input type="radio" name="laudo_eng" checked={customData.laudo === 'NSAP'} onChange={() => updateCustom('laudo', 'NSAP')} disabled={!canEdit} className="w-4 h-4" /></label><label className="flex flex-col items-center gap-1 cursor-pointer"><span className="text-[10px] text-slate-500">NÃO</span><input type="radio" name="laudo_eng" checked={customData.laudo === 'NAO'} onChange={() => updateCustom('laudo', 'NAO')} disabled={!canEdit} className="w-4 h-4" /></label></div></div>
                </div>
            </div>
        );
    };

    const renderCertidaoValidity = () => {
        // (Mantido igual)
        const section = 'responsibility_matrix'; const key = 'certidao_data_check';
        const item = (auditParams?.audit_json as any)?.[section]?.[key] || {};
        const issueDate = item.value;
        let daysDiff = 0; let isExpired = false; let statusText = 'Data não informada'; let statusColor = 'text-slate-500';
        if (issueDate) {
            const today = new Date(); const issue = new Date(issueDate); const diffTime = Math.abs(today.getTime() - issue.getTime());
            daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); isExpired = daysDiff > 60;
            statusText = isExpired ? `VENCIDA há ${daysDiff} dias (>60)` : `Válida (${daysDiff} dias)`;
            statusColor = isExpired ? 'text-red-500 font-bold animate-pulse' : 'text-emerald-400 font-medium';
        }
        return (
            <div className="flex flex-col p-4 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Calendar size={16} className="text-slate-400" /><span className="text-sm font-medium text-slate-300">Data Emissão Certidão (Inteiro Teor)</span></div><span className={`text-xs ${statusColor}`}>{statusText}</span></div>
                <div className="flex gap-3 items-center">
                    <input type="date" value={issueDate || ''} onChange={(e) => handleMatrixChange(section, key, 'value', e.target.value, true)} disabled={!canEdit} className="bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-1.5 outline-none focus:border-blue-500" />
                    {isExpired && (<div className="flex-1"><input type="text" placeholder="Obs: Solicitar certidão atualizada..." value={item.irregularity_note || ''} onChange={(e) => handleMatrixChange(section, key, 'irregularity_note', e.target.value, false)} onBlur={(e) => handleMatrixChange(section, key, 'irregularity_note', e.target.value, true)} disabled={!canEdit} className="w-full bg-red-900/10 border border-red-900/30 text-red-200 text-xs rounded px-2 py-1.5 outline-none" /></div>)}
                </div>
            </div>
        );
    };

    if (!processId) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
            <div className="bg-slate-900 w-full sm:w-[90%] md:w-[900px] h-[95vh] sm:h-[90vh] sm:rounded-2xl border border-slate-800 shadow-2xl pointer-events-auto flex flex-col overflow-hidden relative">
                <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/50">
                    <div className="flex items-center gap-3"><div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg"><FileText size={20} /></div><div><h2 className="font-bold text-white text-lg">Processo #{process?.protocol_number}</h2><p className="text-xs text-slate-500 uppercase font-medium">{process?.type}</p></div></div>
                    <div className="flex items-center gap-2">
                        {/* BOTÃO DE AUDITORIA DIRETA - CORREÇÃO DE FLUXO */}
                        {onOpenChat && (
                            <Tooltip text="Ir para o Chat com o Auditor IA">
                                <button
                                    onClick={handleStartAiAudit}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-amber-900/20 transition-all mr-2"
                                >
                                    <Search size={16} /> AUDITAR COM IA
                                </button>
                            </Tooltip>
                        )}

                        {(isAnalystOrAdmin) && process && process.status === 'FINALIZADO' && (
                            <Tooltip text="Gerar PDF Oficial"><button onClick={handlePrint} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg"><Printer size={16} /> Emitir Doc</button></Tooltip>
                        )}
                        <Tooltip text="Fechar Janela"><button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><X size={20} /></button></Tooltip></div>
                </div>

                {/* Resto do componente mantido... */}
                <div className="flex border-b border-slate-800 px-6 bg-slate-950/30 overflow-x-auto">
                    {['INFO', 'DOCS', 'AUDIT', 'GEO', 'HISTORY'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{tab === 'INFO' ? 'Resumo' : tab === 'DOCS' ? 'Documentos' : tab === 'AUDIT' ? 'Auditoria Técnica' : tab === 'GEO' ? 'Geo-Análise' : 'Histórico'}</button>
                    ))}
                    <button onClick={() => setActiveTab('TOUR')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'TOUR' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Vistoria 360º</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
                    {loading ? <div className="flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div> : (
                        <>
                            {activeTab === 'INFO' && (
                                <div className="space-y-6">
                                    {/* ... (Conteúdo da aba INFO mantido) ... */}
                                    <div className={`border rounded-xl p-4 flex justify-between items-center ${currentStatus === 'AGUARDANDO_ASSINATURA' ? 'bg-purple-900/20 border-purple-800' : currentStatus === 'PENDENTE_DOC' ? 'bg-amber-900/20 border-amber-800' : currentStatus === 'FINALIZADO' ? 'bg-emerald-900/20 border-emerald-800' : 'bg-slate-900 border-slate-800'}`}>
                                        <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Status Atual</p><span className={`px-3 py-1 rounded-full text-sm font-bold border ${currentStatus === 'AGUARDANDO_ASSINATURA' ? 'bg-purple-600 text-white border-purple-500' : currentStatus === 'PENDENTE_DOC' ? 'bg-amber-600 text-white border-amber-500' : currentStatus === 'FINALIZADO' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>{currentStatus?.replace(/_/g, ' ')}</span></div>
                                        {isAnalystOrAdmin && !isTransferMode && process?.analyst_id && !isFinalized && (<button onClick={handleLoadAnalysts} className="text-xs text-blue-400 hover:underline bg-slate-900 px-3 py-1 rounded border border-slate-800">Transferir Responsabilidade</button>)}
                                        {isTransferMode && (<div className="flex items-center gap-2 bg-slate-800 p-1 rounded"><select onChange={(e) => handleTransfer(e.target.value)} className="bg-slate-900 text-xs text-white p-1 rounded"><option>Selecione...</option>{analysts.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}</select><button onClick={() => setIsTransferMode(false)}><X size={14} /></button></div>)}
                                    </div>

                                    {(isAnalystOrAdmin && isAssignedToMe && !isPendingSignature && !isFinalized) && (
                                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                                            <h3 className="text-sm font-bold text-white mb-3 flex gap-2 items-center"><Gavel size={16} className="text-blue-500" /> Parecer Técnico do Analista</h3>
                                            <textarea value={decisionNote} onChange={e => setDecisionNote(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-200 mb-4 outline-none focus:border-blue-500 transition-colors" rows={4} placeholder="Escreva seu parecer técnico..." />
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <Tooltip text="Solicitar Correção"><button onClick={() => handleUpdateStatus('PENDENTE_DOC')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 border border-amber-800/50 rounded-lg text-xs font-bold transition-all"><AlertTriangle size={16} /> Solicitar Correção</button></Tooltip>
                                                <Tooltip text="Aguardar Licença"><button onClick={() => handleUpdateStatus('ANUENCIA_EMITIDA')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-800/50 rounded-lg text-xs font-bold transition-all"><Clock size={16} /> Aguardar Licença Amb.</button></Tooltip>
                                                <Tooltip text="Encaminhar Assinatura"><button onClick={() => handleUpdateStatus('AGUARDANDO_ASSINATURA')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-900/20 transition-all"><SendHorizontal size={16} /> Encaminhar p/ Assinatura</button></Tooltip>
                                            </div>
                                        </div>
                                    )}

                                    {(isAdmin && isPendingSignature) && (
                                        <div className="bg-purple-900/10 border border-purple-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                                            <h3 className="text-sm font-bold text-purple-300 mb-3 flex gap-2 items-center relative z-10"><PenTool size={16} /> Área de Assinatura (Secretário)</h3>
                                            <div className="bg-slate-950/50 p-4 rounded border border-purple-900/30 mb-4 text-sm text-slate-300 italic relative z-10"><span className="text-purple-400 font-bold not-italic text-xs uppercase block mb-1">Parecer do Analista:</span>"{process?.technical_notes || 'Sem notas.'}"</div>
                                            <textarea value={decisionNote} onChange={e => setDecisionNote(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-200 mb-4 outline-none focus:border-purple-500 transition-colors relative z-10" rows={2} placeholder="Observações finais..." />
                                            <div className="flex gap-3 relative z-10">
                                                <Tooltip text="Devolver"><button onClick={() => handleUpdateStatus('EM_ANALISE')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/50 rounded-lg text-xs font-bold transition-all"><Undo2 size={16} /> Devolver para Ajustes</button></Tooltip>
                                                <Tooltip text="Finalizar"><button onClick={() => handleUpdateStatus('FINALIZADO')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-900/20 transition-all"><CheckCircle2 size={16} /> Assinar e Finalizar</button></Tooltip>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'DOCS' && (
                                <div className="space-y-4">
                                    {/* BOTÃO DE UPLOAD REINSERIDO AQUI */}
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-300">Anexos do Processo</h3>
                                        {canEdit && (
                                            <div className="relative">
                                                <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                                                <button disabled={uploading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20 transition-all">
                                                    {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                                    Adicionar Documento
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {documents.map(doc => (
                                        <div key={doc.id} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700">
                                            <div className="flex gap-3 items-center overflow-hidden"><FileText size={20} className="text-slate-500 shrink-0" /><div className="min-w-0"><p className="text-sm text-slate-200 truncate">{doc.name}</p><span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-400 uppercase">{doc.file_type}</span></div></div>
                                            <div className="flex items-center gap-1">
                                                <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-blue-400"><Eye size={18} /></a>
                                                {canDeleteDocs && (<Tooltip text="Excluir"><button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id, doc.file_url); }} className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-900/10 rounded transition-colors"><Trash2 size={18} /></button></Tooltip>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'GEO' && (
                                <MapViewer
                                    zone={auditParams?.zona_uso}
                                    area={auditParams?.area_terreno}
                                    address={process?.address_work}
                                />
                            )}

                            {/* AUDIT TAB and TOUR TAB content remains the same */}
                            {activeTab === 'AUDIT' && (
                                <div className="space-y-6 h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-2 px-2">
                                        <div className="flex items-center gap-1 w-full">
                                            {[1, 2, 3, 4].map(step => {
                                                if (isHabiteSe && step === 4) return null;
                                                return (<button type="button" key={step} onClick={() => setWizardStep(step)} className={`flex-1 h-2 rounded-full mx-1 cursor-pointer hover:opacity-80 transition-all outline-none focus:ring-2 focus:ring-blue-500/50 ${wizardStep >= step ? 'bg-blue-600' : 'bg-slate-800'}`} title={`Ir para etapa ${step}`} />);
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex justify-between px-2 text-[10px] font-bold text-slate-500 uppercase mb-4"><span>1. Preliminar</span><span>2. Documentos</span><span>{isHabiteSe ? '3. Cruzamento' : '3. Técnico/Eng'}</span>{!isHabiteSe && <span>4. Resp. Técnica</span>}</div>

                                    {/* PROMOÇÃO DO NOVO COCKPIT - VISÍVEL SEMPRE */}
                                    <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-xl p-4 mb-6 flex items-center justify-between relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                                        <div className="relative z-10">
                                            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2"><Zap size={18} className="text-amber-400 fill-amber-400" /> Disponível: Cockpit de Auditoria 3.0</h3>
                                            <p className="text-xs text-blue-200">Experimente a nova interface imersiva de análise com Inteligência Artificial em tela cheia.</p>
                                        </div>
                                        <button onClick={handleStartAiAudit} className="relative z-10 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform transform hover:scale-105">
                                            <Scale size={18} />
                                            <span className="hidden sm:inline">Auditar com IA</span>
                                        </button>
                                    </div>

                                    {/* AI CHECKLIST SECTION - INJECTED AS REQUESTED */}
                                    {auditParams?.audit_json?.cockpit && (
                                        <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 mb-6 shadow-lg">
                                            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                                                <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                                                    <Bot size={20} /> Análise da IA (Sugestões)
                                                </h3>
                                                <span className="text-xs text-slate-500">Dados importados do Chat</span>
                                            </div>

                                            <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                                {(auditParams.audit_json.cockpit as any).sections?.map((section: any, sIdx: number) => (
                                                    <div key={sIdx} className="border border-slate-800 rounded p-3 bg-slate-900/50">
                                                        <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">{section.title}</h4>
                                                        <div className="space-y-2">
                                                            {section.items?.map((item: any, iIdx: number) => (
                                                                <div key={iIdx} className="flex gap-2 items-start text-xs border-b border-slate-800/50 pb-2 last:border-0">
                                                                    <div className={`mt-0.5 shrink-0 ${item.status === 'ok' ? 'text-emerald-500' : item.status === 'error' ? 'text-red-500' : 'text-amber-500'}`}>
                                                                        {item.status === 'ok' ? <CheckCircle2 size={14} /> : item.status === 'error' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-slate-300">{item.text}</p>
                                                                        {item.comment && <p className="text-slate-500 italic mt-0.5">Obs: "{item.comment}"</p>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!auditParams?.ai_validation_summary && wizardStep === 1 && (
                                        <div className="text-center py-8"><ShieldCheck className="mx-auto text-slate-600 mb-4" size={48} /><h3 className="text-lg font-bold text-slate-300 mb-2">Auditoria Formal Não Iniciada</h3>{canEdit ? (<button onClick={handleStartManualAudit} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 mx-auto"><Edit2 size={16} /> Iniciar Manualmente</button>) : (<div className="mt-2 bg-amber-900/20 text-amber-400 p-3 rounded border border-amber-800/50 text-sm inline-block">Aguardando início da auditoria pelo Licenciamento.</div>)}</div>
                                    )}

                                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-y-auto shadow-inner">
                                        {/* Wizard Steps Content (Same as previous) */}
                                        {wizardStep === 1 && (
                                            <div className="space-y-6 animate-in slide-in-from-right">
                                                {/* REMOVIDO: renderEvidenceSelector() */}
                                                <h4 className="font-bold text-blue-400 text-sm uppercase border-b border-slate-800 pb-2">1. Verificação Preliminar</h4>
                                                <div className="bg-slate-950 p-4 rounded border border-slate-800">
                                                    <p className="text-sm font-medium text-slate-300 mb-2">Consulta no 1Doc Realizada?</p>
                                                    <div className="flex gap-4 mb-2"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="1doc" checked={auditParams?.audit_json?.preliminary_data?.one_doc_status === 'SIM'} onChange={() => updateAuditJson('preliminary_data', 'one_doc_status', 'SIM', true)} disabled={!canEdit} /><span className="text-sm text-slate-400">Sim (OK)</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="1doc" checked={auditParams?.audit_json?.preliminary_data?.one_doc_status === 'NAO'} onChange={() => updateAuditJson('preliminary_data', 'one_doc_status', 'NAO', true)} disabled={!canEdit} /><span className="text-sm text-slate-400">Não</span></label></div>
                                                    {auditParams?.audit_json?.preliminary_data?.one_doc_status === 'NAO' && (<textarea value={auditParams?.audit_json?.preliminary_data?.one_doc_obs || ''} onChange={e => updateAuditJson('preliminary_data', 'one_doc_obs', e.target.value, false)} onBlur={e => updateAuditJson('preliminary_data', 'one_doc_obs', e.target.value, true)} placeholder="Observação obrigatória..." className="w-full bg-amber-900/10 border border-amber-800/50 text-amber-200 text-xs p-2 rounded outline-none" disabled={!canEdit} />)}
                                                </div>
                                                <div className="bg-slate-950 p-4 rounded border border-slate-800">
                                                    <div className="flex justify-between"><p className="text-sm font-medium text-slate-300 mb-2">Tem Licença Ambiental?</p>{auditParams?.audit_json?.preliminary_data?.env_license_ai_proof && (<Tooltip text={auditParams.audit_json.preliminary_data.env_license_ai_proof}><Eye size={16} className="text-blue-500 cursor-help" /></Tooltip>)}</div>
                                                    <div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="env" checked={auditParams?.audit_json?.preliminary_data?.env_license_status === 'SIM'} onChange={() => updateAuditJson('preliminary_data', 'env_license_status', 'SIM', true)} disabled={!canEdit} /><span className="text-sm text-emerald-400">Sim</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="env" checked={auditParams?.audit_json?.preliminary_data?.env_license_status === 'NAO'} onChange={() => updateAuditJson('preliminary_data', 'env_license_status', 'NAO', true)} disabled={!canEdit} /><span className="text-sm text-red-400">Não</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="env" checked={auditParams?.audit_json?.preliminary_data?.env_license_status === 'NA'} onChange={() => updateAuditJson('preliminary_data', 'env_license_status', 'NA', true)} disabled={!canEdit} /><span className="text-sm text-slate-400">Não se Aplica</span></label></div>
                                                    {auditParams?.audit_json?.preliminary_data?.env_license_status === 'NAO' && <div className="mt-2 bg-amber-900/20 border border-amber-800 text-amber-400 text-xs p-2 rounded flex items-center gap-2"><AlertTriangle size={14} /> Necessário solicitar Anuência Ambiental.</div>}
                                                </div>
                                            </div>
                                        )}

                                        {wizardStep === 2 && (
                                            <div className="space-y-6 animate-in slide-in-from-right">
                                                {/* REMOVIDO: renderEvidenceSelector() */}
                                                <h4 className="font-bold text-blue-400 text-sm uppercase border-b border-slate-800 pb-2 flex items-center gap-2"><Briefcase size={16} /> 2. Documentos & Consistência</h4>
                                                <div className="bg-slate-950 border border-slate-800 rounded p-4"><h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Dados do Imóvel (Certidão/BCI)</h5><div className="grid grid-cols-3 gap-3"><div><label className="text-[10px] text-slate-600 uppercase">Quadra</label><input type="text" value={auditParams?.audit_json?.certificate_data?.quadra || ''} onChange={e => updateAuditJson('certificate_data', 'quadra', e.target.value, false)} onBlur={e => updateAuditJson('certificate_data', 'quadra', e.target.value, true)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded px-2 py-1 outline-none" disabled={!canEdit} /></div><div><label className="text-[10px] text-slate-600 uppercase">Lote</label><input type="text" value={auditParams?.audit_json?.certificate_data?.lote || ''} onChange={e => updateAuditJson('certificate_data', 'lote', e.target.value, false)} onBlur={e => updateAuditJson('certificate_data', 'lote', e.target.value, true)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded px-2 py-1 outline-none" disabled={!canEdit} /></div><div><label className="text-[10px] text-slate-600 uppercase">Matrícula</label><input type="text" value={auditParams?.audit_json?.certificate_data?.matricula || ''} onChange={e => updateAuditJson('certificate_data', 'matricula', e.target.value, false)} onBlur={e => updateAuditJson('certificate_data', 'matricula', e.target.value, true)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded px-2 py-1 outline-none" disabled={!canEdit} /></div></div></div>
                                                <div className="bg-slate-950 border border-slate-800 rounded p-4"><div className="flex justify-between items-center mb-3"><h5 className="text-xs font-bold text-purple-400 uppercase">Identificação do Requerente</h5><div className="flex gap-1 text-[10px] bg-slate-900 border border-slate-800 rounded p-1"><button onClick={() => handleEntityTypeChange('PF')} className={`px-2 py-0.5 rounded ${entityType === 'PF' ? 'bg-purple-600 text-white' : 'text-slate-500'}`} disabled={!canEdit}>PF</button><button onClick={() => handleEntityTypeChange('PJ')} className={`px-2 py-0.5 rounded ${entityType === 'PJ' ? 'bg-purple-600 text-white' : 'text-slate-500'}`} disabled={!canEdit}>PJ</button></div></div><div className="space-y-1">{entityType === 'PJ' ? (<> {renderMatrixRow('entity_validation', 'Contrato Social', 'contrato_social')} {renderMatrixRow('entity_validation', 'Procuração / Doc. Representante', 'procuracao')} </>) : (<> {renderMatrixRow('entity_validation', 'Documento Pessoal (RG/CNH)', 'doc_pessoal')} {renderMatrixRow('entity_validation', 'Procuração (Se não for proprietário)', 'procuracao')} </>)}</div></div>
                                                <div className="space-y-2"><h5 className="text-xs font-bold text-slate-500 uppercase">Checklist Documental</h5>{renderDocTable()}</div>
                                                <div className="bg-slate-950 border border-slate-800 rounded p-4 mt-4"><h5 className="text-xs font-bold text-amber-400 uppercase mb-3 border-b border-slate-800 pb-1">Consistência de Endereço</h5>{renderComparisonRow("location_matrix", "street_compare", "Protocolo", "Escritura", "BCI")}{renderComparisonRow("location_matrix", "neighborhood_compare", "Escritura", "Projeto", "BCI")}</div>
                                            </div>
                                        )}

                                        {wizardStep === 3 && (
                                            <div className="space-y-6 animate-in slide-in-from-right">
                                                {/* REMOVIDO: renderEvidenceSelector() */}

                                                {isHabiteSe ? (
                                                    <>
                                                        <h4 className="font-bold text-blue-400 text-sm uppercase border-b border-slate-800 pb-2 mt-4 flex items-center gap-2"><ArrowRightLeft size={16} /> 3. Cruzamento de Dados & Consistência</h4>
                                                        <div className="space-y-6">
                                                            <div className="bg-slate-950 border border-slate-800 rounded p-4"><h5 className="text-xs font-bold text-emerald-400 uppercase mb-3 border-b border-slate-800 pb-1">A) Matriz de Titularidade (QUEM)</h5>{renderComparisonRow("titularity_matrix", "protocol_vs_deed", "Protocolo", "Escritura/Certidão")}{renderComparisonRow("titularity_matrix", "protocol_vs_project", "Protocolo", "Proprietário (Planta)")}{renderComparisonRow("titularity_matrix", "protocol_vs_art", "Protocolo", "Contratante (ART/RRT)")}</div>
                                                            <div className="bg-slate-950 border border-slate-800 rounded p-4"><h5 className="text-xs font-bold text-blue-400 uppercase mb-3 border-b border-slate-800 pb-1">C) Matriz de Dimensões (QUANTO)</h5>{renderComparisonRow("dimension_matrix", "land_area_compare", "Escritura", "Projeto", "BCI")}{renderComparisonRow("dimension_matrix", "built_area_compare", "Projeto Aprovado", "Licença de Construção")}</div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <h4 className="font-bold text-blue-400 text-sm uppercase border-b border-slate-800 pb-2 mt-4 flex items-center gap-2"><Ruler size={16} /> 3. Análise Técnica & Urbanística</h4>
                                                        <div className="bg-slate-950 p-4 rounded border border-slate-800"><h5 className="text-xs font-bold text-slate-500 uppercase mb-3">A) Zoneamento</h5><select value={auditParams?.zona_uso || ''} onChange={(e) => updateRootParam('zona_uso', e.target.value, true)} disabled={!canEdit} className={`w-full p-2 rounded text-sm font-bold outline-none border ${ZONE_STYLES[auditParams?.zona_uso || ''] || 'bg-slate-900 text-slate-400 border-slate-700'}`}><option value="" className="bg-slate-950 text-slate-400">Selecione a Zona...</option>{ZONES.map(z => <option key={z} value={z} className="bg-slate-900 text-white">{z}</option>)}</select></div>
                                                        <div className="bg-slate-950 p-4 rounded border border-slate-800">
                                                            <h5 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center gap-2"><Calculator size={14} /> B) Parâmetros Urbanísticos</h5>
                                                            <div className="grid grid-cols-3 gap-4 mb-4"><div><label className="text-[10px] text-slate-500 uppercase">Área Terreno (m²)</label><input type="number" value={areaTerreno} onChange={e => updateRootParam('area_terreno', parseFloat(e.target.value), false)} onBlur={e => updateRootParam('area_terreno', parseFloat(e.target.value), true)} disabled={!canEdit} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div><div><label className="text-[10px] text-slate-500 uppercase">Área Construída Total (m²)</label><input type="number" value={areaTotal} onChange={e => updateRootParam('area_total', parseFloat(e.target.value), false)} onBlur={e => updateRootParam('area_total', parseFloat(e.target.value), true)} disabled={!canEdit} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div><div><label className="text-[10px] text-slate-500 uppercase">Área Permeável (m²)</label><input type="number" value={areaPermeavel} onChange={e => updateRootParam('permeabilidade', parseFloat(e.target.value), false)} onBlur={e => updateRootParam('permeabilidade', parseFloat(e.target.value), true)} disabled={!canEdit} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div></div>
                                                            <div className="grid grid-cols-2 gap-4 bg-slate-900 p-3 rounded border border-slate-800/50"><div><label className="text-[10px] text-slate-500 uppercase">Taxa de Permeabilidade (TSN)</label><div className={`text-lg font-bold ${parseFloat(tsnPercent) < 10 ? 'text-red-500' : 'text-emerald-400'}`}>{tsnPercent}%</div></div><div><label className="text-[10px] text-slate-500 uppercase">Índice de Aproveitamento (CA)</label><div className="text-lg font-bold text-blue-400">{caCalculated}</div></div></div>
                                                        </div>
                                                        <div className="bg-slate-950 p-4 rounded border border-slate-800"><h5 className="text-xs font-bold text-slate-400 uppercase mb-3">C) Recuos e Afastamentos</h5>{renderMatrixRow('checklist_matrix', 'Recuo Frontal', 'recuo_frontal', 'm')}{renderMatrixRow('checklist_matrix', 'Recuo de Fundos', 'recuo_fundos', 'm')}{renderMatrixRow('checklist_matrix', 'Recuos Laterais', 'recuos_laterais', 'm')}{renderMatrixRow('checklist_matrix', 'Taxa de Ocupação', 'taxa_ocupacao', '%')}</div>
                                                        <div className="bg-slate-950 p-4 rounded border border-slate-800"><h5 className="text-xs font-bold text-purple-400 uppercase mb-3">D) Checklist de Projeto</h5>{renderMatrixRow('checklist_matrix', 'Projeto Assinado (Selo)?', 'projeto_assinado')}{renderMatrixRow('checklist_matrix', 'Medidas Conferem com Escritura?', 'medidas_conferem')}{renderMatrixRow('checklist_matrix', 'Confrontantes Conferem?', 'confrontantes_conferem')}{renderMatrixRow('checklist_matrix', 'Acessibilidade (Piso Tátil)?', 'piso_tatil')}{renderMatrixRow('checklist_matrix', 'Janelas a 1.5m da divisa?', 'janelas_vizinhanca')}{renderMatrixRow('checklist_matrix', 'Área Uso Comum (Multifamiliar)?', 'area_uso_comum')}{renderCoatingTable()}</div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {wizardStep === 4 && !isHabiteSe && (
                                            <div className="space-y-6 animate-in slide-in-from-right">
                                                {/* REMOVIDO: renderEvidenceSelector() */}
                                                <h4 className="font-bold text-blue-400 text-sm uppercase border-b border-slate-800 pb-2 flex items-center gap-2"><ArrowRightLeft size={16} /> 4. Responsabilidade & Consistência de Dados</h4>
                                                <div className="space-y-6">
                                                    <div className="bg-slate-950 border border-slate-800 rounded p-4"><h5 className="text-xs font-bold text-emerald-400 uppercase mb-3 border-b border-slate-800 pb-1">A) Matriz de Titularidade (QUEM)</h5>{renderComparisonRow("responsibility_matrix", "protocol_vs_deed", "Protocolo", "Escritura/Certidão")}{renderComparisonRow("responsibility_matrix", "protocol_vs_project", "Protocolo", "Proprietário (Planta)")}{renderComparisonRow("responsibility_matrix", "protocol_vs_art", "Protocolo", "Contratante (ART/RRT)")}</div>
                                                    <div className="bg-slate-950 border border-slate-800 rounded p-4"><h5 className="text-xs font-bold text-amber-400 uppercase mb-3 border-b border-slate-800 pb-1">B) Matriz de Localização Detalhada (ONDE)</h5>{renderComparisonRow("responsibility_matrix", "lot_block_compare", "BCI", "Escritura", "Projeto", "Checklist")}{renderComparisonRow("responsibility_matrix", "street_compare", "BCI", "Protocolo", "Checklist", "Projeto")}{renderComparisonRow("responsibility_matrix", "neighborhood_compare", "Todas as Fontes", "Comparação", "Cruzada")}</div>
                                                    <div className="bg-slate-950 border border-slate-800 rounded p-4"><h5 className="text-xs font-bold text-blue-400 uppercase mb-3 border-b border-slate-800 pb-1">C) Matriz de Dimensões (QUANTO)</h5>{renderComparisonRow("responsibility_matrix", "land_area_compare", "Escritura", "Projeto", "BCI")}</div>
                                                    <div className="bg-slate-950 border border-slate-800 rounded p-4"><h5 className="text-xs font-bold text-red-400 uppercase mb-3 border-b border-slate-800 pb-1">D) Validade Documental</h5>{renderCertidaoValidity()}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {auditParams && (
                                        <div className="flex justify-between pt-2">
                                            <Tooltip text="Voltar etapa"><button onClick={prevStep} disabled={wizardStep === 1} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium disabled:opacity-30 flex items-center gap-2"><ArrowLeft size={16} /> Voltar</button></Tooltip>
                                            {canEdit ? (
                                                <Tooltip text={wizardStep === (isHabiteSe ? 3 : 4) ? "Salvar auditoria final" : "Salvar dados e ir para próxima etapa"}>
                                                    <button onClick={nextStep} disabled={savingAudit} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-50">
                                                        {savingAudit ? <Loader2 className="animate-spin" size={16} /> : wizardStep === (isHabiteSe ? 3 : 4) ? <Save size={16} /> : <ArrowRight size={16} />}
                                                        {wizardStep === (isHabiteSe ? 3 : 4) ? 'Finalizar Auditoria' : 'Validar & Avançar'}
                                                    </button>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip text="Apenas visualizar próxima etapa"><button onClick={() => setWizardStep(s => Math.min((isHabiteSe ? 3 : 4), s + 1))} disabled={wizardStep === (isHabiteSe ? 3 : 4)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">Próximo (Visualizar) <ArrowRight size={16} /></button></Tooltip>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'TOUR' && (
                                <TourViewer processId={processId} canEdit={canEdit} />
                            )}

                            {activeTab === 'HISTORY' && (
                                <div className="space-y-4">
                                    {history.length === 0 ? <p className="text-slate-500 text-sm">Nenhum registro histórico.</p> : history.map(h => (
                                        <div key={h.id} className="flex gap-4 p-3 bg-slate-900 border border-slate-800 rounded-lg">
                                            <div className="flex flex-col items-center gap-1 min-w-[60px] border-r border-slate-800 pr-4">
                                                <span className="text-xs text-slate-500">{new Date(h.created_at).toLocaleDateString()}</span>
                                                <span className="text-[10px] font-mono text-slate-600">{new Date(h.created_at).toLocaleTimeString().slice(0, 5)}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-300">{h.action}</p>
                                                {h.user_notes && <p className="text-xs text-slate-500 mt-1 italic">"{h.user_notes}"</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center"><p className="text-[10px] text-slate-600 uppercase tracking-wider">SGLU v1.0 • {new Date().getFullYear()}</p><Tooltip text="Fechar esta janela"><button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded hover:bg-slate-800 transition-colors">Fechar Janela</button></Tooltip></div>
            </div>
        </div>
    );
};
