import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { lintSkill } from "./lint.ts";
import { findSecrets } from "./secrets.ts";

const sampleDir = join(fileURLToPath(new URL(".", import.meta.url)), "../../public/samples");

function loadSample(id: string): string {
  return readFileSync(join(sampleDir, `${id}.md`), "utf8");
}

describe("suggestFixedMarkdown", () => {
  it("turns ship-it into a secret-free skill that lints GREEN", () => {
    const original = lintSkill(loadSample("ship-it"));
    assert.ok(original);
    assert.equal(original.band, "RED");
    assert.ok(original.suggestedMarkdown);
    assert.equal(findSecrets(original.suggestedMarkdown).length, 0);
    const fixed = lintSkill(original.suggestedMarkdown);
    assert.ok(fixed);
    assert.equal(fixed.band, "GREEN");
    assert.ok(fixed.score >= 80);
    assert.match(fixed.suggestedMarkdown, /^---\nname:/);
    assert.match(fixed.suggestedMarkdown, /Use this when/i);
    assert.match(fixed.suggestedMarkdown, /## Refuse/);
  });

  it("repairs weekly-notes refuse + use-when", () => {
    const original = lintSkill(loadSample("weekly-notes"));
    assert.ok(original);
    const fixed = lintSkill(original.suggestedMarkdown);
    assert.ok(fixed);
    assert.equal(fixed.band, "GREEN");
    assert.match(original.suggestedMarkdown, /Use this when/i);
    assert.match(original.suggestedMarkdown, /## Refuse/);
  });

  it("leaves a green skill essentially intact", () => {
    const original = lintSkill(loadSample("inbox-triage"));
    assert.ok(original);
    assert.match(original.suggestedMarkdown, /name: inbox-triage/);
    assert.match(original.suggestedMarkdown, /Do not auto-reply to lawyers/);
  });
});
