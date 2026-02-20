
import React, { useState } from 'react';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const AvailabilityTest: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const log = (msg: string) => setLogs(prev => [...prev, msg]);

    const testSpecificModel = async (modelName: string) => {
        log(`\n🔍 Testing model availability: ${modelName}`);
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
                log(`✅ ${modelName} is AVAILABLE and working!`);
            } else {
                log(`❌ ${modelName} contains error: ${data.error?.message || JSON.stringify(data)}`);
            }
        } catch (error) {
            log(`❌ Network error testing ${modelName}: ${error}`);
        }
    };

    const runTests = async () => {
        setIsRunning(true);
        setLogs([]);
        log("Iniciando testes de disponibilidade...");

        if (!apiKey) {
            log("❌ API Key not found in import.meta.env.VITE_GEMINI_API_KEY");
            setIsRunning(false);
            return;
        }

        await testSpecificModel('gemini-1.5-flash');
        await testSpecificModel('gemini-1.5-pro');
        await testSpecificModel('gemini-2.0-flash');
        await testSpecificModel('gemini-2.5-flash'); // Likely to fail as per user comment

        log("Testes finalizados.");
        setIsRunning(false);
    };

    return (
        <div className="p-8 bg-slate-900 min-h-full text-slate-100 font-mono">
            <h1 className="text-2xl font-bold mb-4">Gemini API Availability Test</h1>

            <div className="mb-4">
                <p>API Key defined: {apiKey ? '✅ Yes' : '❌ No'}</p>
                {apiKey && <p className="text-xs text-slate-500 mt-1">Key: {apiKey.substring(0, 10)}...</p>}
            </div>

            <button
                onClick={runTests}
                disabled={isRunning}
                className={`px-4 py-2 rounded ${isRunning ? 'bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
            >
                {isRunning ? 'Executando...' : 'Executar Teste'}
            </button>

            <div className="mt-8 bg-black p-4 rounded border border-slate-700 font-mono text-sm whitespace-pre-wrap">
                {logs.length === 0 ? <span className="text-slate-500">Logs aparecerão aqui...</span> : logs.join('\n')}
            </div>
        </div>
    );
};
