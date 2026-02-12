
import fs from 'fs';
import path from 'path';

// Read API Key manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : null;

if (!apiKey) {
    console.error("❌ API Key not found in .env.local");
    process.exit(1);
}

console.log("🔑 API Key found. Fetching models...");

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", data.error.message);
            return;
        }

        const models = data.models || [];
        console.log(`\n📋 Found ${models.length} models available for your key:\n`);

        let found25 = false;
        let found15Flash = false;

        models.forEach((m: any) => {
            const isFlash = m.name.includes('flash');
            const isPro = m.name.includes('pro');
            const icon = isFlash ? '⚡' : (isPro ? '🧠' : '🔹');

            // Highlight relevant models
            if (m.name.includes('gemini')) {
                console.log(`${icon} ${m.name.replace('models/', '')} (${m.displayName})`);
            }

            if (m.name.includes('2.5')) found25 = true;
            if (m.name.includes('1.5-flash')) found15Flash = true;
        });

        console.log("\n------------------------------------------------");
        if (!found25) {
            console.log("❌ CRITICAL: 'gemini-2.5-flash' DOES NOT EXIST in this list.");
            console.log("👉 When you use a non-existent name, the system defaults to a heavier model.");
        } else {
            console.log("✅ 'gemini-2.5-flash' found.");
        }

        if (found15Flash) {
            console.log("✅ 'gemini-1.5-flash' IS AVAILABLE and is the correct choice for low cost.");
        }

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

listModels();
