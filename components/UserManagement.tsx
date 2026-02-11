
import React, { useEffect, useState } from 'react';
import { AdminService } from '../services/supabase';
import { UserProfile, UserRole } from '../types';
import { useToast } from './Toast';
import { Loader2, Shield, Plus, Users, Lock } from 'lucide-react';

interface UserManagementProps {
    userProfile: UserProfile | null;
}

export const UserManagement: React.FC<UserManagementProps> = ({ userProfile }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const [newUser, setNewUser] = useState({
      fullName: '',
      email: '',
      password: '',
      role: 'PROTOCOLO'
  });
  const [creating, setCreating] = useState(false);

  const { addToast } = useToast();

  if (userProfile?.role !== UserRole.ADMIN) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-red-500">
              <Lock size={48} className="mb-4" />
              <h1 className="text-2xl font-bold">ACESSO NEGADO</h1>
              <p className="text-slate-400 mt-2">Você não tem permissão para acessar este módulo.</p>
          </div>
      );
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await AdminService.listAllUsers();
      setUsers(data);
    } catch (e: any) {
      addToast("Erro ao listar usuários: " + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await AdminService.updateUserRole(userId, newRole);
      addToast("Cargo atualizado com sucesso.", 'success');
      loadUsers();
    } catch (e: any) {
      addToast("Erro ao atualizar: " + e.message, 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);
      try {
          await AdminService.createUser(newUser.email, newUser.password, newUser.fullName, newUser.role);
          addToast(`Usuário ${newUser.fullName} criado com sucesso!`, 'success');
          setShowCreateModal(false);
          setNewUser({ fullName: '', email: '', password: '', role: 'PROTOCOLO' });
          loadUsers();
      } catch (err: any) {
          addToast("Erro ao criar usuário: " + err.message, 'error');
      } finally {
          setCreating(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 relative">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="text-purple-500" size={28} />
            Gestão de Pessoas
          </h1>
          <p className="text-slate-400 mt-1">Controle de acesso e cargos do sistema.</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg">
          <Plus size={18} /> Novo Funcionário
          </button>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
          {loading ? <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" size={32}/></div> : (
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
              <thead className="bg-slate-950 text-slate-500 font-medium text-xs uppercase">
                  <tr><th className="px-6 py-4">Nome / Email</th><th className="px-6 py-4">Cargo</th><th className="px-6 py-4 text-right">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                  {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4"><span className="font-bold text-slate-200">{user.full_name}</span><br/><span className="text-xs text-slate-500">{user.email}</span></td>
                      <td className="px-6 py-4"><span className="bg-slate-800 px-2 py-1 rounded text-xs text-purple-300 border border-purple-900/50">{user.role}</span></td>
                      <td className="px-6 py-4 text-right">
                      <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value)} disabled={user.role === 'ADMIN' && user.id === userProfile?.id} className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1">
                          <option value="PROTOCOLO">PROTOCOLO</option><option value="LICENCIAMENTO">LICENCIAMENTO</option><option value="FISCALIZACAO">FISCALIZAÇÃO</option><option value="ADMIN">ADMIN</option>
                      </select>
                      </td>
                  </tr>
                  ))}
              </tbody>
              </table>
          </div>
          )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
             <h3 className="text-lg font-bold text-white mb-4">Novo Funcionário</h3>
             <form onSubmit={handleCreateUser} className="space-y-4">
               <input type="text" required placeholder="Nome Completo" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none"/>
               <input type="email" required placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none"/>
               <input type="text" required placeholder="Senha (min 6)" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none"/>
               <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none">
                   <option value="PROTOCOLO">PROTOCOLO</option><option value="LICENCIAMENTO">LICENCIAMENTO</option><option value="FISCALIZACAO">FISCALIZAÇÃO</option><option value="ADMIN">ADMIN</option>
               </select>
               <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
                  <button type="submit" disabled={creating} className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold">{creating ? 'Criando...' : 'Criar'}</button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
