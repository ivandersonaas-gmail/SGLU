
import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, FileText, Save, Eye, Loader2, MapPin, History, Info, ChevronRight, Maximize2 } from 'lucide-react';
import { parseAuditMarkdown, ParsedAudit, AuditSection, AuditItem } from '../../utils/AuditParser';
import { ProjectParameterService, ProcessService } from '../../services/supabase';
import { useToast } from '../Toast';
import { ProjectParameters, Document } from '../../types';
import { MapViewer } from '../MapViewer';

interface AuditCockpitProps {
    markdown: string;
    processId: string | null;
    onBack: () => void;
}

type TabType = 'CHECKLIST' | 'INFO' | 'GEO' | 'HISTORY';

export const AuditCockpit: React.FC<AuditCockpitProps> = ({ markdown, processId, onBack }) => {
    const [parsedData, setParsedData] = useState<ParsedAudit | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dbParams, setDbParams] = useState<ProjectParameters | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('CHECKLIST');
    const [processInfo, setProcessInfo] = useState<any>(null); // Full process data
    const { addToast } = useToast();

    useEffect(() => {
        const load = async () => {
            if (!processId) return;
            setLoading(true);
            try {
                // 1. Fetch Process & Docs
                const proc = await ProcessService.getById(processId);
                setProcessInfo(proc);
                const docs = await ProcessService.getDocuments(processId);
                setDocuments(docs as Document[]);
                if (docs && docs.length > 0) setSelectedDoc(docs[0] as Document);

                // 2. Fetch Parameters & Audit Data
                const params = await ProjectParameterService.getParameters(processId);
                setDbParams(params as ProjectParameters);

                // 3. Resolve Audit Data Source
                if (markdown) {
                    const newData = parseAuditMarkdown(markdown);
                    setParsedData(newData);
                    addToast('Análise da IA carregada. Revise e Salve.', 'info');
                } else if (params && params.audit_json && (params.audit_json as any).cockpit) {
                    setParsedData((params.audit_json as any).cockpit as ParsedAudit);
                } else {
                    setParsedData({
                        processInfo: {
                            protocolo: proc?.protocol_number || '---',
                            interessado: proc?.applicants?.name || '---',
                            assunto: proc?.type || '---'
                        },
                        sections: []
                    });
                }
            } catch (e) {
                console.error(e);
                addToast("Erro ao carregar dados.", 'error');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [processId, markdown]);

    const handleSave = async () => {
        if (!processId || !parsedData) return;
        setSaving(true);
        try {
            const currentJson = dbParams?.audit_json || {};
            const newJson = {
                ...currentJson,
                cockpit: parsedData,
                steps_validated: { ...(currentJson.steps_validated || {}), cockpit_reviewed: true }
            };

            await ProjectParameterService.upsertParameters({
                process_id: processId,
                audit_json: newJson
            } as ProjectParameters);

            const updated = await ProjectParameterService.getParameters(processId);
            setDbParams(updated);
            addToast("Auditoria salva com sucesso!", 'success');
        } catch (e) {
            console.error(e);
            addToast("Falha ao salvar.", 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateItem = (sectionIdx: number, itemIdx: number, updates: Partial<AuditItem>) => {
        if (!parsedData) return;
        const newSections = [...parsedData.sections];
        const newItem = { ...newSections[sectionIdx].items[itemIdx], ...updates };
        newSections[sectionIdx].items[itemIdx] = newItem;
        setParsedData({ ...parsedData, sections: newSections });
    };

    if (loading && !parsedData) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>Carregando Cockpit...</p>
            </div>
        );
    }

    if (!parsedData) return <div className="p-10 text-center text-slate-400">Nenhum dado de auditoria disponível.</div>;

    const totalItems = parsedData.sections.flatMap(s => s.items).length;
    const okItems = parsedData.sections.flatMap(s => s.items).filter(i => i.status === 'ok').length;
    const progress = totalItems > 0 ? Math.round((okItems / totalItems) * 100) : 0;

    return (
        <div className="flex h-full w-full bg-slate-900 text-slate-100 overflow-hidden">
            {/* LEFT PANEL: DOCUMENT VIEWER (45%) */}
            <div className="w-[45%] border-r border-slate-700 flex flex-col bg-slate-950 relative">
                {/* Docs Header */}
                <div className="h-14 border-b border-slate-700 flex items-center px-4 justify-between bg-slate-900 shadow-sm">
                    <h3 className="font-semibold flex items-center gap-2 text-sm text-slate-200">
                        <FileText size={16} className="text-blue-400" /> Documentos ({documents.length})
                    </h3>
                    <select
                        className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 max-w-[200px] text-slate-300 outline-none focus:border-blue-500"
                        onChange={(e) => {
                            const doc = documents.find(d => d.id === e.target.value);
                            if (doc) setSelectedDoc(doc);
                        }}
                        value={selectedDoc?.id || ''}
                    >
                        {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>

                {/* Docs Viewer */}
                <div className="flex-1 bg-slate-800/50 relative overflow-hidden flex flex-col">
                    {selectedDoc ? (
                        <>
                            {selectedDoc.file_type === 'PROJETO' || selectedDoc.name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                                <img src={selectedDoc.file_url} className="w-full h-full object-contain" alt="Preview" />
                            ) : (
                                <iframe
                                    src={selectedDoc.file_url}
                                    className="w-full h-full border-none bg-white"
                                    title="PDF Viewer"
                                />
                            )}
                            <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur px-3 py-1 rounded text-xs text-white border border-slate-700">
                                {selectedDoc.name}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <FileText size={48} className="opacity-20 mb-4" />
                            <p>Selecione um documento</p>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: AUDIT CHECKLIST & TABS (55%) */}
            <div className="flex-1 flex flex-col bg-slate-900">

                {/* MAIN HEADER */}
                <div className="h-16 border-b border-slate-700 flex items-center px-6 justify-between bg-slate-800 shadow-md z-10 shrink-0">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="truncate">
                            <h1 className="text-base font-bold text-white leading-tight truncate">
                                {parsedData.processInfo.protocolo || processInfo?.protocol_number || 'Novo Processo'}
                            </h1>
                            <p className="text-xs text-slate-400 truncate">
                                {parsedData.processInfo.interessado || processInfo?.applicants?.name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        {/* Status Widget */}
                        <div className="flex flex-col items-end min-w-[120px]">
                            <div className="flex justify-between w-full text-[10px] mb-1 uppercase font-bold text-slate-500">
                                <span>Conformidade</span>
                                <span className={progress === 100 ? 'text-emerald-400' : 'text-blue-400'}>{progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-900/20"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Salvo' : 'Salvar'}
                        </button>
                    </div>
                </div>

                {/* TABS HEADER */}
                <div className="flex px-6 border-b border-slate-800 bg-slate-900/50 shrink-0 overflow-x-auto">
                    <TabButton active={activeTab === 'CHECKLIST'} onClick={() => setActiveTab('CHECKLIST')} icon={<CheckCircle2 size={14} />} label="Checklist de Auditoria" />
                    <TabButton active={activeTab === 'GEO'} onClick={() => setActiveTab('GEO')} icon={<MapPin size={14} />} label="Geo Análise" />
                    <TabButton active={activeTab === 'INFO'} onClick={() => setActiveTab('INFO')} icon={<Info size={14} />} label="Dados do Processo" />
                    <TabButton active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} icon={<History size={14} />} label="Histórico" />
                </div>

                {/* TAB CONTENT AREA */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-900 relative">

                    {activeTab === 'CHECKLIST' && (
                        <div className="space-y-8 pb-20 custom-scrollbar">
                            {parsedData.sections.length === 0 && (
                                <div className="text-center py-20 opacity-50">
                                    <AlertTriangle size={48} className="mx-auto mb-4 text-amber-500" />
                                    <h3 className="text-lg font-bold text-slate-300">Nenhum Item de Auditoria</h3>
                                    <p className="text-sm mt-2">Peça uma análise a IA no chat para preencher este checklist automaticamente.</p>
                                </div>
                            )}

                            {parsedData.sections.map((section, sIdx) => (
                                <div key={sIdx} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 py-2 border-b border-slate-800 mb-4 flex items-center justify-between">
                                        <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            {section.title}
                                        </h2>
                                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{section.items.length} itens</span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {section.items.map((item, iIdx) => (
                                            <AuditItemCard
                                                key={item.id || `${sIdx}-${iIdx}`}
                                                item={item}
                                                onViewDoc={() => { /* Logic to auto-select doc could go here */ }}
                                                onChange={(updates) => handleUpdateItem(sIdx, iIdx, updates)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'GEO' && (
                        <div className="h-full min-h-[400px] border border-slate-800 rounded-xl overflow-hidden">
                            <MapViewer
                                zone={dbParams?.zona_uso}
                                area={dbParams?.area_terreno}
                                address={processInfo?.address_work}
                            />
                        </div>
                    )}

                    {activeTab === 'INFO' && (
                        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 ">
                            <h3 className="font-bold text-white mb-4">Dados Cadastrais</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><label className="text-slate-500 text-xs uppercase">Processo</label><p className="text-slate-300 font-mono">{processInfo?.protocol_number}</p></div>
                                <div><label className="text-slate-500 text-xs uppercase">Tipo</label><p className="text-slate-300">{processInfo?.type}</p></div>
                                <div><label className="text-slate-500 text-xs uppercase">Requerente</label><p className="text-slate-300">{processInfo?.applicants?.name}</p></div>
                                <div><label className="text-slate-500 text-xs uppercase">CPF/CNPJ</label><p className="text-slate-300">{processInfo?.applicants?.cpf}</p></div>
                                <div className="col-span-2"><label className="text-slate-500 text-xs uppercase">Endereço da Obra</label><p className="text-slate-300">{processInfo?.address_work}</p></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'HISTORY' && (
                        <div className="text-center text-slate-500 py-10">
                            <History size={32} className="mx-auto mb-2 opacity-30" />
                            <p>Histórico de movimentações em breve.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- HELPERS ---

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${active ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
    >
        {icon}
        {label}
    </button>
);

interface AuditItemCardProps {
    item: AuditItem;
    onChange: (updates: Partial<AuditItem>) => void;
    onViewDoc: () => void;
}

const AuditItemCard: React.FC<AuditItemCardProps> = ({ item, onChange, onViewDoc }) => {
    const status = item.status;

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'ok': return 'bg-emerald-900/10 border-emerald-500/30 hover:border-emerald-500/50';
            case 'error': return 'bg-red-900/10 border-red-500/30 hover:border-red-500/50';
            case 'warning': return 'bg-amber-900/10 border-amber-500/30 hover:border-amber-500/50';
            default: return 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600';
        }
    };

    const getIcon = (s: string) => {
        switch (s) {
            case 'ok': return <CheckCircle2 className="text-emerald-500" size={18} />;
            case 'error': return <XCircle className="text-red-500" size={18} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={18} />;
            default: return <div className="w-4 h-4 rounded-full border-2 border-slate-600" />;
        }
    };

    return (
        <div className={`group relative p-3 rounded-lg border transition-all duration-200 ${getStatusColor(status)}`}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 cursor-pointer hover:opacity-80" onClick={() => onChange({ status: status === 'ok' ? 'pending' : 'ok' })}>
                    {getIcon(status)}
                </div>

                <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed font-medium transition-colors ${status === 'pending' ? 'text-slate-400' : 'text-slate-200'}`}>
                        {item.text}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <ActionBtn label="Aprovar" active={status === 'ok'} color="text-emerald-400 hover:bg-emerald-500/20" onClick={() => onChange({ status: 'ok' })} />
                        <ActionBtn label="Ressalva" active={status === 'warning'} color="text-amber-400 hover:bg-amber-500/20" onClick={() => onChange({ status: 'warning' })} />
                        <ActionBtn label="Reprovar" active={status === 'error'} color="text-red-400 hover:bg-red-500/20" onClick={() => onChange({ status: 'error' })} />
                    </div>
                </div>

                <button onClick={onViewDoc} className="p-2 text-slate-500 hover:text-blue-400 transition-colors shrink-0 opacity-50 group-hover:opacity-100" title="Ver documento relacionado (IA)">
                    <Eye size={16} />
                </button>
            </div>

            {(status === 'error' || status === 'warning') && (
                <div className="mt-2 pl-7 animate-in slide-in-from-top-1">
                    <textarea
                        value={item.comment || ''}
                        onChange={(e) => onChange({ comment: e.target.value })}
                        className="w-full bg-slate-950/50 border border-slate-700/50 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 placeholder:text-slate-600 resize-none transition-all"
                        placeholder="Descreva a observação técnica..."
                        rows={2}
                    />
                </div>
            )}
        </div>
    );
};

const ActionBtn = ({ label, color, onClick, active }: any) => (
    <button
        onClick={onClick}
        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all border border-transparent ${color} ${active ? 'bg-white/5 border-white/10 shadow-sm ring-1 ring-white/5' : ''}`}
    >
        {label}
    </button>
);
