
import React from 'react';


export enum AgentMode {
  GENERAL = 'GENERAL',
  CODING = 'CODING',
  VISION = 'VISION',
  LIVE_VOICE = 'LIVE_VOICE',
  LICENSING = 'LICENSING'
}

export enum Role {
  USER = 'user',
  MODEL = 'model'
}

// App Views (ERP Navigation)
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  PROTOCOL = 'PROTOCOL',
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  ADMIN_PANEL = 'ADMIN_PANEL',
  LEGISLATION = 'LEGISLATION',
  DOC_TEMPLATES = 'DOC_TEMPLATES' // Nova View
}

export enum UserRole {
  ADMIN = 'ADMIN',
  PROTOCOLO = 'PROTOCOLO',
  LICENCIAMENTO = 'LICENCIAMENTO',
  FISCALIZACAO = 'FISCALIZACAO'
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

export interface AttachmentData {
  data: string; // base64
  mimeType: string;
  name?: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  attachments?: AttachmentData[];
  isGrounding?: boolean;
  sources?: Array<{ title: string; uri: string }>;
}

export interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
}

// --- SUPABASE DATABASE TYPES ---

export type ProcessStatus = 'PROTOCOLADO' | 'EM_ANALISE' | 'PENDENTE_DOC' | 'FISCALIZACAO' | 'ANUENCIA_EMITIDA' | 'AGUARDANDO_ASSINATURA' | 'FINALIZADO' | 'INDEFERIDO';

export type ProcessType = 
  | 'Alteração de Tit. e/ou Projeto Aprovado com Habite-se'
  | 'Alteração de Tit. e/ou projeto aprovado com habite-se - Comercial'
  | 'Revista de Habite-se'
  | 'Célere'
  | 'Licença para Construção'
  | 'Licença para Construção - Acima de 400m²'
  | 'Licença para Construção - Comercial'
  | 'Alteração de Tit. e/ou Projeto Aprovado'
  | 'Alteração de Tit. e/ou Projeto Aprovado - Comercial'
  | 'Levantamento Cadastral'
  | 'Levantamento Cadastral - Comercial'
  | 'Reforma e Ampliação'
  | 'Reforma e Ampliação – Comercial'
  | 'Habite-se – Comercial'
  | 'Desmembramento'
  | 'Remembramento'
  | 'Retificação Territorial'
  | 'Licença para Implantação de Loteamento e Condomínio'
  | 'Identificação de endereço/quadra e lote'
  | 'Lançamento de área no perímetro urbano'
  | 'Alvará de regularização de edificação'
  | 'Revisita'
  | 'OUTROS LICENCIAMENTOS'
  | 'Certidão de anuência de uso de solo'
  | 'Visita fiscal'
  | '2ª Via de documento'
  | 'Licença de Instalação de Equipamento - Antena'
  | 'Licenciamento Urbano'
  | 'Demolição'
  | 'HABITE_SE' 
  | 'ALVARA_CONSTRUCAO';

export type PersonType = 'PF' | 'PJ';

export interface Applicant {
  id: string;
  created_at?: string;
  name: string;
  cpf: string; 
  person_type: PersonType;
  phone: string;
  email?: string;
}

export interface Process {
  id: string; 
  created_at?: string;
  protocol_number: string;
  applicant_id: string;
  type: ProcessType;
  status: ProcessStatus;
  current_sector: string;
  address_work: string;
  technical_notes?: string;
  analyst_id?: string | null;
  applicants?: Applicant; 
  // Join com profiles para saber o nome do analista
  analyst_profile?: UserProfile; 
}

export interface Document {
  id: string;
  process_id: string;
  name: string;
  file_url: string;
  file_type: string; // 'PROJETO', 'DOC_PESSOAL', 'ART', 'OUTROS'
  created_at: string;
  analyzed_by_ai: boolean;
  ai_summary?: string;
}

export interface TourScene {
    id: string;
    process_id: string;
    title: string;
    image_url: string;
    created_at: string;
}

// History Interface
export interface ProcessHistory {
  id: string;
  created_at: string;
  process_id: string;
  action: string;
  user_notes?: string;
}

// New: Legislation Library
export interface LegislationFile {
  id: string;
  name: string;
  category: 'ZONEAMENTO' | 'CODIGO_OBRAS' | 'PLANO_DIRETOR' | 'AMBIENTAL' | 'OUTROS';
  file_url: string;
  description?: string;
}

// DOCUMENT TEMPLATES
export interface DocumentTemplate {
    id: string;
    type: 'HABITE_SE' | 'ALVARA' | 'ANUENCIA';
    content: string; // HTML string with tags
    updated_at: string;
}

// New: Extracted Parameters for Audit
export type AuditStatus = 'CONFORME' | 'IRREGULAR' | 'NA' | 'PENDENTE' | 'DIVERGENTE';

export interface AuditItem {
    status: AuditStatus;
    value?: string | number;
    ai_value?: string | number;
    evidence_doc?: string;
    irregularity_note?: string;
    timestamp?: number;
    custom_data?: any;
}

