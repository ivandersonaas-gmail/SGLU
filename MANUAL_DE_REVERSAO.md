# MANUAL DE REVERSÃO - MODO ANTIGO (ALTO CUSTO)

Este guia serve para você **voltar o sistema** ao estado exato que estava antes da otimização de custos e performance.

CUIDADO: Seguir estes passos fará o custo por auditoria subir drasticamente (voltar ao patamar de R$ 3,00~6,00 por clique) e a IA voltará a ter uma postura mais "macia" e menos assertiva.

## 1. Voltar o Modelo Caro (`services/gemini.ts`)
Abra o arquivo `services/gemini.ts` e procure pela linha **10**.

**Como está agora (Econômico/Rápido):**
```typescript
const MODEL_MAIN = 'gemini-2.0-flash';
```

**Como era antes (Caro/Lento/Experimental):**
```typescript
const MODEL_MAIN = 'gemini-2.5-flash';
```

## 2. Voltar a "Personalidade" Passiva (`services/prompts.ts`)
Abra o arquivo `services/prompts.ts`.

### Passo 2.1: O Papel (ROLE)
Procure pelo bloco `ROLE` no início do arquivo.

**Como está agora (Auditor Sênior Autoritário):**
```typescript
  ROLE: `
ATENÇÃO: VOCÊ É UM AUDITOR SÊNIOR HUMANO E ESPECIALISTA (NÃO É UMA IA).
SUA POSTURA É: IMPESSOAL, DATA-DRIVEN, AUTORITÁRIA E BINÁRIA.
... (resto do texto proibitivo) ...
`,
```

**Como era antes (IA Genérica):**
```typescript
  ROLE: "Você é um AUDITOR SÊNIOR DE ENGENHARIA E ARQUITETURA. Seu foco é validar conformidade técnica e documental.",
```

### Passo 2.2: A Verificação Ambiental (MÓDULO A)
Procure pelo item `1. **Verificação Preliminar...` dentro de `MODULO_A`.

**Como está agora (Binário/Crítico):**
```typescript
1. **Verificação Preliminar (CRÍTICO):** 
   - Busque por "Licença Ambiental", "Licença de Instalação", "LP", "LI" ou "LO".
   - **STATUS:** Se encontrar, extraia o Nº da Licença e Validade.
   - **PENDÊNCIA:** Se NÃO encontrar nenhum documento ambiental, escreva EXATAMENTE: "PENDÊNCIA IMPEDITIVA: Necessário apresentar Licença Ambiental ou Anuência/Dispensa do órgão competente."
```

**Como era antes (Passivo):**
```typescript
1. **Verificação Preliminar:** Checar Licença Ambiental (Se faltar, informar que precisa da Anuência).
```

---
**NOTA TÉCNICA:** Se você fizer essas alterações, o sistema voltará a agir exatamente como antes. Guarde este arquivo caso mude de ideia no futuro.
