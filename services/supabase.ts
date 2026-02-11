
import { createClient } from '@supabase/supabase-js';
import { PersonType, UserProfile, LegislationFile, ProjectParameters, ProcessHistory, DocumentTemplate, TourScene } from '../types';

// ⚠️ CONFIGURE SUAS CHAVES NO ARQUIVO .env.local ⚠️
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Inicialização Segura do Cliente
const initSupabase = () => {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error("Variáveis de ambiente do Supabase não configuradas.");
        }
        return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.error("FALHA CRÍTICA AO INICIAR SUPABASE:", e);
        // Retorna um objeto mock para evitar tela branca (White Screen of Death)
        return {
            auth: {
                getSession: async () => ({ data: { session: null }, error: { message: "Cliente Supabase falhou na inicialização." } }),
                signInWithPassword: async () => ({ data: null, error: { message: "Erro de Configuração: Cliente Supabase inválido." } }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } })
            },
            from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: "DB não conectado" } }), order: () => Promise.resolve({ data: [] }) }) }) }),
            storage: { from: () => ({ upload: async () => ({ error: { message: "Storage indisponível" } }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
            channel: () => ({ on: () => ({ on: () => ({ on: () => ({ subscribe: () => { } }) }) }) }),
            removeChannel: () => { }
        } as any;
    }
};

export const supabase = initSupabase();

export const isSupabaseConfigured = () => {
    return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0 && (SUPABASE_URL as string) !== 'https://placeholder.supabase.co';
};

const formatError = (err: any, context: string): Error => {
    try {
        if (String(err).includes('Failed to fetch')) {
            console.warn(`Conexão falhou em ${context}: Possível bloqueio de rede ou AdBlock.`);
        } else {
            console.error(`Erro bruto em ${context}:`, JSON.stringify(err, null, 2));
        }
    } catch (e) {
        console.error(`Erro bruto em ${context}:`, err);
    }

    let msg = "Erro desconhecido";

    if (err instanceof Error) {
        msg = err.message;
    } else if (typeof err === 'object' && err !== null) {
        if (err.code === '42P17') {
            return new Error("ERRO CRÍTICO SQL: Recursão Infinita nas Políticas (RLS). Execute o script de correção 'SECURITY DEFINER' no Supabase.");
        }
        if (err.code === 'PGRST204') {
            return new Error("ERRO DE ESQUEMA: Colunas ausentes no banco. Execute o script SQL de atualização.");
        }
        if (err.code === '42P01' && context.includes('Template')) {
            return new Error("TABELA INEXISTENTE: A tabela 'document_templates' não existe. Rode o SQL para criar.");
        }
        msg = err.message || err.error_description || err.details || err.hint || JSON.stringify(err);
    } else {
        msg = String(err);
    }

    if (typeof msg === 'string') {
        if (msg.includes('row-level security')) return new Error("ERRO DE PERMISSÃO: O banco bloqueou a gravação.");
        if (msg.includes('duplicate key')) return new Error("ERRO DE DUPLICIDADE: Registro já existe.");
        if (msg.includes('Failed to fetch')) return new Error("ERRO DE CONEXÃO: Verifique internet ou AdBlock.");
        if (msg.includes('violates foreign key constraint')) return new Error("ERRO DE VÍNCULO: Não é possível apagar registro com dependentes.");
    }
    return new Error(`${context}: ${msg}`);
};

const logHistory = async (processId: string, action: string, notes?: string) => {
    try {
        await supabase.from('process_history').insert([{
            process_id: processId,
            action: action,
            user_notes: notes || ''
        }]);
    } catch (e) {
        console.warn("Falha ao registrar histórico", e);
    }
};

export const ProcessService = {
    async getAll(page: number = 1, limit: number = 20) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data: processes, error, count } = await supabase
            .from('processes')
            .select('*, applicants(*)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw formatError(error, "Listar Processos");
        if (!processes) return { data: [], count: 0 };

        const analystIds = Array.from(new Set(processes.map((p: any) => p.analyst_id).filter(Boolean)));

        let profilesMap: Record<string, any> = {};
        if (analystIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('*').in('id', analystIds);
            if (profiles) {
                profiles.forEach((p: any) => profilesMap[p.id] = p);
            }
        }

        const data = processes.map((p: any) => ({
            ...p,
            analyst_profile: p.analyst_id ? profilesMap[p.analyst_id] : undefined
        }));

        return { data, count: count || 0 };
    },

    async getById(id: string) {
        const { data: process, error } = await supabase
            .from('processes')
            .select('*, applicants(*)')
            .eq('id', id)
            .maybeSingle();

        if (error) throw formatError(error, "Buscar Processo");
        if (!process) return null;

        let result = { ...process };
        if (process.analyst_id) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', process.analyst_id).maybeSingle();
            if (profile) result.analyst_profile = profile;
        }
        return result;
    },

    async create(applicant: { name: string, cpf: string, phone: string, personType: PersonType }, process: { type: string, address_work: string }) {
        let applicantId;
        const { data: existingApp } = await supabase.from('applicants').select('id').eq('cpf', applicant.cpf).maybeSingle();
        if (existingApp) {
            applicantId = existingApp.id;
        } else {
            const { data: newApp, error: appError } = await supabase.from('applicants').insert([{
                name: applicant.name, cpf: applicant.cpf, phone: applicant.phone, person_type: applicant.personType
            }]).select().single();
            if (appError) {
                if (appError.code === '23505') {
                    const { data: retryApp } = await supabase.from('applicants').select('id').eq('cpf', applicant.cpf).maybeSingle();
                    if (retryApp) applicantId = retryApp.id;
                    else throw new Error("Falha ao recuperar requerente.");
                } else throw formatError(appError, "Criar Requerente");
            } else applicantId = newApp.id;
        }

        const { data: newProcess, error: procError } = await supabase.from('processes').insert([{
            applicant_id: applicantId, type: process.type, address_work: process.address_work, status: 'PROTOCOLADO', current_sector: 'PROTOCOLO'
        }]).select().single();
        if (procError) throw formatError(procError, "Criar Processo");

        await logHistory(newProcess.id, "Processo Criado no Protocolo");
        return newProcess;
    },

    async updateStatus(id: string, status: string, notes: string) {
        const { data, error } = await supabase.from('processes').update({ status, technical_notes: notes }).eq('id', id).select();
        if (error) throw formatError(error, "Atualizar Status");

        await logHistory(id, `Status alterado para ${status}`, notes ? "Nota Técnica atualizada" : undefined);
        return data;
    },

    async assignProcess(processId: string, userId: string) {
        const { data, error } = await supabase.from('processes').update({
            analyst_id: userId, status: 'EM_ANALISE', current_sector: 'LICENCIAMENTO'
        }).eq('id', processId).select();
        if (error) throw formatError(error, "Atribuir Processo");

        await logHistory(processId, "Processo atribuído ao Analista (Puxado)");
        return data;
    },

    async transferProcess(processId: string, targetAnalystId: string) {
        const { data, error } = await supabase.from('processes').update({ analyst_id: targetAnalystId }).eq('id', processId).select();
        if (error) throw formatError(error, "Transferir Processo");

        await logHistory(processId, "Processo transferido");
        return data;
    },

    async getAnalysts() {
        const { data, error } = await supabase.from('profiles').select('*').eq('role', 'LICENCIAMENTO');
        if (error) return [];
        return data as UserProfile[];
    },

    async uploadDocument(processId: string, file: File, docType: string = 'OUTROS') {
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${processId}/${Date.now()}_${docType}_${safeFileName}`;

        const { error: uploadError } = await supabase.storage.from('process-docs').upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw formatError(uploadError, "Upload Storage");

        const { data: urlData } = supabase.storage.from('process-docs').getPublicUrl(fileName);

        const { data, error: dbError } = await supabase.from('documents').insert([{
            process_id: processId, name: file.name, file_url: urlData.publicUrl, file_type: docType,
        }]).select().single();

        if (dbError) throw formatError(dbError, "Salvar Documento");

        await logHistory(processId, `Upload de Documento: ${docType}`);
        return data;
    },

    async deleteDocument(documentId: string, fileUrl: string) {
        // 1. Tenta apagar do banco sem contar linhas (mais rápido e seguro com RLS desativado)
        const { error: dbError } = await supabase.from('documents').delete().eq('id', documentId);
        if (dbError) throw formatError(dbError, "Deletar Documento DB");

        // 2. Tenta apagar do storage (best effort)
        try {
            if (fileUrl && fileUrl.includes('/process-docs/')) {
                const path = fileUrl.split('/process-docs/')[1];
                if (path) await supabase.storage.from('process-docs').remove([path]);
            }
        } catch (e) {
            console.warn("Aviso: Falha ao limpar arquivo físico no storage, mas registro db removido.", e);
        }
    },

    async deleteProcess(processId: string) {
        // Exclusão em Cascata Manual via Software (Segurança)
        await supabase.from('documents').delete().eq('process_id', processId);
        await supabase.from('process_history').delete().eq('process_id', processId);
        await supabase.from('project_parameters').delete().eq('process_id', processId);
        await supabase.from('tour_scenes').delete().eq('process_id', processId); // Novo

        const { error: procError } = await supabase.from('processes').delete().eq('id', processId);
        if (procError) throw formatError(procError, "Excluir Processo");
        return true;
    },

    async getDocuments(processId: string) {
        const { data, error } = await supabase.from('documents').select('*').eq('process_id', processId).order('created_at', { ascending: false });
        if (error) throw formatError(error, "Listar Documentos");
        return data;
    },

    async getHistory(processId: string) {
        const { data, error } = await supabase.from('process_history').select('*').eq('process_id', processId).order('created_at', { ascending: false });
        if (error) throw formatError(error, "Buscar Histórico");
        return data as ProcessHistory[];
    },

    async downloadFileFromUrl(publicUrl: string): Promise<{ data: string, mimeType: string }> {
        try {
            const response = await fetch(publicUrl);
            if (!response.ok) throw new Error("Falha ao baixar arquivo");
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve({ data: base64, mimeType: blob.type });
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e: any) {
            throw new Error("Não foi possível acessar o conteúdo do arquivo.");
        }
    }
};

export const TemplateService = {
    async getTemplate(type: 'HABITE_SE' | 'ALVARA' | 'ANUENCIA') {
        const { data, error } = await supabase
            .from('document_templates')
            .select('*')
            .eq('type', type)
            .maybeSingle();

        if (error) throw formatError(error, "Buscar Template");
        return data as DocumentTemplate | null;
    },

    async saveTemplate(type: string, content: string) {
        const { data, error } = await supabase
            .from('document_templates')
            .upsert({ type, content }, { onConflict: 'type' })
            .select()
            .single();

        if (error) throw formatError(error, "Salvar Template");
        return data;
    }
};

// Cache em memória para leis (Otimização de Contexto da IA)
let legislationCache: LegislationFile[] | null = null;

export const LegislationService = {
    async uploadLaw(file: File, name: string, category: string, description: string) {
        // Invalida o cache
        legislationCache = null;

        const fileName = `legislation/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error: upError } = await supabase.storage.from('process-docs').upload(fileName, file);
        if (upError) throw formatError(upError, "Upload Lei");

        const { data: url } = supabase.storage.from('process-docs').getPublicUrl(fileName);

        const { error } = await supabase.from('legislation_files').insert([{
            name, category, description, file_url: url.publicUrl
        }]);
        if (error) throw formatError(error, "Salvar Lei");
    },

    async listLaws() {
        // Verifica Cache
        if (legislationCache) return legislationCache;

        const { data, error } = await supabase.from('legislation_files').select('*').order('category');
        if (error) throw formatError(error, "Listar Leis");

        // Atualiza Cache
        legislationCache = data as LegislationFile[];

        return data as LegislationFile[];
    },

    async deleteLaw(id: string) {
        // Invalida o cache
        legislationCache = null;

        const { error } = await supabase.from('legislation_files').delete().eq('id', id);
        if (error) throw formatError(error, "Deletar Lei");
    }
};

