
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

async function checkLaws() {
    console.log("🔍 Checking 'legislation_files' table...");

    const { data: laws, error } = await supabase.from('legislation_files').select('*');

    if (error) {
        console.error("❌ Database Error:", error.message);
        return;
    }

    if (!laws || laws.length === 0) {
        console.log("⚠️ No laws found in the database.");
        return;
    }

    console.log(`✅ Found ${laws.length} laws.`);

    laws.forEach(law => {
        const textLen = law.extracted_text ? law.extracted_text.length : 0;
        const status = textLen > 50 ? "✅ CACHED" : "❌ EMPTY/MISSING";
        console.log(`- [${status}] ${law.name} (${law.category}) | Text Length: ${textLen} chars`);
    });
}

checkLaws();
