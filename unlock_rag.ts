
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read API Key manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
    console.error("❌ Credentials not found in .env.local");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function unlockRag() {
    console.log("🔓 Attempting to UNLOCK RAG (Check Permissions)...");

    // 1. Tenta ler para ver se já está acessível
    const { data, error } = await supabase.from('legislation_files').select('count', { count: 'exact', head: true });

    if (!error) {
        console.log("✅ LEITURA JÁ ESTÁ LIBERADA! (RLS parece OK ou Desativado)");
        console.log("O problema deve ser apenas no código do Front-end (Regex/Query).");
    } else {
        console.error("❌ LEITURA BLOQUEADA PELO BANCO (RLS ATIVO E SEM POLÍTICA):", error.message);
        console.log("\n⚠️ VOCÊ PRECISA RODAR O SQL ABAIXO NO SUPABASE DASHBOARD:\n");
        console.log(`
        ALTER TABLE legislation_files ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Leitura pública de leis" ON legislation_files;
        CREATE POLICY "Leitura pública de leis" ON legislation_files FOR SELECT USING (true);
        `);
    }
}

unlockRag();
