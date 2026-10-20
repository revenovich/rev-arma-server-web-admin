/**
 * Integer typed into a number field, or null when it isn't one ("", "-", "1.5").
 *
 * Number fields keep the raw text while the user types: `parseInt(v) || 0`
 * turned "-" into 0, so "-1" could never be entered (it became "01").
 */
export function parseWholeNumber(raw: string): number | null {
  const text = raw.trim();
  if (!/^-?\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}
