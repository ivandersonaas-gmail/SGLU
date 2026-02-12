
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function debugRag() {
    // A query problemática do usuário
    const rawInput = "qual artigo fala do prisma de ventilação";

    console.log(`\n🔎 Investigando: "${rawInput}"\n`);

    // 1. Simulação da Lógica Atual (Suja)
    let currentLogic = rawInput.toLowerCase()
        .replace(/\bart\.?\b/gi, 'artigo ')
        .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    console.log(`1️⃣ Query Atual (Enviada ao banco): "${currentLogic}"`);
    const { data: res1 } = await supabase.from('legislation_files').select('name').textSearch('extracted_text', currentLogic, { type: 'websearch', config: 'portuguese' });
    console.log(`   Resultado: ${res1?.length || 0} encontrados.`);

    // 2. Simulação da Lógica Proposta (Limpa)
    // Removemos: qual, fala, do, de
    let improvedLogic = rawInput.toLowerCase()
        .replace(/\bart\.?\b/gi, 'artigo ') // Normaliza
        .replace(/qual|o|que|diz|a|artigo|lei|sobre|do|da|de|em|na|no|fala|onde|tem/gi, ' ') // Stop words agressivas
        .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    console.log(`\n2️⃣ Query Proposta (Sem stop words): "${improvedLogic}"`);
    const { data: res2 } = await supabase.from('legislation_files').select('name').textSearch('extracted_text', improvedLogic, { type: 'websearch', config: 'portuguese' });
    console.log(`   Resultado: ${res2?.length || 0} encontrados.`);
}

debugRag();
