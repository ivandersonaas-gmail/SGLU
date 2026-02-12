
export interface AuditItem {
    id: string;
    text: string;
    status: 'ok' | 'error' | 'warning' | 'pending';
    source?: string;
    comment?: string;
}

export interface AuditSection {
    title: string;
    items: AuditItem[];
}

export interface ParsedAudit {
    processInfo: {
        protocolo: string;
        interessado: string;
        assunto: string;
    };
    sections: AuditSection[];
}

export function parseAuditMarkdown(markdown: string): ParsedAudit {
    const lines = markdown.split('\n');
    const sections: AuditSection[] = [];
    let currentSection: AuditSection | null = null;

    const result: ParsedAudit = {
        processInfo: { protocolo: '', interessado: '', assunto: '' },
        sections: []
    };

    // Helper to determine status from icons or keywords
    const getStatus = (text: string): AuditItem['status'] => {
        if (text.includes('✅') || text.toLowerCase().includes('apresentado') || text.toLowerCase().includes('parecer: ok')) return 'ok';
        if (text.includes('❌') || text.toLowerCase().includes('não consta') || text.toLowerCase().includes('pendente') || text.toLowerCase().includes('erro')) return 'error';
        if (text.includes('⚠️') || text.toLowerCase().includes('atenção') || text.toLowerCase().includes('divergência')) return 'warning';
        return 'pending'; // Default
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // 1. Extract Process Info (Header)
        if (trimmed.startsWith('•\tProtocolo:') || trimmed.match(/Protocolo:/i)) {
            result.processInfo.protocolo = trimmed.split(':')[1]?.trim() || '';
        }
        else if (trimmed.startsWith('•\tInteressado:') || trimmed.match(/Interessado:/i)) {
            result.processInfo.interessado = trimmed.split(':')[1]?.trim() || '';
        }
        else if (trimmed.startsWith('•\tAssunto:') || trimmed.match(/Assunto:/i)) {
            result.processInfo.assunto = trimmed.split(':')[1]?.trim() || '';
        }

        // 2. Detect Section Headers (Módulo A, B, Fases)
        // Looking for numbered headers "2. CHECKLIST...", "4. QUADRO TÉCNICO..." or "4.1. FASE..."
        const sectionMatch = trimmed.match(/^(\d+\.?\d*)\.?\s+(.*)/);
        if (sectionMatch && (trimmed.toUpperCase().includes('CHECKLIST') || trimmed.toUpperCase().includes('QUADRO') || trimmed.toUpperCase().includes('FASE'))) {
            if (currentSection) {
                sections.push(currentSection);
            }
            currentSection = {
                title: sectionMatch[2], // The text part of the header
                items: []
            };
            return;
        }

        // 3. Detect Items (Bullet points)
        if (currentSection && (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('o\t'))) {
            const cleanText = trimmed.replace(/^[•\-o]\s+/, '').trim();
            currentSection.items.push({
                id: `row-${index}`,
                text: cleanText,
                status: getStatus(cleanText)
            });
        }
    });

    // Push the last section
    if (currentSection) {
        sections.push(currentSection);
    }

    result.sections = sections;
    return result;
}