export const ProjectParameterService = {
    async getParameters(processId: string) {
        const { data, error } = await supabase.from('project_parameters').select('*').eq('process_id', processId).maybeSingle();
        if (error && error.code !== 'PGRST116') throw formatError(error, "Buscar Parâmetros");
        return data as ProjectParameters;
    },

    async upsertParameters(params: ProjectParameters) {
        const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined));
        const { data: existing } = await supabase.from('project_parameters').select('id').eq('process_id', params.process_id).maybeSingle();
        let result;
        if (existing) {
            result = await supabase.from('project_parameters').update(cleanParams).eq('id', existing.id).select().single();
        } else {
            result = await supabase.from('project_parameters').insert([cleanParams]).select().single();
        }
        if (result.error) throw formatError(result.error, "Salvar Parâmetros");
        return result.data;
    }
};

export const AdminService = {
    async listAllUsers() {
        const { data, error } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
        if (error) throw formatError(error, "Listar Usuários");
        return data as UserProfile[];
    },

    async updateUserRole(userId: string, newRole: string) {
        const { data, error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId).select().single();
        if (error) throw formatError(error, "Atualizar Cargo");
        return data;
    },

    async createUser(email: string, password: string, fullName: string, role: string) {
        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const { data, error } = await tempClient.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) throw formatError(error, "Criar Usuário Auth");

        const { error: profileError } = await supabase.from('profiles').upsert({ id: data.user!.id, email, full_name: fullName, role });
        if (profileError) throw formatError(profileError, "Definir Perfil Inicial");
        return data.user;
    },

    async uploadTemplateBackground(file: File) {
        const fileName = `system_assets/template_background_latest`;
        await supabase.storage.from('process-docs').upload(fileName, file, { cacheControl: '0', upsert: true });
        const { data } = supabase.storage.from('process-docs').getPublicUrl(fileName);
        return data.publicUrl + '?t=' + Date.now();
    },

    getTemplateBackgroundUrl() {
        const { data } = supabase.storage.from('process-docs').getPublicUrl('system_assets/template_background_latest');
        return `${data.publicUrl}?t=${Date.now()}`;
    }
};

export const TourService = {
    async uploadScene(processId: string, file: File, title: string) {
        const fileName = `tours/${processId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error: upError } = await supabase.storage.from('process-docs').upload(fileName, file);
        if (upError) throw formatError(upError, "Upload Tour");

        const { data: url } = supabase.storage.from('process-docs').getPublicUrl(fileName);

        const { data, error } = await supabase.from('tour_scenes').insert([{
            process_id: processId, title, image_url: url.publicUrl
        }]).select().single();

        if (error) throw formatError(error, "Salvar Cena");
        return data;
    },

    async getScenes(processId: string) {
        const { data, error } = await supabase.from('tour_scenes').select('*').eq('process_id', processId).order('created_at');
        if (error) throw formatError(error, "Listar Cenas");
        return data as TourScene[];
    },

    async deleteScene(id: string) {
        const { error } = await supabase.from('tour_scenes').delete().eq('id', id);
        if (error) throw formatError(error, "Deletar Cena");
    }
};
