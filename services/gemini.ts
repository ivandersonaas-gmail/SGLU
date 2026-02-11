
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

  let lawsContext = "NENHUMA LEI ESPECÍFICA CARREGADA.";
  try {
    const laws = await LegislationService.listLaws();
    if (laws && laws.length > 0) {
      lawsContext = "LEIS NA BASE: " + laws.map(l => `"${l.name}"`).join(", ") + ".";
    }
  } catch (e) { console.warn("Falha laws:", e); }

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
    technicalModuleTitle = "QUADRO TÉCNICO (Módulo B - Loteamento/Condomínio - Art. 87 Plano Diretor)";
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

## 4. CONTEXTO DE LEIS LOCAIS
${lawsContext}

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

  /* 
  const tools: any[] = [];
  if (attachments.length === 0 && mode === 'LICENSING' && toolHandlers) {
    if (useGrounding) tools.push({ googleSearch: {} });
    tools.push({ functionDeclarations: licensingTools });
  }
  */

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
        msgParts.push({ text: newMessage });
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
