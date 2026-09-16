import { DEFAULT_REFUSE, DEFAULT_SUCCESS } from "../data/rules.ts";
import type { Finding, ParsedSkill } from "../types.ts";
import { isKebabName, slugify, titleFromName, yamlScalar } from "./parse.ts";
import { redactSecrets } from "./secrets.ts";

const USE_WHEN = /use this (?:skill )?when\b/i;

function ensureUseWhen(text: string): string {
  let body = text
    .trim()
    .replace(/^use this skill when\s+/i, "")
    .replace(/^use this when\s+/i, "")
    .replace(/^use when\s+/i, "")
    .replace(/^whenever\s+/i, "")
    .replace(/^when\s+/i, "");
  body = body.replace(/\s+/g, " ").trim();
  if (!body) body = "the operator needs a bounded playbook the agent can follow";
  const sentence = body.charAt(0).toLowerCase() + body.slice(1);
  let description = `Use this when ${sentence}`;
  if (!/[.!?]$/.test(description)) description += ".";
  if (description.length > 1024) {
    description = `${description.slice(0, 1021).replace(/\s+\S*$/, "")}...`;
  }
  return description;
}

function mdList(items: string[], ordered = false): string {
  return items
    .map((item, index) => (ordered ? `${index + 1}. ${item}` : `- ${item}`))
    .join("\n");
}

function needsFix(findings: Finding[], id: string): boolean {
  return findings.some((finding) => finding.id === id);
}

export function suggestFixedMarkdown(skill: ParsedSkill, findings: Finding[]): string {
  const redactedRaw = redactSecrets(skill.raw);
  if (!findings.length && redactedRaw === skill.raw) return skill.raw.trimEnd() + "\n";

  const nameSource = skill.name || skill.title || "untitled-skill";
  const name = skill.name && isKebabName(skill.name) && skill.name.length <= 64
    ? skill.name
    : slugify(nameSource);

  let description = skill.description || skill.title || nameSource;
  if (!USE_WHEN.test(description) || needsFix(findings, "description-use-when") || needsFix(findings, "description-present")) {
    description = ensureUseWhen(description);
  }

  const title = skill.title || titleFromName(name);

  const steps = [...skill.steps];
  if (steps.length < 3) {
    const fillers = [
      "Read the request and name the skill you are running.",
      "Follow each remaining step in order. Draft only — do not send, spend, or deploy.",
      "Stop and ask a human before any consequential or irreversible act.",
    ];
    for (const filler of fillers) {
      if (steps.length >= 3) break;
      if (!steps.some((step) => step.toLowerCase() === filler.toLowerCase())) steps.push(filler);
    }
  }

  let refuse = [...skill.refuse];
  if (!refuse.length || needsFix(findings, "refuse")) {
    const merged = [...refuse];
    for (const line of DEFAULT_REFUSE) {
      if (!merged.some((item) => item.toLowerCase() === line.toLowerCase())) merged.push(line);
    }
    refuse = merged;
  }

  let success = [...skill.success];
  if (!success.length || needsFix(findings, "success")) {
    const merged = [...success];
    for (const line of DEFAULT_SUCCESS) {
      if (!merged.some((item) => item.toLowerCase() === line.toLowerCase())) merged.push(line);
    }
    success = merged;
  }

  const intro = skill.sections
    .filter((section) => section.kind === "other" && section.body.trim())
    .map((section) => {
      const heading = section.heading ? `${section.heading}\n\n` : "";
      const cleaned = redactSecrets(section.body)
        .split("\n")
        .filter((line) => !/^\s*\d+[.)]\s+/.test(line))
        .join("\n")
        .trim();
      if (!cleaned) return "";
      if (!section.heading && title && cleaned.startsWith(title)) return cleaned;
      return `${heading}${cleaned}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");

  const frontmatter = [
    "---",
    `name: ${yamlScalar(name)}`,
    `description: ${yamlScalar(description)}`,
    `version: "1.0.0"`,
    "license: MIT",
    "---",
  ].join("\n");

  const body = [
    `# ${title}`,
    "",
    intro || `${title} — follow the steps, refuse the rest, and leave a result a human can check.`,
    "",
    "## Steps",
    "",
    mdList(steps, true),
    "",
    "## Refuse",
    "",
    mdList(refuse),
    "",
    "## Success criteria",
    "",
    mdList(success),
    "",
  ].join("\n");

  return `${frontmatter}\n\n${body}`.replace(/\n{3,}/g, "\n\n");
}
