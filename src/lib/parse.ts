import type { FrontmatterFields, ParsedSkill, SectionKind, SkillSection } from "../types.ts";

const MAX_PARSE = 80_000;

function headingKind(heading: string): SectionKind {
  const stripped = heading
    .replace(/^#{1,6}\s+/, "")
    .replace(/[:\-–]\s*$/, "")
    .trim()
    .toLowerCase();
  if (/^(steps?|checklist|procedure|playbook|how to)\b/.test(stripped)) return "steps";
  if (/^(refuse|never|never do|never-do|pitfalls|out of scope|don'?t|do not)\b/.test(stripped)) {
    return "refuse";
  }
  if (/^(success|success criteria|verification|done when|done|acceptance|criteria)\b/.test(stripped)) {
    return "success";
  }
  if (/^(when to use|use when|when|goal \/ when to use|goal\/when to use)\b/.test(stripped)) {
    return "when";
  }
  return "other";
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      if (trimmed.startsWith('"')) return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatterBlock(block: string): FrontmatterFields {
  const fields: FrontmatterFields = {};
  const lines = block.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const folded = line.match(/^([A-Za-z0-9_-]+)\s*:\s*([>|])[-+]?\s*$/);
    if (folded) {
      const key = folded[1];
      const chunks: string[] = [];
      i += 1;
      while (i < lines.length && (/^\s+\S/.test(lines[i]) || lines[i].trim() === "")) {
        chunks.push(lines[i].replace(/^\s+/, ""));
        i += 1;
      }
      fields[key] = chunks.join(folded[2] === ">" ? " " : "\n").trim();
      continue;
    }
    const simple = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (simple && !line.startsWith(" ") && !line.startsWith("\t")) {
      fields[simple[1]] = unquote(simple[2]);
    }
    i += 1;
  }
  return fields;
}

function splitFrontmatter(raw: string): { hasFrontmatter: boolean; frontmatterRaw: string; body: string } {
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) {
    return { hasFrontmatter: false, frontmatterRaw: "", body: text };
  }
  const rest = text.slice(3);
  if (!rest.startsWith("\n") && !rest.startsWith("\r\n")) {
    return { hasFrontmatter: false, frontmatterRaw: "", body: text };
  }
  const close = rest.search(/\n---[ \t]*(?:\n|$)/);
  if (close === -1) {
    return { hasFrontmatter: false, frontmatterRaw: "", body: text };
  }
  const frontmatterRaw = rest.slice(rest.startsWith("\r\n") ? 2 : 1, close);
  const after = rest.slice(close).replace(/^\n---[ \t]*/, "").replace(/^\n/, "");
  return { hasFrontmatter: true, frontmatterRaw, body: after };
}

function firstHeading(body: string): string | null {
  const match = body.match(/^#{1,6}\s+(\S[^\n]*)$/m);
  return match ? match[1].trim() : null;
}

function collectListItems(block: string): string[] {
  const items: string[] = [];
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*(?:\d+[.)]\s+|[-*•–—]\s+|\[[ xX]\]\s+)(.+)$/);
    if (match) {
      const text = match[1].replace(/\s+/g, " ").trim();
      if (text) items.push(text);
    }
  }
  return items;
}

function collectNumberedAnywhere(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (match) {
      const text = match[1].replace(/\s+/g, " ").trim();
      if (text.length >= 8) items.push(text);
    }
  }
  return items;
}

function parseSections(body: string): SkillSection[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sections: SkillSection[] = [];
  let current: SkillSection = { heading: "", kind: "other", body: "" };
  const flush = () => {
    const text = current.body.trim();
    if (current.heading || text) {
      sections.push({ ...current, body: text });
    }
  };
  for (const line of lines) {
    if (/^#{1,6}\s+\S/.test(line)) {
      flush();
      current = { heading: line.trim(), kind: headingKind(line), body: "" };
      continue;
    }
    current.body += (current.body ? "\n" : "") + line;
  }
  flush();
  return sections;
}

export function parseSkill(markdown: string): ParsedSkill {
  const raw = markdown.slice(0, MAX_PARSE);
  const { hasFrontmatter, frontmatterRaw, body } = splitFrontmatter(raw);
  const fields = hasFrontmatter ? parseFrontmatterBlock(frontmatterRaw) : {};
  const name = fields.name?.trim() || null;
  const description = fields.description?.trim() || null;
  const sections = parseSections(body);
  const stepSection = sections.find((section) => section.kind === "steps");
  const refuseSection = sections.find((section) => section.kind === "refuse");
  const successSection = sections.find((section) => section.kind === "success");

  const stepsFromSection = stepSection ? collectListItems(stepSection.body) : [];
  const numbered = collectNumberedAnywhere(body);
  const steps = stepsFromSection.length >= numbered.length ? stepsFromSection : numbered;

  const refuse = refuseSection
    ? collectListItems(refuseSection.body).length
      ? collectListItems(refuseSection.body)
      : refuseSection.body
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length >= 8)
    : [];

  const success = successSection
    ? collectListItems(successSection.body).length
      ? collectListItems(successSection.body)
      : successSection.body
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length >= 8)
    : [];

  const nonEmptyLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  return {
    raw,
    hasFrontmatter,
    frontmatterRaw,
    body,
    fields,
    name,
    description,
    title: firstHeading(body),
    sections,
    steps,
    refuse,
    success,
    charCount: raw.trim().length,
    nonEmptyLines,
  };
}

export function isKebabName(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name) && name.length >= 2 && name.length <= 64;
}

export function slugify(input: string): string {
  const stop = new Set(["a", "an", "the", "and", "or", "of"]);
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !stop.has(word));
  const fallback = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  let slug = (words.length ? words.join("-") : fallback)
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/g, "");
  if (!slug || !/^[a-z]/.test(slug)) slug = `skill-${slug || "untitled"}`.slice(0, 64);
  if (slug.endsWith("-")) slug = slug.slice(0, -1);
  return slug || "untitled-skill";
}

export function yamlScalar(value: string): string {
  if (value === "") return '""';
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || /['"]/.test(value) || /^\s|\s$/.test(value) || value.includes("\n")) {
    return JSON.stringify(value);
  }
  return value;
}

export function lintId(source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `SL-${(hash >>> 0).toString(16).toUpperCase().padStart(4, "0").slice(-4)}`;
}

export function titleFromName(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
