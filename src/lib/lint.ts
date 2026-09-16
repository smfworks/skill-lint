import { ACTION_VERBS, DEFAULT_REFUSE, DEFAULT_SUCCESS, RULES, RULE_WEIGHT_TOTAL, VIBE_WORDS } from "../data/rules.ts";
import type { Band, Finding, Grade, LintResult, PassedCheck, ParsedSkill, Severity } from "../types.ts";
import { SCHEMA_VERSION } from "../types.ts";
import { suggestFixedMarkdown } from "./fix.ts";
import { isKebabName, lintId, parseSkill } from "./parse.ts";
import { findSecrets } from "./secrets.ts";

interface RuleOutcome {
  severity: Severity | "pass";
  detail: string;
  hint: string;
}

function outcome(ruleId: string, result: RuleOutcome): { finding?: Finding; passed?: PassedCheck } {
  const rule = RULES.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`Unknown rule ${ruleId}`);
  if (result.severity === "pass") {
    return { passed: { id: rule.id, title: rule.title } };
  }
  const deducted = result.severity === "error" ? rule.weight : Math.round(rule.weight / 2);
  return {
    finding: {
      id: rule.id,
      title: rule.title,
      severity: result.severity,
      detail: result.detail,
      hint: result.hint,
      weight: rule.weight,
      deducted,
    },
  };
}

