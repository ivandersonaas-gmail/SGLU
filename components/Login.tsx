
import React, { useState } from 'react';
import { AuthService } from '../services/auth';
import { Loader2, Building2, Lock, Mail, LogIn, ShieldAlert, UserPlus, AlertTriangle } from 'lucide-react';
import { useToast } from './Toast';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRecoveryMode) {
          // Tenta criar o usuário (Primeiro Acesso)
          await AuthService.signUp(email, password, 'Administrador Inicial');
          addToast("Conta criada com sucesso! Tente fazer login agora.", 'success');
          setIsRecoveryMode(false); // Volta para login
      } else {
          // Fluxo de Login Normal
          await AuthService.signIn(email, password);
          onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      if (err.message.includes("Invalid login")) {
        setError("Usuário não encontrado ou senha incorreta. Se você recriou o banco recentemente, o usuário Auth pode ter sido perdido. Clique em 'Primeiro Acesso' para recriá-lo.");
      } else if (err.message.includes("User already registered")) {
        setError("Este e-mail já possui conta. Tente fazer login (se esqueceu a senha, contate o suporte do banco).");
        setIsRecoveryMode(false);
      } else if (err.message.includes("Email not confirmed")) {
        setError("Email não confirmado. Verifique sua caixa de entrada.");
      } else {
        setError(err.message || 'Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-3xl"></div>
         <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-amber-900/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        
        {/* Header */}
        <div className="bg-slate-950/50 p-6 flex flex-col items-center border-b border-slate-800">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 mb-4">
            <Building2 className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SGLU Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema de Licenciamento Urbano</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isRecoveryMode && (
                <div className="bg-emerald-900/20 border border-emerald-800 p-3 rounded-lg flex gap-2 text-emerald-200 text-xs mb-4">
                    <UserPlus size={16} className="shrink-0" />
                    <p>Modo de Criação de Conta (Admin). Use isso se seu usuário foi deletado do Auth.</p>
                </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-200 text-xs p-3 rounded-lg flex items-start gap-2 animate-in slide-in-from-top-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase ml-1">Email Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  placeholder="usuario@prefeitura.gov.br"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full font-semibold py-3 rounded-lg transition-all mt-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${isRecoveryMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'}`}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                 <>
                   {isRecoveryMode ? <UserPlus size={18} /> : <LogIn size={18} />}
                   {isRecoveryMode ? 'Criar Conta' : 'Acessar Sistema'}
                 </>
              )}
            </button>

            <button
                type="button"
                onClick={() => { setError(null); setIsRecoveryMode(!isRecoveryMode); }}
                className={`w-full text-xs mt-4 underline decoration-slate-700 underline-offset-4 transition-colors ${isRecoveryMode ? 'text-slate-500 hover:text-slate-300' : 'text-blue-400 hover:text-blue-300 font-medium'}`}
            >
                {isRecoveryMode ? 'Voltar para Login' : 'Primeiro Acesso / Recuperar Conta'}
            </button>

          </form>
        </div>
        
        <div className="px-8 pb-6 text-center border-t border-slate-800 pt-4 bg-slate-950/30">
          <p className="text-[10px] text-slate-600">
            © SGLU v1.0 • Acesso restrito
          </p>
        </div>
      </div>
    </div>
  );
};
