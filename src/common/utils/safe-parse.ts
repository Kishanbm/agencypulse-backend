export function safeInt(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Math.round(parseFloat(String(val)));
  return isFinite(n) ? n : 0;
}

export function safeFloat(val: unknown, decimals = 6): number {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(String(val));
  if (!isFinite(n)) return 0;
  return parseFloat(n.toFixed(decimals));
}

export function safeStr(val: unknown): string {
  return String(val ?? '').trim();
}
