
import React, { useState } from 'react';
import { X, Save, Loader2, Building, Upload, ShieldCheck, CheckCircle2, FileText, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { ProcessType, PersonType } from '../types';

interface ProcessFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

const PROCESS_TYPES: ProcessType[] = [
  'Licença para Construção', 'Habite-se', 'Alvará de Construção', 'Reforma e Ampliação', 'Desmembramento', 'Demolição', 'Outros'
] as any; 

type ValidationStatus = 'IDLE' | 'VALIDATING' | 'SUCCESS' | 'ERROR';

const ALLOWED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";

export const ProcessFormModal: React.FC<ProcessFormModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  
  // Estado de Validação mais robusto para melhor UX
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('IDLE');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const [personType, setPersonType] = useState<PersonType>('PF');
  
  const [files, setFiles] = useState<{
      personal: File[],
      project: File[],
      technical: File[]
  }>({ personal: [], project: [], technical: [] });

  const [formData, setFormData] = useState({
    name: '', cpf: '', phone: '', address: '', type: 'Licença para Construção' as ProcessType
  });

  if (!isOpen) return null;

  const handleFile = (key: keyof typeof files) => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles = Array.from(e.target.files);
          setFiles(prev => ({ ...prev, [key]: newFiles }));
          // Resetamos para IDLE para forçar nova validação se o usuário mudar arquivos
          if (validationStatus !== 'IDLE') {
             setValidationStatus('IDLE');
             setValidationErrors([]);
          }
      }
  };

  const clearFiles = (key: keyof typeof files) => {
      setFiles(prev => ({ ...prev, [key]: [] }));
      setValidationStatus('IDLE');
  };

  const runSmartValidation = () => {
      setValidationStatus('VALIDATING');
      setValidationErrors([]);

      // Simula o tempo de processamento da IA (UX: sensação de análise)
      setTimeout(() => {
          const errors: string[] = [];

          // Regras de Validação da "IA"
          if (files.personal.length === 0) {
              errors.push("Documentação Pessoal/Propriedade ausente.");
          }
          
          // Regra flexível: Se for 'Certidão' ou '2a Via', talvez não precise de projeto.
          // Mas para Licença de Construção, precisa.
          const needsProject = !formData.type.includes('Certidão') && !formData.type.includes('2ª Via');
          
          if (needsProject && files.project.length === 0) {
              errors.push("Projeto Arquitetônico não anexado.");
          }

          if (needsProject && files.technical.length === 0) {
              errors.push("ART/RRT de Responsabilidade Técnica ausente.");
          }

          // Verifica consistência básica
          if (formData.cpf.length < 11) {
             errors.push("CPF/CNPJ parece inválido.");
          }

          if (errors.length > 0) {
              setValidationErrors(errors);
              setValidationStatus('ERROR');
          } else {
              setValidationStatus('SUCCESS');
          }
      }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validationStatus !== 'SUCCESS') {
        // Se tentar enviar sem validar ou com erro, roda a validação e mostra o erro
        runSmartValidation();
        return;
    }
    
    try {
      setLoading(true);
      await onSubmit({
        ...formData,
        personType,
        files: files
      });
      handleClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
      onClose();
      // Reset total
      setFormData({ name: '', cpf: '', phone: '', address: '', type: 'Licença para Construção' });
      setFiles({ personal: [], project: [], technical: [] });
      setValidationStatus('IDLE');
      setValidationErrors([]);
  };

  const renderFileSummary = (fileList: File[], key: keyof typeof files) => {
      if (fileList.length === 0) return null;
      return (
          <div className="mt-2 bg-slate-900 rounded p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase border-b border-slate-800 pb-1 mb-1">
                  <span>{fileList.length} Arquivo(s)</span>
                  <button type="button" onClick={() => clearFiles(key)} className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
              </div>
              {fileList.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300 truncate">
                      <FileText size={12} className="text-blue-500 shrink-0" />
                      <span className="truncate">{f.name}</span>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl relative animate-in zoom-in duration-200 my-auto">
        
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900 rounded-t-2xl sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Building className="text-blue-500" size={24}/>
              Novo Protocolo Digital
            </h3>
            <p className="text-slate-400 text-sm">Preenchimento e Auditoria de Entrada</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: DATA */}
          <div className="space-y-6">
              <div className="flex p-1 bg-slate-950 rounded-lg border border-slate-800">
                <button type="button" onClick={() => setPersonType('PF')} className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${personType === 'PF' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Pessoa Física</button>
                <button type="button" onClick={() => setPersonType('PJ')} className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${personType === 'PJ' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Pessoa Jurídica</button>
              </div>

              <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-sm font-bold text-slate-300 uppercase">Dados do Requerimento</h4>
                  
                  <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">CPF / CNPJ</label>
                      <input type="text" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="Digite apenas números" className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white text-sm focus:border-blue-500 outline-none transition-colors" required />
                  </div>
                  
                  <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">Nome Completo / Razão Social</label>
                      <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: João da Silva" className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white text-sm focus:border-blue-500 outline-none transition-colors" required />
                  </div>
                  
                  <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">Endereço da Obra</label>
                      <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Rua, Número, Bairro" className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white text-sm focus:border-blue-500 outline-none transition-colors" required />
                  </div>
                  
                  <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">Tipo de Processo</label>
                      <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white text-sm focus:border-blue-500 outline-none transition-colors">
                          {PROCESS_TYPES.map((t, i) => <option key={i} value={t}>{t}</option>)}
                      </select>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: UPLOADS & VALIDATION */}
          <div className="space-y-6 flex flex-col h-full">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4 flex-1">
                  <h4 className="text-sm font-bold text-slate-300 uppercase flex items-center gap-2">
                      <Upload size={16} /> Documentação Obrigatória
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {/* DOC PESSOAL */}
                    <div className={`border border-dashed rounded p-3 transition-colors ${files.personal.length > 0 ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-700 hover:bg-slate-900'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <p className={`text-xs font-bold ${files.personal.length > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>1. Documentos Pessoais & Propriedade</p>
                            {files.personal.length > 0 && <CheckCircle2 size={14} className="text-emerald-500"/>}
                        </div>
                        <input 
                            type="file" multiple 
                            accept={ALLOWED_FILE_TYPES}
                            onChange={handleFile('personal')} 
                            className="text-xs text-slate-500 w-full file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 cursor-pointer" 
                        />
                        {renderFileSummary(files.personal, 'personal')}
                    </div>

                    {/* PROJETO */}
                    <div className={`border border-dashed rounded p-3 transition-colors ${files.project.length > 0 ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-700 hover:bg-slate-900'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <p className={`text-xs font-bold ${files.project.length > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>2. Projeto Arquitetônico</p>
                            {files.project.length > 0 && <CheckCircle2 size={14} className="text-emerald-500"/>}
                        </div>
                        <input 
                            type="file" multiple 
                            accept={ALLOWED_FILE_TYPES}
                            onChange={handleFile('project')} 
                            className="text-xs text-slate-500 w-full file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 cursor-pointer" 
                        />
                        {renderFileSummary(files.project, 'project')}
                    </div>

                    {/* ART */}
                    <div className={`border border-dashed rounded p-3 transition-colors ${files.technical.length > 0 ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-700 hover:bg-slate-900'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <p className={`text-xs font-bold ${files.technical.length > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>3. Resp. Técnica (ART/RRT)</p>
                            {files.technical.length > 0 && <CheckCircle2 size={14} className="text-emerald-500"/>}
                        </div>
                        <input 
                            type="file" multiple 
                            accept={ALLOWED_FILE_TYPES}
                            onChange={handleFile('technical')} 
                            className="text-xs text-slate-500 w-full file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 cursor-pointer" 
                        />
                        {renderFileSummary(files.technical, 'technical')}
                    </div>
                  </div>
              </div>

              {/* VALIDATION FEEDBACK BOX (UX IMPROVED) */}
              <div className={`p-4 rounded-xl border transition-all duration-300 ${
                  validationStatus === 'IDLE' ? 'bg-blue-900/10 border-blue-800/30' :
                  validationStatus === 'VALIDATING' ? 'bg-blue-900/20 border-blue-500/50' :
                  validationStatus === 'SUCCESS' ? 'bg-emerald-900/20 border-emerald-800' :
                  'bg-red-900/20 border-red-800'
              }`}>
                  {validationStatus === 'IDLE' && (
                      <div className="text-center">
                          <ShieldCheck size={32} className="mx-auto text-blue-500 mb-2 opacity-50" />
                          <p className="text-sm text-blue-200 font-medium mb-3">Aguardando Validação Prévia</p>
                          <button 
                              type="button" 
                              onClick={runSmartValidation} 
                              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm flex justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                          >
                              Executar Validação com IA
                          </button>
                      </div>
                  )}

                  {validationStatus === 'VALIDATING' && (
                      <div className="text-center py-2">
                          <Loader2 size={32} className="mx-auto text-blue-400 animate-spin mb-2" />
                          <p className="text-sm font-bold text-blue-300">Analisando documentação...</p>
                          <p className="text-xs text-blue-400/70 mt-1">Verificando completude e consistência.</p>
                      </div>
                  )}

                  {validationStatus === 'SUCCESS' && (
                      <div className="flex items-start gap-3 animate-in fade-in">
                          <div className="bg-emerald-900/50 p-2 rounded-full"><CheckCircle2 className="text-emerald-400" size={24} /></div>
                          <div>
                              <h4 className="font-bold text-emerald-400 text-sm">Documentação Aprovada</h4>
                              <p className="text-xs text-emerald-300/80 mt-1">
                                  • Todos os grupos obrigatórios possuem arquivos.<br/>
                                  • Protocolo pronto para ser gerado.
                              </p>
                          </div>
                      </div>
                  )}

                  {validationStatus === 'ERROR' && (
                      <div className="animate-in shake">
                          <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="text-red-500" size={20} />
                              <h4 className="font-bold text-red-400 text-sm">Pendências Encontradas</h4>
                          </div>
                          <ul className="space-y-1 mb-3">
                              {validationErrors.map((err, i) => (
                                  <li key={i} className="text-xs text-red-300 flex items-start gap-2">
                                      <span className="mt-0.5">•</span> {err}
                                  </li>
                              ))}
                          </ul>
                          <button 
                              type="button" 
                              onClick={runSmartValidation} 
                              className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-800 rounded-lg font-bold text-xs flex justify-center gap-2 transition-all"
                          >
                              Re-executar Validação
                          </button>
                      </div>
                  )}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                  <button type="button" onClick={handleClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">Cancelar</button>
                  <button 
                    type="submit" 
                    disabled={validationStatus !== 'SUCCESS' || loading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Gerar Protocolo Oficial
                  </button>
              </div>
          </div>
        </form>
      </div>
    </div>
  );
};
