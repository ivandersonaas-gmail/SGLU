
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// Load API Key
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : null;

if (!apiKey) {
    console.error("❌ API Key not found");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function verifyFlash() {
    console.log("🚀 Testing model: gemini-1.5-flash...");
    try {
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Explain why using a flash model is cost-effective for large contexts in 1 sentence.");
        const response = await result.response;
        const text = response.text();

        console.log("\n✅ SUCCESS! Model responded:");
        console.log("------------------------------------------------");
        console.log(text);
        console.log("------------------------------------------------");
        console.log("The system is now using a stable, low-cost model.");
    } catch (error) {
        console.error("❌ Error testing model:", error);
    }
}

verifyFlash();
