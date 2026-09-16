import type { LintResult } from "../types";
import { BAND_META } from "../types";
import { formatStampTime } from "../lib/share";

interface ScoreCardProps {
  result: LintResult | null;
}

function barcodeBars(id: string): number[] {
  const bars: number[] = [];
  for (let i = 0; i < 36; i += 1) {
    const code = id.charCodeAt(i % id.length) + i * 17;
    bars.push(1 + (code % 4));
  }
  return bars;
}

export function ScoreCard({ result }: ScoreCardProps) {
  const band = result?.band ?? null;
  const meta = band ? BAND_META[band] : null;
  const tone = meta?.className ?? "is-empty";
  const findings = result?.findings.slice(0, 6) ?? [];
  const passedPreview = result?.passed.slice(0, 4) ?? [];

  return (
    <article className={`ticket ${tone}`}>
      <div className="ticket-rail" aria-hidden="true" />
      <header className="ticket-head">
        <div>
          <p className="r-kicker">Skill report card</p>
          <h2>Skill Lint</h2>
        </div>
        <p className="ticket-seq">{result?.id ?? "SL-————"}</p>
      </header>

      <div className="perf" aria-hidden="true">
        <span />
      </div>

      <div className="ticket-body">
        <div className="stamp-row">
          <div className={`wax ${tone}`}>
            <div className="wax-ring" />
            <div className="wax-core">
              <span className="wax-kicker">SMF WORKS</span>
              <strong>{result?.grade ?? "—"}</strong>
              <span className="wax-sub">{meta?.label ?? "AWAIT PASTE"}</span>
            </div>
          </div>
          <dl className="codes">
            <div>
              <dt>Score</dt>
              <dd>{result ? `${result.score}/100` : "—"}</dd>
            </div>
            <div>
              <dt>Band</dt>
              <dd>{meta?.label ?? "—"}</dd>
            </div>
            <div>
              <dt>Skill</dt>
              <dd>{result?.skillName ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <section className="r-hero">
          <p className="r-label">Summary</p>
          <h3>{result?.summary ?? "Paste a SKILL.md. Instant grade. No API."}</h3>
        </section>

        <section className="r-block">
          <p className="r-label">{findings.length ? "Findings" : "Checklist"}</p>
          {result ? (
            <ul>
              {findings.length
                ? findings.map((finding) => (
                    <li key={finding.id}>
                      <span className={`mark-tick is-${finding.severity}`}>
                        {finding.severity === "error" ? "✕" : "!"}
                      </span>
                      <span>
                        <strong>{finding.title}.</strong> {finding.hint}
                      </span>
                    </li>
                  ))
                : passedPreview.map((item) => (
                    <li key={item.id}>
                      <span className="mark-tick is-pass">✓</span>
                      <span>{item.title}</span>
                    </li>
                  ))}
            </ul>
          ) : (
            <p className="r-placeholder">
              GREEN is a bounded playbook. YELLOW still ships after a pass. RED is a stub or a leak.
            </p>
          )}
        </section>

        {result ? (
          <section className="coupon">
            <p className="r-label">Lab note</p>
            <p className="coupon-line">
              {result.findings.length
                ? `${result.findings.length} finding${result.findings.length === 1 ? "" : "s"} · heuristic demo · not an audit`
                : "All checks clear · heuristic demo · not an audit"}
            </p>
          </section>
        ) : null}
      </div>

      <div className="perf" aria-hidden="true">
        <span />
      </div>

      <div className="barcode" aria-hidden="true">
        {barcodeBars(result?.id ?? "SL-0000").map((width, index) => (
          <i key={index} style={{ width }} />
        ))}
      </div>

      <footer className="r-foot">
        <p>Skill Lint · SMF Works</p>
        <p className="r-link">smfworks.com</p>
        <p className="r-motto">
          {result ? formatStampTime(result.lintedAt) : "Heuristic demo · not advice"}
        </p>
        <p className="r-motto">Judgment stays human.</p>
      </footer>
    </article>
  );
}
