import type { SampleMeta } from "../types.ts";

export const PASTE_PLACEHOLDER = `Paste a Hermes / OpenClaw SKILL.md.

---
name: example-skill
description: Use this when the operator needs a bounded playbook.
---

# Example skill

1. Read the request.
2. Follow the steps.
3. Stop for a human on anything consequential.

## Refuse
- Do not send mail without review.

## Success criteria
- The steps ran or a refuse was recorded.
`;

export const SAMPLES: SampleMeta[] = [
  {
    id: "inbox-triage",
    file: "/samples/inbox-triage.md",
    label: "Inbox triage",
    blurb: "Solid playbook · GREEN",
    expect: "GREEN",
  },
  {
    id: "weekly-notes",
    file: "/samples/weekly-notes.md",
    label: "Weekly notes",
    blurb: "Vague / no refuse · YELLOW",
    expect: "YELLOW",
  },
  {
    id: "vibe-ops",
    file: "/samples/vibe-ops.md",
    label: "Vibe ops",
    blurb: "Vibes, thin steps · YELLOW",
    expect: "YELLOW",
  },
  {
    id: "ship-it",
    file: "/samples/ship-it.md",
    label: "Ship it",
    blurb: "No frontmatter + token · RED",
    expect: "RED",
  },
];
