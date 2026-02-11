
import * as pdfjsLib from 'pdfjs-dist';

const pdfjs = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs) {
    try {
        if (!pdfjs.GlobalWorkerOptions) {
            (pdfjs as any).GlobalWorkerOptions = {};
        }
        if (pdfjs.GlobalWorkerOptions) {
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    } catch (e) {
        console.warn("[PDF] Falha ao configurar worker PDF:", e);
    }
}

export const PdfService = {
    async extractTextFromUrl(url: string): Promise<string> {
        try {
            const loadingTask = pdfjs.getDocument(url);
            const pdf = await loadingTask.promise;
            return await this.processPdfPages(pdf);
        } catch (e: any) {
            console.error("[PDF] Erro fatal URL:", e);
            return `[ERRO DE LEITURA PDF URL]`;
        }
    },

    async extractTextFromBase64(base64: string): Promise<string> {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const loadingTask = pdfjs.getDocument({ data: bytes });
            const pdf = await loadingTask.promise;
            return await this.processPdfPages(pdf);
        } catch (e: any) {
            console.error("[PDF] Erro fatal Base64:", e);
            return ""; 
        }
    },

    async processPdfPages(pdf: any): Promise<string> {
        let fullText = '';
        // Limite expandido para 200 páginas para suportar contratos e memoriais densos
        const maxPages = Math.min(pdf.numPages, 200); 

        for (let i = 1; i <= maxPages; i++) {
            // Liberar a thread principal a cada 2 páginas para manter UI fluida
            if (i % 2 === 0) await new Promise(resolve => setTimeout(resolve, 0));

            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += `\n--- PÁGINA ${i} ---\n${pageText}\n`;
            } catch (e) {
                console.warn(`[PDF] Falha página ${i}`);
            }
        }
        return fullText;
    }
};
