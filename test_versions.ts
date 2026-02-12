
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const keyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

async function testModel(modelName: string) {
    console.log(`Testing ${modelName}...`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, reply with just 'OK'" }] }]
            })
        });
        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            console.log(`✅ ${modelName}: SUCCESS`);
            return true;
        } else {
            console.log(`❌ ${modelName}: FAILED (${data.error?.message || 'Unknown error'})`);
            return false;
        }
    } catch (e: any) {
        console.log(`❌ ${modelName}: ERROR ${e.message}`);
        return false;
    }
}

async function run() {
    // 1.5 Family (Standard)
    await testModel('gemini-1.5-flash');
    await testModel('gemini-1.5-flash-001');
    await testModel('gemini-1.5-flash-002');
    await testModel('gemini-1.5-pro');

    // 2.0 Family (NewStandard)
    await testModel('gemini-2.0-flash');
    await testModel('gemini-2.0-flash-lite');

    // 2.5 Family (Experimental/Preview as per user list)
    await testModel('gemini-2.5-flash');
}

run();
