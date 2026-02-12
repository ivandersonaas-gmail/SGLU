
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const keyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);

const apiKey = keyMatch![1];
const ai = new GoogleGenAI({ apiKey });

async function testModel() {
    const modelName = 'gemini-2.5-pro';
    console.log(`Testing model: ${modelName}`);
    try {
        const chat = ai.chats.create({ model: modelName });
        const res = await chat.sendMessage({ message: { role: 'user', parts: [{ text: "Hello, are you functional?" }] } });
        console.log("✅ Model Response:", res.text);
    } catch (e: any) {
        console.error("❌ Model Error:", e.message);
    }
}

testModel();
