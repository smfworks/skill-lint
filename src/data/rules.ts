import type { RuleDef } from "../types.ts";

/**
 * Lint rule table. Edit weights / copy here; checks live in `src/lib/lint.ts`.
 * Weights sum to 100 so the score is explainable: pass = full, warn = half, error = 0.
 */
export const RULES: readonly RuleDef[] = [
  {
    id: "stub",
    title: "Not empty / not a stub",
    weight: 10,
    summary: "A skill needs enough body to follow. Tiny pastes fail.",
  },
  {
    id: "frontmatter",
    title: "YAML frontmatter present",
    weight: 12,
    summary: "Opens and closes with --- and parses as a mapping.",
  },
  {
    id: "name-present",
    title: "Frontmatter name",
    weight: 8,
    summary: "Required `name` field in frontmatter.",
  },
  {
    id: "name-kebab",
    title: "Name is kebab-case",
    weight: 6,
    summary: "2–64 chars, `a-z0-9-`, starts with a letter, no double hyphens.",
  },
  {
    id: "description-present",
    title: "Frontmatter description",
    weight: 8,
    summary: "Required `description` field — routers select on this line.",
  },
  {
    id: "description-use-when",
    title: "Description says when to use",
    weight: 10,
    summary: "Starts with or clearly includes “Use this when …”.",
  },
  {
    id: "steps",
    title: "Numbered or clear steps",
    weight: 14,
    summary: "At least three actionable steps the agent can follow.",
  },
  {
    id: "refuse",
    title: "Refuse / never-do section",
    weight: 12,
    summary: "A non-empty Refuse, Never, Pitfalls, or Do-not section.",
  },
  {
    id: "success",
    title: "Success criteria",
    weight: 8,
    summary: "Verification / done-when / success criteria the human can check.",
  },
  {
    id: "secrets",
    title: "No obvious secrets",
    weight: 8,
    summary: "No api_key=, sk-, bearer tokens, or long high-entropy strings.",
  },
  {
    id: "actionable",
    title: "Actionable language",
    weight: 4,
    summary: "Prefer verbs and gates over vibe words (world-class, synergy, magic).",
  },
] as const;

export const RULE_WEIGHT_TOTAL = RULES.reduce((sum, rule) => sum + rule.weight, 0);

export const DEFAULT_REFUSE = [
  "Do not send external messages, money, or public posts without a human review.",
  "Do not exfiltrate secrets, credentials, private customer data, or .env files.",
  "Do not invent medical, legal, or financial advice.",
  "Do not make irreversible production changes without an explicit approval.",
];

export const DEFAULT_SUCCESS = [
  "Each numbered step completed or explicitly skipped with a reason.",
  "Any consequential act is held for a human — a safe refuse is a valid outcome.",
];

export const VIBE_WORDS = [
  "world-class",
  "world class",
  "seamless",
  "leverage",
  "synergy",
  "empower",
  "delight",
  "cutting-edge",
  "cutting edge",
  "next-gen",
  "next generation",
  "holistic",
  "magically",
  "magic",
  "vibes",
  "just figure",
  "be helpful",
  "unlock potential",
  "game-changing",
  "game changing",
  "best-in-class",
  "best in class",
  "robust",
  "innovative",
  "disrupt",
  "10x",
  "supercharge",
];

export const ACTION_VERBS =
  /\b(scan|check|confirm|verify|open|read|draft|send|hold|archive|flag|sort|pull|collect|create|update|tag|deploy|watch|announce|prepare|issue|post|ask|review|run|test|smoke|compare|record|attach|quote|page|stop|rollback|notify|summarize|write|copy|paste|extract|label|move|close|refuse|redact|lint|parse|count|list|diff)\b/i;
