
import { GoogleGenAI, GenerateContentResponse, Chat, Type, FunctionDeclaration } from "@google/genai";
import { Message, Role, ToolHandlers, AttachmentData } from "../types";
import { LegislationService } from './supabase';
import { PROMPTS_BASE } from './prompts';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const MODEL_MAIN = 'gemini-2.5-flash';

const licensingTools: FunctionDeclaration[] = [
  {
    name: 'save_audit_parameters',
    description: 'Salva os parâmetros técnicos da auditoria no banco de dados.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        protocol_number: { type: Type.STRING },
        compliance_status: { type: Type.STRING },
        summary: { type: Type.STRING },
        audit_json: { type: Type.OBJECT }
      },
      required: ['protocol_number', 'compliance_status'],
    },
  }
];

const getSystemInstruction = async (mode: string, specialty?: string) => {
  if (mode !== 'LICENSING') return "Você é um assistente útil. Responda em Português.";

  // Seleção da Lente Técnica
  let lensContent = "";
  switch (specialty) {
    case 'LOTEAMENTO': lensContent = PROMPTS_BASE.MODULO_B_LOTEAMENTO; break;
    case 'REFORMA': lensContent = PROMPTS_BASE.MODULO_REFORMA; break;
    case 'EDIFICACOES': lensContent = PROMPTS_BASE.MODULO_EDIFICACOES; break;
    case 'COMERCIAL': lensContent = PROMPTS_BASE.MODULO_COMERCIAL; break;
    default: lensContent = "Realize uma auditoria geral baseada nas normas urbanísticas vigentes.";
  }

  // Definição do Título do Módulo Técnico
  let technicalModuleTitle = "QUADRO TÉCNICO (Módulo Específico)";
  if (specialty === 'LOTEAMENTO') {
    technicalModuleTitle = `QUADRO TÉCNICO (Módulo B - Loteamento/Condomínio - Art. 87 Plano Diretor)
    
    4.1. FASE 1: PRÉ-APROVAÇÃO (Projeto Urbanístico)
    (Analise: ART, Dimensões, Raios, Cordas, Tangências, Numeração de Ruas)

    4.2. FASE 2: ATO DE APROVAÇÃO (Infraestrutura)
    (Analise: Drenagem [Estudo Capacidade, Memorial, ART], Cronograma, Anuências, Perfis de Vias, Marcos)

    4.3. FASE 3: LICENÇA DE IMPLANTAÇÃO
    (Analise: Projetos Complementares, ART Execução)`;
  } else if (specialty === 'REFORMA') {
    technicalModuleTitle = "QUADRO TÉCNICO (Módulo Reforma e Ampliação)";
  } else if (specialty === 'EDIFICACOES') {
    technicalModuleTitle = "QUADRO TÉCNICO (Módulo Edificações)";
  } else if (specialty === 'COMERCIAL') {
    technicalModuleTitle = "QUADRO TÉCNICO (Módulo Comercial/Industrial)";
  }

  return `
# ${PROMPTS_BASE.ROLE}

## 1. DIRETRIZES GERAIS
Analise os documentos anexados. Foco em detalhes técnicos e prova real.

## 2. REGRAS BASE
${PROMPTS_BASE.MODULO_A}

## 3. LENTE TÉCNICA ATIVA (ESPECIALIDADE)
${lensContent}

## 4. CONTEXTO DE LEIS (RAG - BUSCA SOB DEMANDA)
As leis específicas relevantes para a pergunta do usuário serão fornecidas contextualmente na mensagem abaixo.
Use APENAS as leis fornecidas. Se a lei não for citada, NÃO INVENTE.

## 5. INSTRUÇÃO DE SAÍDA (ESTRUTURA DO RELATÓRIO)

Analise os dados extraídos e gere um **LAUDO TÉCNICO** seguindo esta ordem lógica:

**1. IDENTIFICAÇÃO DO PROCESSO**
(Liste Protocolo, Interessado e Assunto)

**2. CHECKLIST DE EXISTÊNCIA DOCUMENTAL (Módulo A)**
(Liste verticalmente cada documento obrigatório e seu status: ✅ Apresentado ou ⚠️ Pendente. Cite o nome do arquivo onde encontrou).

**3. ANÁLISE DE CONFRONTO (PROVA REAL)**
(Cruze os dados. Exemplo:)
*   **Titularidade:** Escritura diz [X] vs Projeto diz [Y]. (Parecer: OK/Erro)
*   **Áreas:** Escritura [X]m² vs Projeto [Y]m² vs BCI [Z]m². (Parecer: OK/Erro)
*   **Endereço:** Confere em todos os docs?

**4. ${technicalModuleTitle}**
(Analise conforme as regras do módulo técnico ativo acima. Se for Loteamento, siga o Artigo 87 do Plano Diretor).

**5. RELAÇÃO DE PENDÊNCIAS (COMUNIQUE-SE)**
(Liste de forma clara e direta o que o requerente deve corrigir ou apresentar. Ex: "1. Apresentar CND.").

**6. CONCLUSÃO**
(Deferido ou Indeferido).
    `;
};

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const msg = error?.message || '';
    const code = error?.code || error?.status;
    if ((code === 429 || code === 503 || msg.includes('429') || msg.includes('quota')) && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const streamChatResponse = async (
  history: Message[],
  newMessage: string,
  attachments: AttachmentData[],
  mode: string,
  useGrounding: boolean,
  toolHandlers: ToolHandlers | undefined,
  onChunk: (text: string) => void,
  onSources: (sources: Array<{ title: string; uri: string }>) => void,
  highPrecision: boolean = false,
  specialty?: string
): Promise<void> => {

  const modelName = MODEL_MAIN;
  const systemInstruction = await getSystemInstruction(mode, specialty);

  // --- RAG IMPLEMENTATION (Busca Inteligente) ---
  let ragContext = "";
  if (mode === 'LICENSING' && newMessage.length > 5) {
    try {
      // TERCEIRA TENTATIVA (DEFINITIVA): Normalização Linguística
      // O banco tem "Artigo 242", mas o usuário digita "art 242". O Facet do Postgres não cruza "art" com "artigo".
      let failSafeQuery = newMessage.toLowerCase();

      // 1. Expande abreviações comuns em leis
      failSafeQuery = failSafeQuery
        .replace(/\bart\.?\b/gi, 'artigo ') // art. ou art -> artigo
        .replace(/\bpar\.?\b/gi, 'parágrafo ') // par. -> parágrafo
        .replace(/\binc\.?\b/gi, 'inciso '); // inc. -> inciso

      // 2. Limpeza de Stop Words (CONVERSACIONAL - CRÍTICAS APENAS)
      // Remove apenas palavras que desviam o foco semântico ("qual", "onde")
      // Mantemos artigos/preposições (o, a, de) pois o Regex \b quebra em acentos (ventilação -> ventila ç ã o -> remove o)
      failSafeQuery = failSafeQuery
        .replace(/\b(qual|que|diz|sobre|fala|onde|tem)\b/gi, ' ')
        .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ') // Remove símbolos
        .replace(/\s+/g, ' ')
        .trim();

      // Fallback: Se sobrou muito pouco, tenta a query original limpa
      if (failSafeQuery.length < 3) failSafeQuery = newMessage.replace(/[^\w\s]/gi, ' ');

      console.log(`🔍 RAG Query Otimizada: "${failSafeQuery}"`);

      let searchResults = await LegislationService.searchLegislation(failSafeQuery);

      // Fallback: Se não encontrar nada com a busca exata (AND), tenta busca ampla (OR)
      if (!searchResults || searchResults.length === 0) {
        console.log("⚠️ RAG: Busca exata falhou. Tentando busca ampla (OR)...");
        const broadQuery = failSafeQuery.split(' ').join(' | ');
        searchResults = await LegislationService.searchLegislation(broadQuery);
      }

      if (searchResults && searchResults.length > 0) {
        ragContext = `\n\n--- INFORMAÇÃO LEGISLATIVA RECUPERADA (RAG) ---\n` +
          searchResults.map(r => `>>> LEI: ${r.name} (${r.category})\nTRECHO RELEVANTE:\n${r.extracted_text}\n<<<`).join('\n\n') +
          `\n--- FIM DA INFORMAÇÃO LEGISLATIVA ---\n\nUse essas informações acima para responder, se aplicável.\n`;

        console.log(`🔍 RAG Encontrou ${searchResults.length} trechos para: "${failSafeQuery}"`);
      } else {
        console.log(`⚠️ RAG não encontrou nada para: "${failSafeQuery}"`);
      }
    } catch (err) {
      console.warn("Erro no RAG:", err);
    }
  }

  const finalMessage = ragContext + newMessage;
  // ----------------------------------------------

  const createChat = (model: string) => {
    const validHistory = history.filter(h => h.text && h.text.trim().length > 0).map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

    return ai.chats.create({
      model: model,
      config: {
        systemInstruction,
        // tools: undefined, // Tools disabled for 2.5
        temperature: 0.1,
      },
      history: validHistory
    });
  };

  try {
    let chat = createChat(modelName);
    let responseStream;

    const timeoutDuration = 600000;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_SECURITY")), timeoutDuration));

    try {
      const streamPromise = (async () => {
        let msgParts: any[] = [];
        if (attachments.length > 0) {
          const attParts = attachments.map(att => ({ inlineData: { mimeType: att.mimeType, data: att.data } }));
          msgParts = [...msgParts, ...attParts];
        }
        msgParts.push({ text: finalMessage });
        return await retryWithBackoff(() => chat.sendMessageStream({ message: msgParts as any }));
      })();

      responseStream = await Promise.race([streamPromise, timeoutPromise]);
    } catch (e: any) {
      if (e.message === "TIMEOUT_SECURITY") throw new Error("⚠️ Volume de documentos muito grande.");
      throw e;
    }

    await handleStreamResponse(responseStream, toolHandlers, onChunk, onSources, chat);

  } catch (error: any) {
    let errorMessage = `**ERRO:** ${error?.message || 'Falha na comunicação'}`;
    onChunk(errorMessage);
  }
};

async function handleStreamResponse(responseStream: any, toolHandlers: any, onChunk: any, onSources: any, chat: any) {
  let functionCallFound = null;
  try {
    for await (const chunk of responseStream) {
      const c = chunk as GenerateContentResponse;
      if (c.functionCalls && c.functionCalls.length > 0) functionCallFound = c.functionCalls[0];
      const text = c.text;
      if (text && !functionCallFound) onChunk(text);
    }
  } catch (e) { throw e; }

  if (functionCallFound && toolHandlers) {
    const { name, args, id } = functionCallFound;
    let functionResult = "Função executada.";
    try {
      if (name === 'save_audit_parameters') {
        if (toolHandlers.saveAuditParameters) functionResult = await toolHandlers.saveAuditParameters(args);
      }
    } catch (e: any) { functionResult = `Error: ${e.message}`; }

    const toolResponseStream: any = await retryWithBackoff(() => chat.sendMessageStream({
      message: [{ functionResponse: { name: name, id: id, response: { result: functionResult } } }]
    }));
    for await (const chunk of toolResponseStream) {
      const c = chunk as any;
      const text = c.text;
      if (text) onChunk(text);
    }
  }
}
