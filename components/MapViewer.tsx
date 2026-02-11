
import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Info, Loader2, FileUp, Globe } from 'lucide-react';

interface MapViewerProps {
    zone?: string;
    area?: number;
    address?: string;
}

export const MapViewer: React.FC<MapViewerProps> = ({ zone = 'ZC-1', area = 360, address = 'Rua Exemplo, 123' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const [loading, setLoading] = useState(false);
    const [cesiumLoaded, setCesiumLoaded] = useState(false);

    // Verifica se a biblioteca global do Cesium foi carregada
    useEffect(() => {
        const interval = setInterval(() => {
            if ((window as any).Cesium) {
                setCesiumLoaded(true);
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Inicializa o visualizador
    useEffect(() => {
        if (!cesiumLoaded || !containerRef.current || viewerRef.current) return;

        const Cesium = (window as any).Cesium;

        try {
            // Cria o visualizador Cesium com UI limpa
            // Nota: Sem token, ele usará assets padrão com limitações/marcas d'água, mas funcionará.
            const viewer = new Cesium.Viewer(containerRef.current, {
                animation: false,
                timeline: false,
                baseLayerPicker: false, 
                geocoder: false,
                homeButton: false,
                sceneModePicker: false,
                navigationHelpButton: false,
                infoBox: false,
                fullscreenButton: false,
                selectionIndicator: false,
                creditContainer: document.createElement('div'), // Oculta créditos para manter UI limpa
                imageryProvider: new Cesium.OpenStreetMapImageryProvider({
                    url: 'https://a.tile.openstreetmap.org/'
                }),
                contextOptions: {
                    webgl: {
                        alpha: true
                    }
                }
            });
            
            // Configurações da Cena 3D
            if (viewer.scene) {
                viewer.scene.globe.enableLighting = true;
                viewer.scene.fog.enabled = true;
                viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0f172a'); // Match com Slate 950
                
                // Safe check para o controlador de colisão
                if (viewer.scene.screenSpaceCameraController) {
                    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
                }
            }

            viewerRef.current = viewer;
            
            // Voar para posição padrão (Centro aproximado de Petrolina/PE)
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(-40.50, -9.38, 5000),
                orientation: {
                    heading: Cesium.Math.toRadians(0.0),
                    pitch: Cesium.Math.toRadians(-90.0),
                    roll: 0.0
                }
            });

        } catch (error) {
            console.error("Erro ao iniciar Cesium:", error);
        }

        // Cleanup ao desmontar
        return () => {
            if (viewerRef.current) {
                try {
                    viewerRef.current.destroy();
                } catch(e) {}
                viewerRef.current = null;
            }
        };
    }, [cesiumLoaded]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !viewerRef.current) return;
        
        const Cesium = (window as any).Cesium;
        setLoading(true);

        try {
            // Carrega arquivo KML ou KMZ
            const dataSource = await Cesium.KmlDataSource.load(file, {
                camera: viewerRef.current.scene.camera,
                canvas: viewerRef.current.scene.canvas
            });
            
            // Adiciona ao mapa
            await viewerRef.current.dataSources.add(dataSource);
            
            // Voa a câmera para focar no objeto carregado
            viewerRef.current.flyTo(dataSource).catch((e: any) => console.warn("FlyTo error", e));

        } catch (error) {
            console.error("Erro ao carregar KML:", error);
            alert("Não foi possível processar o arquivo KML/KMZ. Verifique se é um arquivo geográfico válido.");
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input para permitir re-upload do mesmo arquivo
        }
    };

    // Controles de Zoom manuais
    const zoomCamera = (amount: number) => {
        if (!viewerRef.current) return;
        const camera = viewerRef.current.scene.camera;
        const height = camera.positionCartographic.height;
        
        // Zoom relativo à altura atual
        if (amount > 0) camera.zoomIn(height * 0.3);
        else camera.zoomOut(height * 0.3);
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative group min-h-[500px]">
            
            {/* GIS Toolbar */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-xl flex flex-col gap-1">
                    <button onClick={() => zoomCamera(1)} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
                    <button onClick={() => zoomCamera(-1)} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
                </div>

                <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-xl">
                     <label className="p-2 text-blue-400 hover:text-white hover:bg-blue-600 rounded transition-colors cursor-pointer flex items-center justify-center relative" title="Importar KMZ/KML">
                         {loading ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                         <input type="file" accept=".kml,.kmz" onChange={handleFileUpload} className="hidden" disabled={loading} />
                     </label>
                </div>
            </div>

            {/* Status Overlay */}
            {!cesiumLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-50">
                    <Loader2 size={40} className="text-blue-500 animate-spin mb-4" />
                    <p className="text-slate-400 font-medium animate-pulse">Carregando Motor Geoespacial 3D...</p>
                </div>
            )}

            {/* Map Canvas */}
            <div ref={containerRef} className="w-full h-full min-h-[500px] bg-slate-950 cursor-move" id="cesiumContainer" />
            
            {/* Info Panel Overlay */}
            <div className="absolute bottom-4 right-4 z-20 bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-2xl max-w-xs pointer-events-none">
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                    <Info size={14} /> Dados Geoespaciais
                </h4>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Zona</span>
                        <span className="font-bold text-purple-400">{zone}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Área Lote</span>
                        <span className="font-bold text-blue-400">{area} m²</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-400 text-xs truncate max-w-[150px]">{address}</span>
                        <span className="bg-emerald-900/30 text-emerald-400 text-[10px] px-1.5 rounded border border-emerald-800">Regular</span>
                    </div>
                </div>
            </div>

            <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 w-full absolute bottom-0 left-0 z-20"></div>
        </div>
    );
};
