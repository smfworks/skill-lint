import type { LintResult } from "../types.ts";
import { BAND_META } from "../types.ts";

const SHARE_URL = "https://github.com/smfworks/skill-lint";

export function formatStampTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

export function formatShareText(result: LintResult): string {
  const meta = BAND_META[result.band];
  const name = result.skillName ?? "untitled-skill";
  const lines = [
    `${meta.emoji} ${result.grade} · ${result.band} · ${result.score}/100`,
    `Skill Lint · ${name}`,
    "",
  ];
  if (!result.findings.length) {
    lines.push("All checks clear.");
  } else {
    for (const finding of result.findings.slice(0, 6)) {
      const mark = finding.severity === "error" ? "✕" : "!";
      lines.push(`${mark} ${finding.title}: ${finding.hint}`);
    }
  }
  lines.push("", "Skill Lint · SMF Works", SHARE_URL);
  return lines.join("\n");
}

export function formatCompactStats(result: LintResult): string {
  const errors = result.findings.filter((item) => item.severity === "error").length;
  const warns = result.findings.filter((item) => item.severity === "warn").length;
  return `${result.grade} ${result.band} · ${result.score}/100 · ${errors} err · ${warns} warn`;
}

export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
