
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

const SUPABASE_URL = urlMatch[1];
const SUPABASE_ANON_KEY = keyMatch[1];

// FORCE ANON KEY USAGE
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

async function simulateBrowserRag() {
    console.log("🌐 Simulating Browser RAG Request (ANON KEY)...");

    const rawInput = 'qual artigo fala do prisma de ventilação';
    // SIMULATING THE FRONTEND NORMALIZATION
    let query = rawInput.toLowerCase()
        .replace(/\bart\.?\b/gi, 'artigo ')
        .replace(/\bpar\.?\b/gi, 'parágrafo ')
        .replace(/\binc\.?\b/gi, 'inciso ')
        // Stop words (SEM ARTIGOS/PREPOSIÇÕES para evitar quebra de acentos)
        .replace(/\b(qual|que|diz|sobre|fala|onde|tem)\b/gi, ' ')
        .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (query.length < 3) query = rawInput.replace(/[^\w\s]/gi, ' ');

    console.log(`Input: "${rawInput}" -> Otimizada: "${query}"`);

    // Simulate exactly what services/supabase.ts does (STRICT SEARCH)
    let { data, error } = await supabase
        .from('legislation_files')
        .select('name, category, extracted_text')
        .textSearch('extracted_text', query, {
            type: 'websearch',
            config: 'portuguese'
        })
        .limit(5);

    // FALLBACK LOGIC SIMULATION
    if (!data || data.length === 0) {
        console.log("⚠️ SIMULATION: Strict search failed. Trying BROAD search (OR)...");
        const broadQuery = query.split(' ').join(' | ');
        console.log(` Broader Query: "${broadQuery}"`);

        const { data: broadData, error: broadError } = await supabase
            .from('legislation_files')
            .select('name, category, extracted_text')
            .textSearch('extracted_text', broadQuery, {
                type: 'websearch',
                config: 'portuguese'
            })
            .limit(5);

        data = broadData;
        error = broadError;
    }

    if (error) {
        console.error("❌ BROWSER SIMULATION FAILED:", error.message);
        console.error("Detail:", error);
    } else if (!data || data.length === 0) {
        console.warn("⚠️ BROWSER SIMULATION RETURNED EMPTY RESULTS.");
        console.log("This might mean the search index is not updating or the query is still issue.");
    } else {
        console.log(`✅ BROWSER SIMULATION SUCCESS! Found ${data.length} results.`);
        console.log("First result:", data[0].name);
    }
}

simulateBrowserRag();
