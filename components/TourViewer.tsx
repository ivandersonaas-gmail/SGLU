
import React, { useEffect, useRef, useState } from 'react';
import { TourService } from '../services/supabase';
import { TourScene } from '../types';
import { useToast } from './Toast';
import { Loader2, Upload, Trash2, Map, Plus, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Tooltip } from './Tooltip';

declare const pannellum: any;

interface TourViewerProps {
    processId: string;
    canEdit: boolean;
}

export const TourViewer: React.FC<TourViewerProps> = ({ processId, canEdit }) => {
    const [scenes, setScenes] = useState<TourScene[]>([]);
    const [activeScene, setActiveScene] = useState<TourScene | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [viewerLoading, setViewerLoading] = useState(false);
    
    // Referências
    const viewerRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentBlobUrl = useRef<string | null>(null);
    const isMounted = useRef(true);
    
    const { addToast } = useToast();

    // Ciclo de Vida Global
    useEffect(() => {
        isMounted.current = true;
        loadScenes();
        
        return () => {
            isMounted.current = false;
            destroyViewer();
        };
    }, [processId]);

    // Gerenciamento da Cena Ativa
    useEffect(() => {
        let isCurrentEffectActive = true;

        const setupScene = async () => {
            if (activeScene) {
                // Destroi anterior imediatamente
                destroyViewer();
                
                // Pequeno delay para garantir flush do DOM pelo React (devido ao key)
                await new Promise(r => setTimeout(r, 50));
                
                if (isMounted.current && isCurrentEffectActive) {
                    initViewer(activeScene, () => isMounted.current && isCurrentEffectActive);
                }
            } else {
                destroyViewer();
            }
        };

        setupScene();

        return () => {
            isCurrentEffectActive = false;
            destroyViewer();
        };
    }, [activeScene]);

    const destroyViewer = () => {
        // 1. Destruição segura da instância Pannellum
        if (viewerRef.current) {
            try { 
                if (typeof viewerRef.current.destroy === 'function') {
                    viewerRef.current.destroy(); 
                }
            } catch(e) { console.warn("Cleanup warning:", e); }
            viewerRef.current = null;
        }
        
        // 2. Revogação de Memória (Blob)
        if (currentBlobUrl.current) {
            URL.revokeObjectURL(currentBlobUrl.current);
            currentBlobUrl.current = null;
        }

        // 3. Limpeza do Container DOM
        const container = document.getElementById('panorama-container');
        if (container) {
            container.innerHTML = '';
        }
    };

    const initViewer = async (scene: TourScene, isValidContext: () => boolean) => {
        if (!scene || !scene.image_url) return;

        setViewerLoading(true);

        // Validação de Dependência
        if (typeof pannellum === 'undefined') {
            await new Promise(r => setTimeout(r, 500)); // Retry único
            if (typeof pannellum === 'undefined') {
                if(isValidContext()) {
                    addToast("Motor gráfico 360º não carregado. Verifique conexão.", 'error');
                    setViewerLoading(false);
                }
                return;
            }
        }

        const container = document.getElementById('panorama-container');
        if (!container || !isValidContext()) {
            setViewerLoading(false);
            return;
        }

        try {
            // Download seguro da imagem para Blob (evita problemas de CORS no WebGL)
            const response = await fetch(scene.image_url, { mode: 'cors' });
            
            if (!isValidContext()) return; // Aborta se o usuário mudou de cena durante o download

            if (!response.ok) throw new Error("Falha no download da imagem.");
            
            const blob = await response.blob();
            if (blob.size === 0) throw new Error("Imagem corrompida.");

            if (!isValidContext()) return;

            const objectUrl = URL.createObjectURL(blob);
            currentBlobUrl.current = objectUrl;

            // Inicialização do Viewer
            viewerRef.current = pannellum.viewer('panorama-container', {
                type: 'equirectangular',
                panorama: objectUrl, 
                autoLoad: true,
                compass: true,
                showControls: true,
                backgroundColor: [15, 23, 42], 
                strings: {
                    loadButtonLabel: "Carregar 360º",
                    loadingLabel: "Renderizando...",
                    errorMsg: "Erro de Renderização."
                }
            });
            
            viewerRef.current.on('load', () => {
                if(isValidContext()) setViewerLoading(false);
            });

            viewerRef.current.on('error', (type: any) => {
                console.error("Pannellum Error:", type);
                if(isValidContext()) {
                    setViewerLoading(false);
                    addToast("Erro ao renderizar imagem 360.", 'error');
                }
            });

        } catch (e: any) {
            console.error("Viewer Init Error:", e);
            if(isValidContext()) {
                addToast("Não foi possível carregar a imagem.", 'error');
                setViewerLoading(false);
            }
        }
    };

    const loadScenes = async () => {
        try {
            setLoading(true);
            const data = await TourService.getScenes(processId);
            if (isMounted.current) {
                setScenes(data);
                // Seleção automática inteligente
                if (data.length > 0) {
                    // Mantém a cena atual se ela ainda existir, senão pega a primeira
                    setActiveScene(prev => {
                        if (prev && data.find(s => s.id === prev.id)) return prev;
                        return data[0];
                    });
                } else {
                    setActiveScene(null);
                }
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    const handleAddClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; 
            fileInputRef.current.click();
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return; // Usuário cancelou

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            addToast("Formato inválido. Use JPG ou PNG.", 'error');
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            addToast("Arquivo muito grande (Máx 25MB).", 'error');
            return;
        }

        // REMOVIDO: prompt() que causava bloqueio/falha silenciosa
        // Usa o nome do arquivo (sem extensão) como título automático
        const title = file.name.split('.').slice(0, -1).join('.') || "Nova Cena";

        setUploading(true);
        addToast("Processando imagem...", 'info');

        try {
            const newScene = await TourService.uploadScene(processId, file, title);
            
            if (isMounted.current) {
                setScenes(prev => [...prev, newScene]);
                setActiveScene(newScene); // Dispara useEffect -> setupScene
                addToast("Imagem adicionada com sucesso!", 'success');
            }
        } catch (e: any) {
            console.error(e);
            addToast("Erro no upload: " + (e.message || "Falha desconhecida"), 'error');
        } finally {
            if (isMounted.current) {
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja apagar esta cena?")) return;
        
        try {
            await TourService.deleteScene(id);
            if (isMounted.current) {
                const remaining = scenes.filter(s => s.id !== id);
                setScenes(remaining);
                if (activeScene?.id === id) {
                    setActiveScene(remaining.length > 0 ? remaining[0] : null);
                }
                addToast("Cena excluída.", 'success');
            }
        } catch (e: any) {
            addToast("Erro ao excluir.", 'error');
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 p-4 rounded-xl border border-slate-800 animate-in fade-in">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Map className="text-blue-500" /> Vistoria Virtual 360º
                    </h3>
                    <p className="text-xs text-slate-500">Navegue pelas fotos panorâmicas da obra.</p>
                </div>
                <div className="flex gap-2">
                    <Tooltip text="Recarregar Lista">
                        <button onClick={loadScenes} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700">
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        </button>
                    </Tooltip>
                    
                    {canEdit && (
                        <>
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                className="hidden" 
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleUpload} 
                            />
                            <Tooltip text="Adicionar nova foto panorâmica">
                                <button 
                                    onClick={handleAddClick}
                                    disabled={uploading}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}
                                    {uploading ? 'Enviando...' : 'Adicionar Foto'}
                                </button>
                            </Tooltip>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-[400px]">
                {/* Thumbnails Sidebar */}
                <div className="w-full md:w-48 bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden shrink-0">
                    <div className="p-2 bg-slate-950 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase text-center">
                        Cenas ({scenes.length})
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {loading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500"/></div>
                        ) : scenes.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 px-2">
                                <ImageIcon size={24} className="mx-auto mb-2 opacity-50"/>
                                <p className="text-xs">Nenhuma cena.</p>
                            </div>
                        ) : (
                            scenes.map(scene => (
                                <div 
                                    key={scene.id} 
                                    onClick={() => setActiveScene(scene)}
                                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all h-24 bg-black ${activeScene?.id === scene.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-slate-600'}`}
                                >
                                    <img src={scene.image_url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={scene.title} />
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-1.5">
                                        <p className="text-[10px] text-white font-bold truncate">{scene.title}</p>
                                    </div>
                                    {canEdit && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(scene.id); }}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                                            title="Excluir"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Viewer Area */}
                <div className="flex-1 bg-black rounded-xl border border-slate-800 relative overflow-hidden shadow-2xl flex flex-col">
                    {activeScene ? (
                        <>
                            {viewerLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-20">
                                    <div className="text-center">
                                        <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-2"/>
                                        <p className="text-sm text-slate-400 font-medium">Renderizando ambiente 3D...</p>
                                    </div>
                                </div>
                            )}
                            {/* Key obriga a recriação do DOM quando a cena muda, vital para o Pannellum */}
                            <div 
                                id="panorama-container" 
                                key={activeScene.id} 
                                className="w-full h-full cursor-grab active:cursor-grabbing z-10" 
                                style={{ opacity: viewerLoading ? 0 : 1, transition: 'opacity 0.5s' }}
                            ></div>
                            
                            {/* Overlay Info - CORREÇÃO: left-16 para não cobrir botões */}
                            <div className="absolute top-4 left-16 z-20 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 pointer-events-none">
                                <h4 className="text-white text-sm font-bold shadow-black drop-shadow-md">{activeScene.title}</h4>
                            </div>
                            <div className="absolute bottom-4 right-4 z-20 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] text-white/70 pointer-events-none border border-white/10">
                                Arraste para girar • Scroll para zoom
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                                <Map size={32} className="opacity-30" />
                            </div>
                            <p className="text-sm">Selecione uma cena para iniciar o Tour Virtual.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
