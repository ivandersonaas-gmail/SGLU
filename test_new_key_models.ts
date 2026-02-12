
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const keyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

const modelsToTest = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash-lite'
];

async function testModel(modelName: string) {
    console.log(`\n🧪 Testing: ${modelName}...`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Explain quantum physics in 1 sentence." }] }]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.log(`❌ FAILED: ${data.error.message}`);
            return false;
        } else if (data.candidates && data.candidates[0].content) {
            console.log(`✅ SUCCESS! Response: "${data.candidates[0].content.parts[0].text.substring(0, 50)}..."`);
            return true;
        } else {
            console.log(`⚠️ UNEXPECTED RESPONSE:`, JSON.stringify(data).substring(0, 200));
            return false;
        }
    } catch (e: any) {
        console.log(`❌ ERROR: ${e.message}`);
        return false;
    }
}

async function run() {
    console.log("Starting diagnostics for NEW KEY...");
    for (const model of modelsToTest) {
        await testModel(model);
    }
}

run();
