
import React, { useEffect, useState, useMemo } from 'react';
import { LegislationService } from '../services/supabase';
import { LegislationFile, UserProfile, UserRole } from '../types';
import { BookOpen, Upload, Trash2, FileText, Loader2, ExternalLink, ShieldCheck, Plus, X, Lock } from 'lucide-react';
import { useToast } from './Toast';

interface LegislationPanelProps {
    userProfile: UserProfile | null;
}

// Categorias padrão do sistema (sempre aparecem)
const DEFAULT_CATEGORIES = ['ZONEAMENTO', 'CODIGO_OBRAS', 'PLANO_DIRETOR', 'AMBIENTAL'];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const LegislationPanel: React.FC<LegislationPanelProps> = ({ userProfile }) => {
  const [laws, setLaws] = useState<LegislationFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // State para controlar input de nova categoria
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  
  const { addToast } = useToast();

  const [newLaw, setNewLaw] = useState({
      name: '',
      category: 'ZONEAMENTO',
      customCategory: '',
      description: '',
      file: null as File | null
  });

  const isAdmin = userProfile?.role === UserRole.ADMIN;

  useEffect(() => {
    loadLaws();
  }, []);

  const loadLaws = async () => {
    try {
      setLoading(true);
      const data = await LegislationService.listLaws();
      setLaws(data);
    } catch (e: any) {
      addToast("Erro ao carregar leis: " + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calcula as categorias disponíveis baseando-se nas Padrão + As que já existem no banco
  const availableCategories = useMemo(() => {
      const existingCats = laws.map(l => l.category);
      // Remove duplicatas e une com as padrão
      return Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCats])).sort();
  }, [laws]);

  const handleUpload = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isAdmin) return; // Segurança Extra
      if (!newLaw.file || !newLaw.name) return;

      if (newLaw.file.size > MAX_FILE_SIZE) {
          addToast("Arquivo muito grande. O limite é 50MB. Por favor, comprima o PDF.", 'error');
          return;
      }
      
      // Define qual categoria usar (a do select ou a digitada manualmente)
      const finalCategory = isCustomCategory ? newLaw.customCategory.toUpperCase().trim().replace(/\s+/g, '_') : newLaw.category;

      if (!finalCategory) {
          addToast("Defina uma categoria válida.", 'error');
          return;
      }

      setUploading(true);
      try {
          await LegislationService.uploadLaw(newLaw.file, newLaw.name, finalCategory, newLaw.description);
          addToast("Documento legal adicionado com sucesso.", 'success');
          setNewLaw({ name: '', category: 'ZONEAMENTO', customCategory: '', description: '', file: null });
          setIsCustomCategory(false); // Reset
          loadLaws();
      } catch (e: any) {
          addToast("Erro no upload: " + e.message, 'error');
      } finally {
          setUploading(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (!isAdmin) return;
      if (!confirm("Tem certeza? Isso pode afetar análises futuras.")) return;
      try {
          await LegislationService.deleteLaw(id);
          addToast("Documento removido.", 'success');
          loadLaws();
      } catch (e: any) {
          addToast("Erro ao remover: " + e.message, 'error');
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 overflow-hidden">
        <div className="mb-6 flex justify-between items-end">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <BookOpen className="text-emerald-500" size={28} />
                    Biblioteca de Legislação & Parâmetros
                </h1>
                <p className="text-slate-400 mt-1">
                    Repositório oficial (Fonte da Verdade) para auditoria de projetos pela IA.
                </p>
            </div>
            {!isAdmin && (
                <div className="flex items-center gap-2 text-slate-500 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                    <Lock size={14} />
                    Modo Leitura (Apenas Admin pode editar)
                </div>
            )}
        </div>

        <div className={isAdmin ? "grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden" : "flex flex-col h-full overflow-hidden"}>
            {/* Upload Form (ONLY ADMIN) */}
            {isAdmin && (
                <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit overflow-y-auto">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Upload size={18} className="text-blue-500"/> Adicionar Nova Norma
                    </h3>
                    <form onSubmit={handleUpload} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Título da Lei/Norma</label>
                            <input 
                                type="text" required 
                                value={newLaw.name}
                                onChange={e => setNewLaw({...newLaw, name: e.target.value})}
                                placeholder="Ex: Código de Obras 2024"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm mt-1 focus:border-emerald-500 outline-none"
                            />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                                Categoria
                                {isCustomCategory && (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCustomCategory(false)}
                                        className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                        <X size={10} /> Cancelar
                                    </button>
                                )}
                            </label>
                            
                            {!isCustomCategory ? (
                                <select 
                                    value={newLaw.category}
                                    onChange={e => {
                                        if (e.target.value === 'NEW_CUSTOM') {
                                            setIsCustomCategory(true);
                                            setNewLaw({...newLaw, customCategory: ''});
                                        } else {
                                            setNewLaw({...newLaw, category: e.target.value});
                                        }
                                    }}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm mt-1 focus:border-emerald-500 outline-none"
                                >
                                    {availableCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                                    ))}
                                    <option disabled>──────────</option>
                                    <option value="NEW_CUSTOM" className="text-emerald-400 font-bold">+ Nova Categoria...</option>
                                </select>
                            ) : (
                                <div className="mt-1 relative">
                                    <input 
                                        type="text" autoFocus
                                        value={newLaw.customCategory}
                                        onChange={e => setNewLaw({...newLaw, customCategory: e.target.value})}
                                        placeholder="Digite o nome da nova categoria..."
                                        className="w-full bg-slate-950 border border-emerald-500 rounded-lg p-2 text-white text-sm outline-none ring-1 ring-emerald-500/50"
                                    />
                                    <div className="text-[10px] text-slate-500 mt-1">Será salva em maiúsculas (ex: DECRETO_2025)</div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Descrição (Opcional)</label>
                            <textarea 
                                value={newLaw.description}
                                onChange={e => setNewLaw({...newLaw, description: e.target.value})}
                                placeholder="Breve resumo do que esta lei trata..."
                                rows={2}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm mt-1 focus:border-emerald-500 outline-none resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Arquivo PDF (Máx 50MB)</label>
                            <input 
                                type="file" required accept=".pdf"
                                onChange={e => setNewLaw({...newLaw, file: e.target.files?.[0] || null})}
                                className="w-full text-xs text-slate-400 mt-1 file:bg-slate-800 file:text-slate-200 file:border-0 file:mr-2 file:py-2 file:px-4 file:rounded-full hover:file:bg-slate-700 cursor-pointer"
                            />
                        </div>

                        <button 
                            type="submit" disabled={uploading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 mt-4 shadow-lg shadow-emerald-900/20"
                        >
                            {uploading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                            Salvar na Base de Conhecimento
                        </button>
                    </form>
                </div>
            )}

            {/* Laws List (Full Width if not Admin) */}
            <div className={`${isAdmin ? 'lg:col-span-2' : 'w-full'} bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden`}>
                <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-300 text-sm uppercase">Normas Vigentes ({laws.length})</h3>
                    <span className="text-xs text-slate-500">{availableCategories.length} Categorias</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-500"/></div>
                    ) : laws.length === 0 ? (
                        <p className="text-slate-500 text-center p-10">Nenhuma lei cadastrada. A IA não terá parâmetros para auditar.</p>
                    ) : (
                        laws.map(law => (
                            <div key={law.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg group hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="p-2 bg-slate-900 rounded text-emerald-500 shrink-0"><FileText size={20} /></div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-200 text-sm truncate">{law.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 uppercase whitespace-nowrap">{law.category.replace(/_/g, ' ')}</span>
                                            {law.description && <span className="text-[10px] text-slate-600 truncate max-w-[200px] hidden sm:inline-block">- {law.description}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <a href={law.file_url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-blue-400 transition-colors" title="Abrir Documento"><ExternalLink size={16} /></a>
                                    {isAdmin && (
                                        <button onClick={() => handleDelete(law.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors" title="Remover"><Trash2 size={16} /></button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
