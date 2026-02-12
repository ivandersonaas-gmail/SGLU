
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

const MODEL_NAME = 'gemini-2.5-flash';

console.log(`🔑 Testing Model: ${MODEL_NAME}...`);

async function testModel() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: "Responda apenas com: 'OK, TESTE CONFIRMADO'." }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            console.error("❌ FALHA NO TESTE:", data.error.message);
            return;
        }

        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (text) {
            console.log("\n✅ SUCESSO! O modelo respondeu:");
            console.log("------------------------------------------------");
            console.log(text.trim());
            console.log("------------------------------------------------");
            console.log("O sistema está operando com gemini-2.5-flash (Modelo Ativo e Funcional).");
        } else {
            console.log("⚠️ Resposta vazia ou formato inesperado:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("❌ Erro de Rede:", error);
    }
}

testModel();
