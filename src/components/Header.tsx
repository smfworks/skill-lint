export function Header() {
  return (
    <header className="mast">
      <div className="mast-brand">
        <span className="mark" aria-hidden="true" />
        <div>
          <p className="eyebrow">SMF Works · Human-AI lab</p>
          <h1>Skill Lint</h1>
        </div>
      </div>
      <p className="lede">
        Paste a SKILL.md. Get a green / yellow / red report card. Fix the draft
        — then share the grade, not the secrets.
      </p>
    </header>
  );
}