function checkStub(skill: ParsedSkill): RuleOutcome {
  if (skill.charCount < 40) {
    return {
      severity: "error",
      detail: `Only ${skill.charCount} characters.`,
      hint: "Paste a real SKILL.md — frontmatter, steps, refuse, success.",
    };
  }
  if (skill.charCount < 160 || skill.nonEmptyLines < 6) {
    return {
      severity: "warn",
      detail: `Thin file (${skill.charCount} chars, ${skill.nonEmptyLines} lines).`,
      hint: "Add numbered steps and a refuse list so an agent can actually run it.",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

function checkFrontmatter(skill: ParsedSkill): RuleOutcome {
  if (!skill.hasFrontmatter) {
    return {
      severity: "error",
      detail: "No YAML frontmatter (needs opening and closing ---).",
      hint: "Start the file with --- then name and description, then --- again.",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

function checkNamePresent(skill: ParsedSkill): RuleOutcome {
  if (!skill.name) {
    return {
      severity: "error",
      detail: "Frontmatter is missing `name`.",
      hint: "Add `name: my-skill` in kebab-case (matches the folder).",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

function checkNameKebab(skill: ParsedSkill): RuleOutcome {
  if (!skill.name) {
    return {
      severity: "error",
      detail: "Cannot check kebab-case without a name.",
      hint: "Add a kebab-case `name` between 2 and 64 characters.",
    };
  }
  if (skill.name.length > 64) {
    return {
      severity: "warn",
      detail: `Name is ${skill.name.length} chars (max 64).`,
      hint: "Shorten `name` to 64 characters or fewer.",
    };
  }
  if (skill.name.length < 2) {
    return {
      severity: "error",
      detail: "Name is too short.",
      hint: "Use at least two characters, starting with a letter.",
    };
  }
  if (!isKebabName(skill.name)) {
    return {
      severity: "warn",
      detail: `“${skill.name}” is not kebab-case.`,
      hint: "Lowercase letters, digits, single hyphens. Example: inbox-triage.",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

function checkDescriptionPresent(skill: ParsedSkill): RuleOutcome {
  if (!skill.description) {
    return {
      severity: "error",
      detail: "Frontmatter is missing `description`.",
      hint: "Add a one-line description. Routers pick skills from this field.",
    };
  }
  if (skill.description.length > 1024) {
    return {
      severity: "warn",
      detail: `Description is ${skill.description.length} chars (max 1024).`,
      hint: "Trim the description. Lead with when to load the skill.",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

function checkUseWhen(skill: ParsedSkill): RuleOutcome {
  const description = skill.description ?? "";
  if (!description) {
    return {
      severity: "error",
      detail: "No description to scan for “Use this when …”.",
      hint: "Write `description: Use this when <trigger>.`",
    };
  }
  if (/use this when\b/i.test(description) || /use this skill when\b/i.test(description)) {
    return { severity: "pass", detail: "", hint: "" };
  }
  return {
    severity: "error",
    detail: "Description does not include “Use this when …”.",
    hint: "Rewrite as `Use this when <the trigger that should load this skill>.`",
  };
}

function checkSteps(skill: ParsedSkill): RuleOutcome {
  const count = skill.steps.length;
  if (count === 0) {
    return {
      severity: "error",
      detail: "No numbered or bulleted steps found.",
      hint: "Add a Steps section with at least three numbered actions.",
    };
  }
  if (count < 3) {
    return {
      severity: "warn",
      detail: `Only ${count} step${count === 1 ? "" : "s"} found.`,
      hint: "Spell out three or more steps an agent can execute without guessing.",
    };
  }
  const short = skill.steps.filter((step) => step.length < 12).length;
  if (short >= Math.ceil(count / 2)) {
    return {
      severity: "warn",
      detail: "Steps are too short to follow.",
      hint: "Each step should name the action and the object (scan subject, draft reply).",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

function checkRefuse(skill: ParsedSkill): RuleOutcome {
  if (!skill.refuse.length) {
    return {
      severity: "error",
      detail: "No Refuse / Never / Pitfalls section with content.",
      hint: "Add `## Refuse` with what the agent must never do (send, spend, exfil, irreversible).",
    };
  }
  const text = skill.refuse.join(" ");
  if (text.length < 40 || skill.refuse.every((line) => line.length < 24)) {
    return {
      severity: "warn",
      detail: "Refuse list is too thin to bound the skill.",
      hint: "Name concrete never-dos: no unattended send, no secrets in chat, no prod writes.",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

function checkSuccess(skill: ParsedSkill): RuleOutcome {
  if (!skill.success.length) {
    return {
      severity: "warn",
      detail: "No Success / Verification / Done-when section.",
      hint: "Add measurable success criteria a human can check after the run.",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

function checkSecrets(skill: ParsedSkill): RuleOutcome {
  const hits = findSecrets(skill.raw);
  if (!hits.length) return { severity: "pass", detail: "", hint: "" };
  const kinds = [...new Set(hits.map((hit) => hit.kind))].join(", ");
  return {
    severity: "error",
    detail: `Possible secret (${kinds}): ${hits[0].excerpt}`,
    hint: "Delete the token. Reference an env var name instead — never paste live credentials.",
  };
}

function checkActionable(skill: ParsedSkill): RuleOutcome {
  const haystack = `${skill.description ?? ""} ${skill.body}`.toLowerCase();
  const vibeHits = VIBE_WORDS.filter((word) => haystack.includes(word));
  const verbHits = (haystack.match(new RegExp(ACTION_VERBS.source, "gi")) ?? []).length;
  if (vibeHits.length >= 3 && verbHits < 4) {
    return {
      severity: "warn",
      detail: `Vibe language (${vibeHits.slice(0, 3).join(", ")}) without enough action verbs.`,
      hint: "Replace slogans with numbered verbs: scan, draft, hold, refuse, verify.",
    };
  }
  if (vibeHits.length >= 2 && skill.steps.length < 3) {
    return {
      severity: "warn",
      detail: "Sounds like a pitch deck, not a playbook.",
      hint: "Drop world-class / synergy / magic. Write the steps you actually want run.",
    };
  }
  return { severity: "pass", detail: "", hint: "" };
}

const CHECKS: Record<string, (skill: ParsedSkill) => RuleOutcome> = {
  stub: checkStub,
  frontmatter: checkFrontmatter,
  "name-present": checkNamePresent,
  "name-kebab": checkNameKebab,
  "description-present": checkDescriptionPresent,
  "description-use-when": checkUseWhen,
  steps: checkSteps,
  refuse: checkRefuse,
  success: checkSuccess,
  secrets: checkSecrets,
  actionable: checkActionable,
};

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function bandFrom(score: number, findings: Finding[]): Band {
  const ids = new Set(findings.filter((item) => item.severity === "error").map((item) => item.id));
  const hardRed =
    ids.has("secrets") || ids.has("frontmatter") || (ids.has("stub") && score < 55);
  if (hardRed || score < 55) return "RED";
  if (ids.size > 0 || score < 80) return "YELLOW";
  return "GREEN";
}

export function summarizeResult(skillName: string | null, grade: Grade, band: Band, findings: Finding[]): string {
  const name = skillName ?? "untitled-skill";
  if (!findings.length) return `${name} graded ${grade} ${band} — all checks clear.`;
  const top = findings[0];
  return `${name} graded ${grade} ${band} — ${top.title.toLowerCase()}: ${top.detail}`;
}

export function lintSkill(markdown: string, now = new Date()): LintResult | null {
  const trimmed = markdown.trim();
  if (!trimmed) return null;
  const skill = parseSkill(trimmed);
  const findings: Finding[] = [];
  const passed: PassedCheck[] = [];

  for (const rule of RULES) {
    const check = CHECKS[rule.id];
    const result = outcome(rule.id, check(skill));
    if (result.finding) findings.push(result.finding);
    if (result.passed) passed.push(result.passed);
  }

  const deducted = findings.reduce((sum, item) => sum + item.deducted, 0);
  const score = Math.max(0, Math.min(100, RULE_WEIGHT_TOTAL - deducted));
  const grade = gradeFromScore(score);
  const band = bandFrom(score, findings);
  const suggestedMarkdown = suggestFixedMarkdown(skill, findings);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: lintId(trimmed),
    skillName: skill.name,
    score,
    grade,
    band,
    findings,
    passed,
    heuristic: true,
    lintedAt: now.toISOString(),
    charCount: skill.charCount,
    suggestedMarkdown,
    summary: summarizeResult(skill.name, grade, band, findings),
  };
}

export function isLintResult(value: unknown): value is LintResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === SCHEMA_VERSION &&
    typeof record.score === "number" &&
    typeof record.grade === "string" &&
    typeof record.band === "string" &&
    Array.isArray(record.findings)
  );
}

export function resultFromJson(value: unknown): LintResult | null {
  if (!isLintResult(value)) return null;
  return {
    ...value,
    schemaVersion: SCHEMA_VERSION,
    heuristic: true,
    findings: value.findings ?? [],
    passed: value.passed ?? [],
    suggestedMarkdown: value.suggestedMarkdown ?? "",
    summary: value.summary ?? summarizeResult(value.skillName, value.grade, value.band, value.findings ?? []),
    id: value.id || lintId(JSON.stringify(value)),
    lintedAt: value.lintedAt || new Date().toISOString(),
    charCount: value.charCount ?? 0,
  };
}

export { DEFAULT_REFUSE, DEFAULT_SUCCESS };
