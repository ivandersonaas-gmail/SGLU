
import React, { useEffect, useState, useRef } from 'react';
import { AdminService, TemplateService } from '../services/supabase';
import { UserProfile, UserRole } from '../types';
import { useToast } from './Toast';
import { Loader2, Save, FileImage, Upload, Settings, FileText, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Table as TableIcon, PenTool, Layout, Plus, Lock } from 'lucide-react';

interface DocumentTemplatesProps {
    userProfile: UserProfile | null;
}

export const DocumentTemplates: React.FC<DocumentTemplatesProps> = ({ userProfile }) => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TEMPLATES'>('TEMPLATES');
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);

  // Template State
  const [selectedTemplate, setSelectedTemplate] = useState<'HABITE_SE' | 'ALVARA' | 'ANUENCIA'>('ALVARA');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sigMargin, setSigMargin] = useState(50); // Default margin for signatures
  
  // Editor State
  const editorRef = useRef<HTMLDivElement>(null);
  // REF para salvar a posição do cursor (Range)
  const savedRange = useRef<Range | null>(null);
  
  const { addToast } = useToast();

  const isAllowed = userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.LICENCIAMENTO;

  if (!isAllowed) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-red-500">
              <Lock size={48} className="mb-4" />
              <h1 className="text-2xl font-bold">ACESSO NEGADO</h1>
              <p className="text-slate-400 mt-2">Apenas Admin e Licenciamento podem acessar os modelos.</p>
          </div>
      );
  }

  useEffect(() => {
    loadSettings();
    if (activeTab === 'TEMPLATES') loadTemplate(selectedTemplate);
  }, [activeTab]);

  const loadSettings = () => {
      const url = AdminService.getTemplateBackgroundUrl();
      const img = new Image();
      img.src = url;
      img.onload = () => setBgPreview(url);
      setLoading(false);
  };

  const loadTemplate = async (type: any) => {
      setLoading(true);
      try {
          const tmpl = await TemplateService.getTemplate(type);
          const content = tmpl ? tmpl.content : getDefaultTemplate(type);
          
          if (editorRef.current) {
              editorRef.current.innerHTML = content;
          }
      } catch (e: any) {
          if (!e.message.includes('TABELA INEXISTENTE')) {
             addToast("Erro ao carregar modelo: " + e.message, 'error');
          }
          const def = getDefaultTemplate(type);
          if(editorRef.current) editorRef.current.innerHTML = def;
      } finally {
          setLoading(false);
      }
  };

  const handleTemplateSave = async () => {
      if (!editorRef.current) return;
      setSavingTemplate(true);
      try {
          const html = editorRef.current.innerHTML;
          await TemplateService.saveTemplate(selectedTemplate, html);
          addToast("Modelo salvo com sucesso!", 'success');
      } catch (e: any) {
          addToast("Erro ao salvar: " + e.message, 'error');
      } finally {
          setSavingTemplate(false);
      }
  };

  // --- EDITOR FUNCTIONS ---

  // Função para salvar a posição do cursor sempre que o usuário interagir com o editor
  const saveRange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          // Só salva se o cursor estiver DENTRO do editor
          if (editorRef.current?.contains(range.commonAncestorContainer)) {
              savedRange.current = range.cloneRange();
          }
      }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
      // Restaura foco antes de executar
      if (savedRange.current) {
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(savedRange.current);
      }
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      saveRange(); // Salva nova posição
  };

  const insertAtCursor = (html: string) => {
      // 1. Tenta restaurar a seleção salva
      const selection = window.getSelection();
      if (savedRange.current) {
          selection?.removeAllRanges();
          selection?.addRange(savedRange.current);
      }

      if (!selection || !selection.rangeCount) {
          // Fallback: Se não tiver seleção, foca no editor e tenta de novo ou anexa ao final
          editorRef.current?.focus();
          // Não retorna, tenta inserir mesmo assim
      }
      
      let range: Range;
      if (selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
      } else {
          // Se falhar tudo, cria range no final do editor
          range = document.createRange();
          range.selectNodeContents(editorRef.current!);
          range.collapse(false);
      }

      // Garante que estamos dentro do editor
      if (!editorRef.current?.contains(range.commonAncestorContainer)) return;

      range.deleteContents();
      const div = document.createElement('div');
      div.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node, lastNode;
      while ((node = div.firstChild)) {
          lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      
      if (lastNode) {
          range.setStartAfter(lastNode);
          range.setEndAfter(lastNode);
          selection?.removeAllRanges();
          selection?.addRange(range);
          // Atualiza a referência salva
          savedRange.current = range.cloneRange();
      }
  };

  const insertTag = (tag: string) => {
      insertAtCursor(tag);
  };

  const insertTable = () => {
      const rows = prompt("Número de Linhas:", "3");
      const cols = prompt("Número de Colunas:", "2");
      if (!rows || !cols) return;
      
      let html = '<table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin: 10px 0;"><tbody>';
      for(let i=0; i<parseInt(rows); i++) {
          html += '<tr>';
          for(let j=0; j<parseInt(cols); j++) {
              html += '<td style="border: 1px solid black; padding: 8px;">Texto</td>';
          }
          html += '</tr>';
      }
      html += '</tbody></table><p><br></p>';
      insertAtCursor(html);
  };

  const insertSignatureBlock = () => {
      const count = prompt("Quantas assinaturas?", "2");
      if (!count) return;
      const num = parseInt(count);
      
      let html = `<div class="signatures-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: ${sigMargin}px; page-break-inside: avoid; width: 100%;">`;
      
      for(let i=0; i<num; i++) {
          html += `
            <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
                <div style="border-top: 1px solid black; margin-bottom: 2px; width: 80%;"></div>
                <div style="font-weight:bold; font-size: 11pt; line-height: 1.1; margin: 0; padding: 0;">NOME DO SIGNATÁRIO</div>
                <div style="font-size: 9pt; line-height: 1.1; margin: 0; padding: 0;">Cargo / Função</div>
                <div style="font-size: 8pt; line-height: 1.1; margin-top: 2px; padding: 0;">Portaria nº ...</div>
            </div>
          `;
      }
      html += '</div><p><br></p>';
      insertAtCursor(html);
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      try {
          setUploadingBg(true);
          const url = await AdminService.uploadTemplateBackground(file);
          setBgPreview(url);
          addToast("Papel Timbrado atualizado com sucesso!", 'success');
      } catch (err: any) {
          addToast("Erro no upload: " + err.message, 'error');
      } finally {
          setUploadingBg(false);
      }
  };

  const getDefaultTemplate = (type: string) => {
      if (type === 'HABITE_SE') return `<p style="text-align: center; font-size: 18px; font-weight: bold;">HABITE-SE Nº #PROTOCOLO</p><p><br></p><p style="text-align: justify;">Pelo presente, certifica-se que o imóvel de propriedade de <strong>#PROPRIETARIO</strong> (#CPF_CNPJ), situado à <strong>#ENDERECO</strong>, encontra-se concluído em conformidade com o projeto aprovado e em condições de habitabilidade.</p><p style="text-align: justify;">Dados Técnicos:<br>Área Construída: <strong>#AREA</strong> m²<br>Responsável Técnico: #NOME_RESP</p><p><br></p><p style="text-align: center;">Petrolina/PE, #DATA</p>`;
      if (type === 'ALVARA') return `<p style="text-align: center; font-size: 18px; font-weight: bold;">ALVARÁ DE CONSTRUÇÃO Nº #PROTOCOLO</p><p><br></p><p style="text-align: justify;">Autoriza-se o Sr(a). <strong>#PROPRIETARIO</strong>, portador do documento <strong>#CPF_CNPJ</strong>, a realizar a construção no endereço <strong>#ENDERECO</strong>.</p><p style="text-align: justify;">Responsável Técnico pelo Projeto: <strong>#NOME_AUTOR</strong>.<br>Responsável Técnico pela Execução: <strong>#NOME_RESP</strong>.</p><p><br></p><p style="text-align: center;">Petrolina/PE, #DATA</p>`;
      if (type === 'ANUENCIA') return `<p style="text-align: center; font-size: 18px; font-weight: bold;">DECLARAÇÃO DE ANUÊNCIA AMBIENTAL</p><p><br></p><p style="text-align: justify;">Declaramos para os devidos fins que o empreendimento de <strong>#PROPRIETARIO</strong> situado à <strong>#ENDERECO</strong> está em conformidade com as diretrizes ambientais municipais, não havendo óbice para o prosseguimento do licenciamento urbanístico.</p><p><br></p><p style="text-align: center;">Petrolina/PE, #DATA</p>`;
      return '';
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 relative">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="text-blue-500" size={28} />
            Modelos de Documentos
          </h1>
          <p className="text-slate-400 mt-1">Editor de templates oficiais e configuração de papel timbrado.</p>
        </div>
        
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button onClick={() => setActiveTab('TEMPLATES')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'TEMPLATES' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <FileText size={16} /> Editor de Texto
            </button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'SETTINGS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Settings size={16} /> Papel Timbrado
            </button>
        </div>
      </div>

      {activeTab === 'SETTINGS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex gap-10">
              <div className="flex-1 space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileImage className="text-blue-500"/> Papel Timbrado Oficial</h2>
                  <p className="text-slate-400 text-sm">Upload da imagem de fundo A4 (210x297) com cabeçalho/rodapé.</p>
                  <label className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-950/50 hover:bg-slate-950 cursor-pointer">
                        <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={handleBgUpload} disabled={uploadingBg}/>
                        {uploadingBg ? <Loader2 className="animate-spin text-purple-500"/> : <Upload className="text-slate-500"/>}
                        <p className="font-bold text-slate-300 mt-2">Clique para escolher</p>
                  </label>
              </div>
              <div className="flex-1 bg-white rounded shadow-lg overflow-hidden border border-slate-700 relative aspect-[210/297]">
                  {bgPreview && <img src={bgPreview} className="w-full h-full object-cover" alt="Preview"/>}
              </div>
          </div>
      )}

      {activeTab === 'TEMPLATES' && (
          <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Header Editor */}
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
                  <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                          {['ALVARA', 'HABITE_SE', 'ANUENCIA'].map(type => (
                              <button key={type} onClick={() => { setSelectedTemplate(type as any); loadTemplate(type); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selectedTemplate === type ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                                  {type.replace('_', ' ')}
                              </button>
                          ))}
                      </div>
                  </div>
                  <button onClick={handleTemplateSave} disabled={savingTemplate} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                      {savingTemplate ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Salvar Modelo
                  </button>
              </div>
              
              {/* Toolbar */}
              {/* Previne perda de foco ao clicar nos botões com onMouseDown preventDefault */}
              <div className="bg-slate-800 border-b border-slate-700 p-2 flex items-center gap-1 overflow-x-auto" onMouseDown={(e) => e.preventDefault()}>
                  <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300" title="Negrito"><Bold size={16}/></button>
                  <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300" title="Itálico"><Italic size={16}/></button>
                  <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300" title="Sublinhado"><Underline size={16}/></button>
                  <div className="w-px h-6 bg-slate-700 mx-1"></div>
                  <button onClick={() => execCmd('justifyLeft')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300"><AlignLeft size={16}/></button>
                  <button onClick={() => execCmd('justifyCenter')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300"><AlignCenter size={16}/></button>
                  <button onClick={() => execCmd('justifyRight')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300"><AlignRight size={16}/></button>
                  <button onClick={() => execCmd('justifyFull')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300"><AlignJustify size={16}/></button>
                  <div className="w-px h-6 bg-slate-700 mx-1"></div>
                  <button onClick={insertTable} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 flex items-center gap-1 text-xs font-medium"><TableIcon size={16}/> Tabela</button>
                  
                  <div className="w-px h-6 bg-slate-700 mx-1"></div>
                  <div className="flex items-center gap-1 mr-2 bg-slate-900 rounded p-1 border border-slate-700">
                      <span className="text-[10px] text-slate-400 font-bold ml-1">Topo Assin:</span>
                      <input type="number" value={sigMargin} onChange={e => setSigMargin(Number(e.target.value))} className="w-12 bg-slate-950 border border-slate-700 text-xs text-white px-1 py-0.5 rounded outline-none text-center font-mono"/>
                      <span className="text-[10px] text-slate-500 mr-1">px</span>
                  </div>
                  <button onClick={insertSignatureBlock} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 flex items-center gap-1 text-xs font-medium border border-slate-700 bg-slate-900 shadow-sm"><PenTool size={16}/> Inserir Assinaturas</button>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  
                  {/* Visual Editor Area */}
                  <div className="flex-1 bg-slate-800/50 p-8 overflow-y-auto flex justify-center">
                      <div 
                          className="bg-white text-black shadow-2xl relative"
                          style={{
                              width: '210mm',
                              minHeight: '297mm',
                              padding: '50mm 20mm 25mm 30mm',
                              backgroundImage: bgPreview ? `url(${bgPreview})` : 'none',
                              backgroundSize: '100% 100%',
                              backgroundRepeat: 'no-repeat'
                          }}
                      >
                          <div 
                              ref={editorRef}
                              contentEditable
                              className="outline-none min-h-[500px]"
                              style={{ fontFamily: '"Times New Roman", serif', fontSize: '12pt', lineHeight: '1.5' }}
                              onInput={saveRange}
                              onKeyUp={saveRange}
                              onMouseUp={saveRange}
                              onBlur={saveRange}
                          ></div>
                      </div>
                  </div>

                  {/* Sidebar Tags */}
                  <div className="w-64 bg-slate-950 border-l border-slate-800 p-4 overflow-y-auto">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Layout size={14}/> Inserir Variável</h4>
                      <div className="space-y-2" onMouseDown={(e) => e.preventDefault()}>
                          {[
                              {tag: '#PROTOCOLO', desc: 'Número do processo'},
                              {tag: '#ANO_PROTO', desc: 'Ano atual'},
                              {tag: '#ENDERECO', desc: 'Endereço da obra'},
                              {tag: '#PROPRIETARIO', desc: 'Nome do requerente'},
                              {tag: '#CPF_CNPJ', desc: 'Documento do dono'},
                              {tag: '#NOME_AUTOR', desc: 'Arquiteto (RRT)'},
                              {tag: '#NOME_RESP', desc: 'Engenheiro (ART)'},
                              {tag: '#AREA', desc: 'Área Total'},
                              {tag: '#AREA_EXTENSO', desc: 'Área por extenso'},
                              {tag: '#DATA', desc: 'Data atual'},
                              {tag: '#TIPO', desc: 'Tipo do processo'}
                          ].map(tag => (
                              <div key={tag.tag} className="bg-slate-900 p-2 rounded border border-slate-800 cursor-pointer hover:border-purple-500/50 group transition-all" onClick={() => insertTag(tag.tag)}>
                                  <div className="flex justify-between items-center">
                                      <code className="text-purple-400 font-bold text-xs group-hover:text-purple-300">{tag.tag}</code>
                                      <Plus size={12} className="text-slate-600 group-hover:text-white"/>
                                  </div>
                                  <span className="text-[10px] text-slate-500">{tag.desc}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
