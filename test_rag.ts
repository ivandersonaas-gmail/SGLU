
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
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

async function testRag() {
    console.log("🔍 Testing RAG Search for 'artigo 242'...");

    // Simulate the query logic from services/supabase.ts
    const query = 'artigo 242';

    const { data, error } = await supabase
        .from('legislation_files')
        .select('name, category, extracted_text')
        .textSearch('extracted_text', query, {
            type: 'websearch',
            config: 'portuguese'
        })
        .limit(5);

    if (error) {
        console.error("❌ Search Error:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("⚠️ No results found.");
        return;
    }

    console.log(`✅ Found ${data.length} results.`);
    data.forEach(item => {
        console.log(`- [${item.category}] ${item.name}`);
        console.log(`  Preview: ${item.extracted_text.substring(0, 100)}...`);
    });
}

testRag();
