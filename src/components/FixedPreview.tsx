import { highlightSkill } from "../lib/highlight";

interface FixedPreviewProps {
  markdown: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}

export function FixedPreview({ markdown, open, onToggle }: FixedPreviewProps) {
  if (!markdown) return null;
  return (
    <section className="preview-card">
      <button
        type="button"
        className="preview-toolbar as-button"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        <div>
          <p className="eyebrow">Suggested fix</p>
          <strong>Fixed SKILL.md</strong>
        </div>
        <span className="preview-file">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <pre className="skill-preview" tabIndex={0}>
          <code>{highlightSkill(markdown)}</code>
        </pre>
      ) : null}
    </section>
  );
}
