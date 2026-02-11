  import React, { useEffect, useRef, useState } from 'react';
  import { Mic, MicOff, PhoneOff, Activity } from 'lucide-react';
  import { LiveClient } from '../services/liveClient';

  export const LiveInterface: React.FC = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const clientRef = useRef<LiveClient | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    useEffect(() => {
      clientRef.current = new LiveClient();
      return () => {
        clientRef.current?.disconnect();
      };
    }, []);

    const toggleConnection = async () => {
      if (isConnected) {
        clientRef.current?.disconnect();
        setIsConnected(false);
        setVolume(0);
      } else {
        setError(null);
        await clientRef.current?.connect(
          () => setIsConnected(true),
          (err) => {
              setError("Falha ao conectar. Verifique o acesso ao microfone.");
              setIsConnected(false);
          },
          () => setIsConnected(false),
          (vol) => setVolume(vol)
        );
      }
    };

    // Visualizer
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Draw glowing circle based on volume
        const radius = 30 + volume * 2; // Base radius + dynamic volume
        
        // Outer glow
        const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 1.5);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)'); // Blue
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = isConnected ? '#3b82f6' : '#475569';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
        ctx.fill();

        // Ring animation
        if (isConnected) {
            const time = Date.now() / 500;
            const ringRadius = 40 + Math.sin(time) * 5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        animationRef.current = requestAnimationFrame(draw);
      };
      
      draw();
      return () => cancelAnimationFrame(animationRef.current);
    }, [isConnected, volume]);

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden">
        
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl"></div>
        </div>

        <div className="z-10 flex flex-col items-center gap-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white">Agente de Voz ao Vivo</h2>
            <p className="text-slate-400 max-w-md">
              Conversa em tempo real e baixa latência. Fale naturalmente.
              <br/>
              <span className="text-xs text-slate-500">Idioma: Português do Brasil.</span>
            </p>
          </div>

          {/* Visualizer Container */}
          <div className="relative w-80 h-80 flex items-center justify-center">
            <canvas 
              ref={canvasRef} 
              width={320} 
              height={320} 
              className="w-full h-full"
            />
          </div>

          <div className="flex items-center gap-6">
              <button
                  onClick={toggleConnection}
                  className={`flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-xl ${
                      isConnected 
                      ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
                      : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 shadow-blue-900/50'
                  }`}
              >
                  {isConnected ? (
                      <>
                          <PhoneOff size={24} />
                          <span>Desconectar</span>
                      </>
                  ) : (
                      <>
                          <Mic size={24} />
                          <span>Iniciar Conversa</span>
                      </>
                  )}
              </button>
          </div>
          
          {error && (
              <div className="bg-red-900/20 border border-red-800 text-red-200 px-4 py-2 rounded-lg text-sm">
                  {error}
              </div>
          )}

          {isConnected && (
              <div className="flex items-center gap-2 text-slate-500 text-sm animate-pulse">
                  <Activity size={16} />
                  <span>Conexão ao Vivo Ativa</span>
              </div>
          )}
        </div>
      </div>
    );
  };