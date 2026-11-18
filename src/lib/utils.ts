export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['\"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'quiz';
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeText(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function stripOuterStars(s: string) {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('*') && t.endsWith('*')) return t.slice(1, -1).trim();
  return null;
}

export function matchesAcceptedAnswer(givenRaw: string, acceptedRaw: string) {
  const accepted = String(acceptedRaw ?? '').trim();
  const given = String(givenRaw ?? '');
  if (!accepted) return false;

  // =exact (case-sensitive, trimmed)
  if (accepted.startsWith('=')) {
    return given.trim() === accepted.slice(1).trim();
  }

  // *keyword* (case-insensitive contains)
  const kw = stripOuterStars(accepted);
  if (kw !== null) {
    return normalizeText(given).includes(normalizeText(kw));
  }

  // default: case-insensitive normalized exact match
  return normalizeText(given) === normalizeText(accepted);
}

export function textContainsKeywords(text: string, keywords: string[]) {
  const hay = normalizeText(text);
  const keys = keywords.map((k) => normalizeText(k)).filter(Boolean);
  if (!keys.length) return null;
  return keys.every((k) => hay.includes(k));
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r}s`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function toLocalDateTimeInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalDateTimeInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
