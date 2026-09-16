export type Severity = "error" | "warn" | "info";

export type Band = "GREEN" | "YELLOW" | "RED";

export type Grade = "A" | "B" | "C" | "D" | "F";

export type SectionKind = "steps" | "refuse" | "success" | "when" | "other";

export interface FrontmatterFields {
  name?: string;
  description?: string;
  [key: string]: string | undefined;
}

export interface SkillSection {
  heading: string;
  kind: SectionKind;
  body: string;
}

export interface ParsedSkill {
  raw: string;
  hasFrontmatter: boolean;
  frontmatterRaw: string;
  body: string;
  fields: FrontmatterFields;
  name: string | null;
  description: string | null;
  title: string | null;
  sections: SkillSection[];
  steps: string[];
  refuse: string[];
  success: string[];
  charCount: number;
  nonEmptyLines: number;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  detail: string;
  hint: string;
  weight: number;
  deducted: number;
}

export interface PassedCheck {
  id: string;
  title: string;
}

/** JSON other tools can emit so Skill Lint can print a card without re-linting. */
export interface LintResult {
  schemaVersion: "skill-lint/v1";
  id: string;
  skillName: string | null;
  score: number;
  grade: Grade;
  band: Band;
  findings: Finding[];
  passed: PassedCheck[];
  heuristic: true;
  lintedAt: string;
  charCount: number;
  suggestedMarkdown: string;
  summary: string;
}

export interface SampleMeta {
  id: string;
  file: string;
  label: string;
  blurb: string;
  expect: Band;
}

export interface RuleDef {
  id: string;
  title: string;
  weight: number;
  /** Short README line. */
  summary: string;
}

export const BAND_META: Record<
  Band,
  { label: string; sub: string; zone: string; emoji: string; className: string }
> = {
  GREEN: {
    label: "GREEN",
    sub: "SHIPPABLE",
    zone: "CLEAR",
    emoji: "🟢",
    className: "is-green",
  },
  YELLOW: {
    label: "YELLOW",
    sub: "NEEDS WORK",
    zone: "REVIEW",
    emoji: "🟡",
    className: "is-yellow",
  },
  RED: {
    label: "RED",
    sub: "DO NOT SHIP",
    zone: "BLOCK",
    emoji: "🔴",
    className: "is-red",
  },
};

export const SCHEMA_VERSION = "skill-lint/v1" as const;
