
import { supabase } from './supabase';
import { UserProfile, UserRole } from '../types';

export const AuthService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string, fullName: string) {
    // Boas Práticas: Enviar dados adicionais (metadata) no momento da criação
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Busca o perfil. Graças ao SQL "get_my_role", não há mais recursão infinita.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); 

      if (data) return data as UserProfile;

      // AUTO-RECOVERY (Fallback de segurança para usuários antigos/órfãos)
      console.warn("Perfil não encontrado. Tentando Auto-Recuperação...");
      
      const { data: sessionData } = await supabase.auth.getUser();
      const user = sessionData.user;

      if (user && user.id === userId) {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{
                id: userId,
                email: user.email,
                role: 'PROTOCOLO',
                full_name: user.user_metadata?.full_name || 'Usuário Recuperado'
            }])
            .select()
            .maybeSingle();
          
          if (newProfile) return newProfile as UserProfile;

          // Se der erro de duplicidade (23505), é porque o gatilho foi mais rápido.
          // Isso é bom! Apenas retornamos o perfil que já existe.
          if (createError && createError.code === '23505') {
              const { data: existingProfile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', userId)
                  .maybeSingle();
              if (existingProfile) return existingProfile as UserProfile;
          }
      }

      return null;
    } catch (e) {
      console.error('Auth service error:', e);
      return null;
    }
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }
};
