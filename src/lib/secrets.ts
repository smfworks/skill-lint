export interface SecretHit {
  kind: string;
  excerpt: string;
  start: number;
  end: number;
}

const PLACEHOLDER =
  /\b(YOUR[_-]?[A-Z0-9_]+|REPLACE[_-]?ME|REDACTED|TODO|CHANGEME|xxx+|sk-\.\.\.)\b/i;

const PATTERNS: Array<{ kind: string; regex: RegExp }> = [
  {
    kind: "assignment",
    regex:
      /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*['"]?[^\s'"]{8,}/gi,
  },
  {
    kind: "sk-token",
    regex: /\bsk-(?:live|test|proj|ant|admin)?-?[A-Za-z0-9]{12,}\b/g,
  },
  {
    kind: "bearer",
    regex: /\bBearer\s+[A-Za-z0-9._\-+=\/]{20,}/gi,
  },
  {
    kind: "github-pat",
    regex: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    kind: "slack",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    kind: "aws-key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    kind: "private-key",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    kind: "jwt",
    regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
];

function shannon(text: string): number {
  const freq = new Map<string, number>();
  for (const char of text) freq.set(char, (freq.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function looksLikeUrlOrPath(text: string, source: string, index: number): boolean {
  const before = source.slice(Math.max(0, index - 8), index);
  if (/https?:\/\/$/i.test(before) || /[\w.-]$/.test(before) && before.includes("://")) return true;
  if (/^https?:\/\//i.test(text)) return true;
  if (/^[./~]/.test(text) || text.includes("/")) return true;
  return false;
}

function highEntropyHits(source: string): SecretHit[] {
  const hits: SecretHit[] = [];
  const token = /(?<![A-Za-z0-9])[A-Za-z0-9_\-+/=]{40,}(?![A-Za-z0-9])/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    const value = match[0];
    if (PLACEHOLDER.test(value)) continue;
    if (looksLikeUrlOrPath(value, source, match.index)) continue;
    if (/^-+$/.test(value) || /^(.)\1+$/.test(value)) continue;
    const hasDigit = /\d/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    if (!(hasDigit && (hasLower || hasUpper))) continue;
    if (shannon(value) < 4.5) continue;
    hits.push({
      kind: "high-entropy",
      excerpt: clip(value),
      start: match.index,
      end: match.index + value.length,
    });
  }
  return hits;
}

function clip(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 28) return compact;
  return `${compact.slice(0, 14)}…${compact.slice(-6)}`;
}

export function findSecrets(source: string): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const { kind, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source))) {
      if (PLACEHOLDER.test(match[0])) continue;
      hits.push({
        kind,
        excerpt: clip(match[0]),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  hits.push(...highEntropyHits(source));
  hits.sort((a, b) => a.start - b.start);
  const merged: SecretHit[] = [];
  for (const hit of hits) {
    const last = merged[merged.length - 1];
    if (last && hit.start < last.end) continue;
    merged.push(hit);
  }
  return merged;
}

export function redactSecrets(source: string): string {
  const hits = findSecrets(source);
  if (!hits.length) return source;
  let output = "";
  let cursor = 0;
  for (const hit of hits) {
    output += source.slice(cursor, hit.start);
    output += "[REDACTED — set via env]";
    cursor = hit.end;
  }
  output += source.slice(cursor);
  return output;
}
