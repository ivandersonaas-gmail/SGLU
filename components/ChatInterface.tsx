
import React, { useState, useRef, useEffect } from 'react';
import { AgentMode, Role, AttachmentData, ChatInterfaceProps, Message } from '../types';
import { useAgent } from '../hooks/useAgent';
import { ProcessService, ProjectParameterService } from '../services/supabase';
import { PdfService } from '../services/pdf';
import { Send, Paperclip, Loader2, Bot, FileText, Zap, Search, Scale, Ruler, ExternalLink, AlertCircle, Home, Building, Factory, Hammer, Gavel } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Tooltip } from './Tooltip';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 
  'image/png', 
  'image/webp', 
  'application/pdf',
  'application/x-pdf', 
  'binary/octet-stream' 
];

const QUICK_ACTIONS = [
    { label: "🏡 Loteamento", id: "LOTEAMENTO", icon: <Home size={14} className="text-emerald-400"/> },
    { label: "🏢 Edificações", id: "EDIFICACOES", icon: <Building size={14} className="text-blue-400"/> },
    { label: "🏭 Comercial", id: "COMERCIAL", icon: <Factory size={14} className="text-amber-400"/> },
    { label: "🛠️ Reforma", id: "REFORMA", icon: <Hammer size={14} className="text-purple-400"/> },
    { label: "⚖️ Regularização", id: "GENERAL", icon: <Gavel size={14} className="text-slate-400"/> }
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ mode, messages: initialMessages, setMessages: setGlobalMessages, processId }) => {
  const [input, setInput] = useState('');
  const [highPrecision, setHighPrecision] = useState(true); 
  const [selectedAttachments, setSelectedAttachments] = useState<AttachmentData[]>([]);
  const [activeSpecialty, setActiveSpecialty] = useState<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeProcessName, setActiveProcessName] = useState<string>('');
  
  const prevProcessIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevProcessIdRef.current !== processId) {
        if (processId) {
            setGlobalMessages([]); 
            loadProcessContextName(processId);
        } else {
            setActiveProcessName('');
        }
        prevProcessIdRef.current = processId;
    }
  }, [processId]);

  const loadProcessContextName = async (id: string) => {
      try {
          const p: any = await ProcessService.getById(id);
          if (p) setActiveProcessName(`Processo #${p.protocol_number} - ${p.applicants?.name}`);
      } catch (e) { console.error(e); }
  };

  const toolHandlers = {
    listProcesses: async () => "Ferramenta desativada.",
    getProcessDetails: async () => "Ferramenta desativada.",
    createProcess: async () => "Ferramenta desativada.",
    updateProcessStatus: async () => "Ferramenta desativada.",
    saveTechnicalNote: async () => "Ferramenta desativada.",
    saveAuditParameters: async (args: any) => {
        try {
            const { protocol_number, compliance_status, summary, audit_json } = args;
            const processes: any = await ProcessService.getAll();
            const cleanProto = protocol_number ? protocol_number.replace(/[^0-9]/g, '') : '';
            const found = processes.find((p: any) => p.protocol_number.replace(/[^0-9]/g, '') === cleanProto);
            if (!found) return `Processo ${protocol_number} não encontrado.`;
            await ProjectParameterService.upsertParameters({
                process_id: found.id,
                status_compliance: compliance_status, 
                ai_validation_summary: summary, 
                audit_json
            });
            return "✅ AUDITORIA SALVA!";
        } catch (e: any) { return "Erro: " + e.message; }
    }
  };

  const agent = useAgent({ mode, initialMessages, processId, toolHandlers });

  useEffect(() => { setGlobalMessages(agent.messages); }, [agent.messages, setGlobalMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [agent.messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedAttachments(prev => [...prev, { data: (reader.result as string).split(',')[1], mimeType: file.type || 'application/octet-stream', name: file.name }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleQuickActionWrapper = async (specialtyId: string, label: string) => {
     if (!processId) return;
     setActiveSpecialty(specialtyId);

     try {
         agent.setLoadingStatus(`📥 Ativando Lente: ${label}...`);
         
         const activeProcess: any = await ProcessService.getById(processId);
         const docsMeta: any[] = await ProcessService.getDocuments(processId);

         if (!docsMeta || docsMeta.length === 0) {
             agent.setLoadingStatus(null);
             handleSubmit(undefined, "⚠️ Este processo não tem documentos anexados.");
             return;
         }

         const uniqueDocsMap = new Map();
         const sortedDocs = [...docsMeta].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
         sortedDocs.forEach(doc => {
             const key = `${doc.file_type}_${doc.name.toLowerCase()}`;
             if (!uniqueDocsMap.has(key)) uniqueDocsMap.set(key, doc);
         });
         
         const targetDocs = Array.from(uniqueDocsMap.values());
         agent.setLoadingStatus(`📂 Lendo ${targetDocs.length} documentos técnicos...`);

         const rawFiles = await Promise.all(targetDocs.map(async d => {
             try {
                 const f = await ProcessService.downloadFileFromUrl(d.file_url);
                 return {...f, name: d.name, type: d.file_type, id: d.id, error: false};
             } catch (e) {
                 return { data: '', mimeType: 'application/error', name: d.name, type: d.file_type, id: d.id, error: true };
             }
         }));

         let extractedTextContext = "";
         const visualAttachments: AttachmentData[] = [];
         const MAX_VISUAL_FILES = 40;

         for (const file of rawFiles) {
             if (file.error) continue;

             const isVisual = file.type === 'PROJETO' || file.name.toLowerCase().includes('planta') || file.mimeType.startsWith('image/');

             if (isVisual && visualAttachments.length < MAX_VISUAL_FILES) {
                visualAttachments.push({ data: file.data, mimeType: file.mimeType, name: file.name });
                extractedTextContext += `\n[PLANTA/PROJETO: ${file.name}]\n`;
             } else if (file.mimeType.includes('pdf')) {
                const text = await PdfService.extractTextFromBase64(file.data);
                if (text && text.trim().length > 20) {
                    extractedTextContext += `\n--- DOC: ${file.name} ---\n${text}\n`;
                } else if (visualAttachments.length < MAX_VISUAL_FILES) {
                    visualAttachments.push({ data: file.data, mimeType: file.mimeType, name: file.name });
                }
             }
         }

         agent.setLoadingStatus(`🕵️ Auditoria Especializada (${label})...`);

         const contextHeader = `
[CONTEXTO TÉCNICO]
Protocolo: ${activeProcess.protocol_number}
Requerente: ${activeProcess.applicants?.name}
Lente Ativa: ${label}

[DADOS EXTRAÍDOS]
${extractedTextContext.substring(0, 900000)} 

POR FAVOR, REALIZE A AUDITORIA COMPLETA BASEADO NA LENTE ${label} E NO MÓDULO A.`;

         const userMsg: Message = {
             id: Date.now().toString(),
             role: Role.USER,
             text: `Executar Auditoria: ${label}`, 
             attachments: visualAttachments,
             timestamp: Date.now()
         };

         agent.addMessage(userMsg);
         agent.processMessage(contextHeader, visualAttachments, [...agent.messages, userMsg], false, specialtyId);

     } catch (e: any) {
         agent.setLoadingStatus(null);
         handleSubmit(undefined, "Erro: " + e.message);
     }
  };

  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || input.trim();
    if ((!textToSend && selectedAttachments.length === 0) || agent.isStreaming) return;

    const currentAttachments = [...selectedAttachments];
    setInput('');
    setSelectedAttachments([]);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: textToSend,
      attachments: currentAttachments,
      timestamp: Date.now()
    };

    agent.addMessage(userMessage);
    agent.processMessage(textToSend, currentAttachments, [...agent.messages, userMessage], highPrecision, activeSpecialty);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!processId) {
      return (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500 p-10">
              <AlertCircle size={48} className="mb-4 opacity-50"/>
              <h2 className="text-xl font-bold text-slate-300">Nenhum Processo Selecionado</h2>
              <p className="max-w-md text-center mt-2">Escolha um processo no Dashboard para iniciar a auditoria técnica.</p>
          </div>
      );
  }

  return (
    <div className="flex-1 flex h-full relative bg-slate-950 overflow-hidden">
      <div className="flex-1 flex flex-col h-full relative z-0">
        <div className="absolute top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-10">
          <div>
            <h2 className="font-semibold text-slate-200 flex items-center gap-2"><Bot size={18} className="text-amber-400"/> Auditor Virtual</h2>
            {activeProcessName && <p className="text-xs text-blue-400 font-medium ml-6">{activeProcessName}</p>}
          </div>
          {agent.loadingStatus ? <div className="flex items-center gap-2 text-xs font-bold text-amber-400 animate-pulse bg-amber-900/20 px-3 py-1 rounded-full border border-amber-500/30"><Loader2 size={12} className="animate-spin"/> {agent.loadingStatus}</div> : <div className="text-xs text-slate-500">Pronto para Analisar</div>}
        </div>

        <div className="flex-1 overflow-y-auto pt-20 pb-48 px-4 md:px-10 space-y-6">
          {agent.messages.length === 0 && (
               <div className="text-center py-20 opacity-50">
                   <Search size={48} className="mx-auto text-slate-600 mb-4"/>
                   <p className="text-slate-400">Selecione uma <strong>Lente Especialista</strong> abaixo para auditar este processo.</p>
               </div>
          )}
          {agent.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
              {msg.role === Role.MODEL && <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-amber-600"><Bot size={16} className="text-white" /></div>}
              <div className={`flex flex-col gap-2 max-w-[85%] md:max-w-[75%]`}>
                <div className={`px-5 py-3.5 rounded-2xl shadow-sm ${msg.role === Role.USER ? 'bg-slate-800 text-slate-100 rounded-tr-sm' : 'bg-slate-900/50 border border-slate-800 text-slate-200 rounded-tl-sm'}`}>
                  {msg.role === Role.MODEL ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                  ) : <p className="whitespace-pre-wrap text-sm">{msg.text}</p>}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-20">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_ACTIONS.map((action, i) => (
                    <button key={i} onClick={() => handleQuickActionWrapper(action.id, action.label)} className={`flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-sm ${activeSpecialty === action.id ? 'border-amber-500 text-amber-400 ring-1 ring-amber-500/20' : 'border-slate-700 text-slate-300'}`} disabled={agent.isStreaming}>{action.icon}{action.label}</button>
                ))}
            </div>
            
            <form onSubmit={(e) => handleSubmit(e)} className="relative group">
              <div className="relative flex items-end gap-2 bg-slate-900 border border-slate-700 p-2 rounded-xl focus-within:border-blue-500/50 transition-all shadow-xl">
                <label className="p-2 mb-0.5 text-slate-400 hover:text-blue-400 cursor-pointer transition-colors rounded-lg hover:bg-slate-800"><Paperclip size={20} /><input type="file" multiple className="hidden" onChange={handleFileUpload} accept={ALLOWED_MIME_TYPES.join(',')} /></label>
                <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Pergunte algo sobre o processo..." className="w-full bg-transparent border-none text-slate-200 placeholder-slate-500 focus:ring-0 resize-none py-3 max-h-[200px] min-h-[44px] overflow-y-auto" rows={1} />
                <div className="flex items-center gap-2 pb-1">
                    <button type="submit" disabled={(!input.trim() && selectedAttachments.length === 0) || agent.isStreaming} className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-all shadow-lg">{agent.isStreaming ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
