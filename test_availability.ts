
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

const apiKey = keyMatch[1].trim();

async function testSpecificModel(modelName: string) {
    console.log(`\n🔍 Testing model availability: ${modelName}`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello" }] }]
            })
        });

        const data = await response.json();

        if (response.ok && !data.error) {
            console.log(`✅ ${modelName} is AVAILABLE and working!`);
            return true;
        } else {
            console.error(`❌ ${modelName} contains error:`, data.error?.message || data);
            return false;
        }
    } catch (error) {
        console.error(`❌ Network error testing ${modelName}:`, error);
        return false;
    }
}

async function runTests() {
    await testSpecificModel('gemini-1.5-flash');
    await testSpecificModel('gemini-1.5-pro');
    await testSpecificModel('gemini-2.0-flash');
    // Testing what user called "2.5 flash" - likely non-existent or experimental
    await testSpecificModel('gemini-2.5-flash');
}

runTests();
