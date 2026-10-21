/**
 * Parses a rupee amount typed by a merchant into integer paise.
 * Accepts up to 2 decimals; rejects zero, negatives, junk and amounts above ₹1,00,000.
 */
export function parseRupeesToPaise(text: string): number | null {
  const cleaned = text.trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return null;
  const paise = Math.round(parseFloat(cleaned) * 100);
  return paise > 0 && paise <= 100000 * 100 ? paise : null;
}
