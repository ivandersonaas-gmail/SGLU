
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function inspectContent() {
    console.log("🔍 Inspecting 'prisma' and 'ventilacao'...");

    // 1. Search for 'prisma'
    const { data: prisma } = await supabase.from('legislation_files').select('name, extracted_text').textSearch('extracted_text', 'prisma', { type: 'websearch', config: 'portuguese' }).limit(1);
    console.log(`\nResults for 'prisma': ${prisma?.length}`);
    if (prisma?.length) console.log(`Preview: ${prisma[0].extracted_text.substring(0, 100)}...`);

    // 2. Search for 'ventilacao' (no accent)
    const { data: ventilacaoNoAccent } = await supabase.from('legislation_files').select('name').textSearch('extracted_text', 'ventilacao', { type: 'websearch', config: 'portuguese' });
    console.log(`Results for 'ventilacao': ${ventilacaoNoAccent?.length}`);

    // 3. Search for 'ventilação' (with accent)
    const { data: ventilacaoAccent } = await supabase.from('legislation_files').select('name').textSearch('extracted_text', 'ventilação', { type: 'websearch', config: 'portuguese' });
    console.log(`Results for 'ventilação': ${ventilacaoAccent?.length}`);

    // 4. Search for 'prisma ventilação' (OR logic simulation)
    const { data: orLogic } = await supabase.from('legislation_files').select('name').textSearch('extracted_text', 'prisma | ventilação', { type: 'websearch', config: 'portuguese' });
    console.log(`Results for 'prisma | ventilação': ${orLogic?.length}`);
}

inspectContent();