// Specific Audit Structures
export interface PreliminaryCheck {
    one_doc_status: 'SIM' | 'NAO' | null;
    one_doc_obs?: string;
    env_license_status: 'SIM' | 'NAO' | 'NA' | null;
    env_license_ai_proof?: string; 
}

export interface CertificateData {
    quadra?: string;
    lote?: string;
    loteamento?: string;
    matricula?: string;
}

// New: Comparison Matrix Items
export interface ComparisonItem {
    source_a: string; 
    source_b: string; 
    source_c?: string; 
    source_d?: string; 
    status: 'CONFORME' | 'DIVERGENTE' | 'PENDENTE';
    obs?: string;
}

export interface ProjectParameters {
  id?: string;
  process_id: string;
  area_total?: number;
  area_terreno?: number;
  taxa_ocupacao?: number;
  permeabilidade?: number;
  area_uso_comum?: number; 
  indice_aproveitamento?: number; 
  recuo_frontal?: number;
  recuo_lateral_esq?: number;
  recuo_lateral_dir?: number;
  recuo_fundos?: number;
  zona_uso?: string;
  ai_validation_summary?: string;
  status_compliance?: 'CONFORME' | 'INFRACAO' | 'ANALISE_MANUAL' | 'PENDENTE';
  audit_json?: {
      current_step?: number;
      steps_validated?: {
          preliminary?: boolean; 
          documentation?: boolean; 
          cross_reference?: boolean; 
          responsibility?: boolean; 
      };
      
      // STEP 1: Preliminar
      preliminary_data?: PreliminaryCheck;

      // STEP 2: Documentos & Consistência
      entity_validation?: {
          person_type?: 'PF' | 'PJ';
          contrato_social?: AuditItem;
          procuracao?: AuditItem;
          doc_pessoal?: AuditItem;
      };
      
      certificate_data?: CertificateData; 

      documents_checklist?: {
          protocolo?: AuditItem;
          bci?: AuditItem;
          cnd?: AuditItem;
          inteiro_teor?: AuditItem;
          art_projeto?: AuditItem;
          art_execucao?: AuditItem;
          licenca_anterior?: AuditItem;
          projeto_aprovado?: AuditItem;
          avcb?: AuditItem;
          carta_avenca?: AuditItem;
          
          licenca_construcao?: AuditItem;
          taxa_bci?: AuditItem;
          taxa_cnd?: AuditItem;
          documento_escritura?: AuditItem;
          documento_inteiro_teor?: AuditItem;
          checklist_fiscal?: AuditItem;
          projetos_aprovados?: AuditItem;
          empresa_contrato?: AuditItem;
          pessoa_fisica_doc?: AuditItem;
          nome_endereco_consistencia?: AuditItem;
      };

      // STEP 3: Cruzamento de Dados (HABITE-SE) ou Engenharia (LICENÇA)
      titularity_matrix?: {
          protocol_vs_deed?: ComparisonItem; 
          protocol_vs_project?: ComparisonItem; 
          protocol_vs_art?: ComparisonItem; 
      };

      location_matrix?: {
          lot_block_compare?: ComparisonItem; 
          street_compare?: ComparisonItem; 
          neighborhood_compare?: ComparisonItem; 
      };

      dimension_matrix?: {
          land_area_compare?: ComparisonItem; 
          built_area_compare?: ComparisonItem; 
      };

      checklist_matrix?: {
          piso_tatil?: AuditItem;
          janelas_vizinhanca?: AuditItem;
          revestimento_impermeavel?: AuditItem; 
          
          recuo_frontal?: AuditItem;
          recuos_laterais?: AuditItem;
          recuo_fundos?: AuditItem; 
          taxa_ocupacao?: AuditItem; 
          projeto_assinado?: AuditItem;
          medidas_conferem?: AuditItem; 
          confrontantes_conferem?: AuditItem; 
          area_uso_comum?: AuditItem; 

          habitabilidade?: AuditItem;
          calcada_padrao?: AuditItem;
          numeracao_predial?: AuditItem;
          area_vistoria_vs_projeto?: AuditItem;
      };

      // STEP 4: Responsabilidade (Licenciamento)
      responsibility_matrix?: {
          certidao_data_check?: AuditItem;

          protocol_vs_deed?: ComparisonItem;
          protocol_vs_project?: ComparisonItem;
          protocol_vs_art?: ComparisonItem;
          
          lot_block_compare?: ComparisonItem;
          street_compare?: ComparisonItem;
          neighborhood_compare?: ComparisonItem;
          
          land_area_compare?: ComparisonItem;
      };
  };
}

export interface ChatInterfaceProps {
  mode: AgentMode;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  processId: string | null;
}

export interface ToolHandlers {
  listProcesses: (status?: string) => Promise<string>;
  getProcessDetails: (protocolNumber: string) => Promise<string>;
  createProcess: (applicantName: string, cpf: string, type: string, address: string) => Promise<string>;
  updateProcessStatus: (protocolNumber: string, newStatus: string, notes: string) => Promise<string>;
  saveTechnicalNote?: (protocolNumber: string, note: string) => Promise<string>;
  saveAuditParameters?: (args: any) => Promise<string>;
}