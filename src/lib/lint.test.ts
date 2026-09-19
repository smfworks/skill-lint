import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { bandFrom, gradeFromScore, lintSkill } from "./lint.ts";
import { parseSkill } from "./parse.ts";
import { findSecrets } from "./secrets.ts";

const sampleDir = join(fileURLToPath(new URL(".", import.meta.url)), "../../public/samples");

function loadSample(id: string): string {
  return readFileSync(join(sampleDir, `${id}.md`), "utf8");
}

describe("sample bands", () => {
  it("inbox-triage lands GREEN / A", () => {
    const result = lintSkill(loadSample("inbox-triage"));
    assert.ok(result);
    assert.equal(result.band, "GREEN");
    assert.equal(result.grade, "A");
    assert.ok(result.score >= 90);
    assert.equal(result.findings.length, 0);
    assert.equal(result.skillName, "inbox-triage");
  });

  it("weekly-notes lands YELLOW (vague description / missing refuse)", () => {
    const result = lintSkill(loadSample("weekly-notes"));
    assert.ok(result);
    assert.equal(result.band, "YELLOW");
    assert.ok(result.findings.some((item) => item.id === "description-use-when"));
    assert.ok(result.findings.some((item) => item.id === "refuse"));
    assert.ok(result.score >= 55);
    assert.ok(result.score < 90);
  });

  it("vibe-ops lands YELLOW (vibes / thin steps)", () => {
    const result = lintSkill(loadSample("vibe-ops"));
    assert.ok(result);
    assert.equal(result.band, "YELLOW");
    assert.ok(result.findings.some((item) => item.id === "steps"));
    assert.ok(result.findings.some((item) => item.id === "actionable"));
  });

  it("ship-it lands RED (no frontmatter / secret / empty steps)", () => {
    const result = lintSkill(loadSample("ship-it"));
    assert.ok(result);
    assert.equal(result.band, "RED");
    assert.equal(result.grade, "F");
    assert.ok(result.findings.some((item) => item.id === "frontmatter" && item.severity === "error"));
    assert.ok(result.findings.some((item) => item.id === "secrets" && item.severity === "error"));
    assert.ok(result.findings.some((item) => item.id === "steps" && item.severity === "error"));
    assert.ok(result.score < 55);
  });
});

describe("lintSkill", () => {
  it("returns null for empty paste", () => {
    assert.equal(lintSkill("   "), null);
  });

  it("scores in well under a second", () => {
    const started = performance.now();
    const result = lintSkill(loadSample("inbox-triage").repeat(3));
    const elapsed = performance.now() - started;
    assert.ok(result);
    assert.ok(elapsed < 1000, `linted in ${elapsed}ms`);
  });

  it("is deterministic for the same paste", () => {
    const paste = loadSample("weekly-notes");
    const a = lintSkill(paste, new Date("2026-09-16T17:00:00Z"));
    const b = lintSkill(paste, new Date("2026-09-16T17:00:00Z"));
    assert.deepEqual(a, b);
  });

  it("letter grades follow the published cutoffs", () => {
    assert.equal(gradeFromScore(100), "A");
    assert.equal(gradeFromScore(90), "A");
    assert.equal(gradeFromScore(89), "B");
    assert.equal(gradeFromScore(65), "C");
    assert.equal(gradeFromScore(49), "F");
  });

  it("secrets or missing frontmatter force RED", () => {
    assert.equal(bandFrom(88, [{ id: "secrets", title: "s", severity: "error", detail: "", hint: "", weight: 8, deducted: 8 }]), "RED");
    assert.equal(bandFrom(88, [{ id: "frontmatter", title: "f", severity: "error", detail: "", hint: "", weight: 12, deducted: 12 }]), "RED");
    assert.equal(
      bandFrom(88, [{ id: "refuse", title: "r", severity: "error", detail: "", hint: "", weight: 12, deducted: 12 }]),
      "YELLOW",
    );
    assert.equal(bandFrom(94, []), "GREEN");
  });

  it("emits schemaVersion skill-lint/v1", () => {
    const result = lintSkill(loadSample("inbox-triage"));
    assert.equal(result?.schemaVersion, "skill-lint/v1");
    assert.equal(result?.heuristic, true);
  });
});

describe("parseSkill", () => {
  it("reads kebab name and description from frontmatter", () => {
    const skill = parseSkill(loadSample("inbox-triage"));
    assert.equal(skill.hasFrontmatter, true);
    assert.equal(skill.name, "inbox-triage");
    assert.match(skill.description ?? "", /Use this when/i);
    assert.ok(skill.steps.length >= 3);
    assert.ok(skill.refuse.length >= 1);
    assert.ok(skill.success.length >= 1);
  });
});

describe("findSecrets", () => {
  it("flags sk-proj tokens and api_key assignments", () => {
    const hits = findSecrets("api_key=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCD");
    assert.ok(hits.length >= 1);
    assert.ok(hits.some((hit) => hit.kind === "assignment" || hit.kind === "sk-token"));
  });

  it("flags xai- and sk-svcacct- prefixes", () => {
    const hits = findSecrets(
      "xai-abcdefghijklmnopqrstuvwxyz0123456789ABCD\nsk-svcacct-abcdefghijklmnopqrstuvwxyz012345",
    );
    assert.ok(hits.some((hit) => hit.kind === "xai-token"));
    assert.ok(hits.some((hit) => hit.kind === "sk-token"));
  });

  it("does not flag inbox-triage", () => {
    assert.equal(findSecrets(loadSample("inbox-triage")).length, 0);
  });
});
