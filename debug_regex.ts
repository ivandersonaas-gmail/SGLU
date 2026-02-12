
const query = 'qual artigo fala do prisma de ventilação';
const cleaned = query
    .replace(/\b(qual|o|que|diz|a|artigo|lei|sobre|do|da|de|em|na|no|fala|onde|tem)\b/gi, ' ')
    .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

console.log(`Original: "${query}"`);
console.log(`Cleaned:  "${cleaned}"`);
console.log(`Hex: ${Buffer.from(cleaned).toString('hex')}`);
