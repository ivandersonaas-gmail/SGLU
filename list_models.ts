
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// Read API Key manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const keyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);

if (!keyMatch) {
    console.error("❌ API Key not found in .env.local");
    process.exit(1);
}

const apiKey = keyMatch[1];
const ai = new GoogleGenAI({ apiKey });

async function listModels() {
    console.log("🔍 Listing available Gemini models...");
    try {
        // Since the Node SDK might not expose listModels directly on the main class in all versions, 
        // or if it does it might be under a different property.
        // Actually, for @google/genai (the new SDK), it's usually via the client or a specific endpoint.
        // Let's try to just run a generation with a few known candidates to see which one works if listModels isn't easily accessible
        // OR try the standard REST call if sdk fails.

        // Let's try to use the REST API for listing models to be 100% sure what the KEY sees.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const models = (data as any).models || [];

        console.log(`✅ Found ${models.length} models.`);
        models.forEach((m: any) => {
            if (m.name.includes("gemini")) {
                console.log(`- ${m.name} (${m.displayName})`);
            }
        });

    } catch (error) {
        console.error("❌ Error listing models:", error);
    }
}

listModels();
