
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yvtaqikuasbulcgnvnks.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wComVgJjcq_KFFAqkqkDkw_5kiKxsoT';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    console.log("--- DEBUG START ---");

    // Check Content
    const { data, error } = await supabase.from('legislation_files').select('*');
    if (error) {
        console.error("READ ERROR:", error.message);
    } else {
        console.log(`Found ${data?.length} records.`);
        data?.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`Name: ${row.name}`);
            console.log(`Extracted Text Length: ${row.extracted_text ? row.extracted_text.length : 0}`);
            console.log("---");
        });
    }
    console.log("--- DEBUG END ---");
}

check();
