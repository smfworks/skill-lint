import { SAMPLES } from "./data/samples";
import { lintSkill, resultFromJson } from "./lib/lint";
import { slugify } from "./lib/parse";
import {
  copyText,
  downloadBlob,
  cardToPngBlob,
} from "./lib/exportImage";
import { downloadText, formatCompactStats, formatShareText } from "./lib/share";
import type { LintResult } from "./types";
import { Actions } from "./components/Actions";
import { Composer } from "./components/Composer";
import { FixedPreview } from "./components/FixedPreview";
import { Header } from "./components/Header";
import { ScoreCard } from "./components/ScoreCard";
import { SisterStrip } from "./components/SisterStrip";
import { HandoffBanner } from "./components/HandoffBanner";
import { Toast } from "./components/Toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";

function lintFromPaste(raw: string): LintResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const emitted = resultFromJson(parsed);
      if (emitted) return emitted;
      if (parsed && typeof parsed === "object" && "markdown" in parsed) {
        const markdown = (parsed as { markdown: unknown }).markdown;
        if (typeof markdown === "string") return lintSkill(markdown);
      }
    } catch {
      // Fall through to markdown lint.
    }
  }
  return lintSkill(trimmed);
}

export default function App() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<LintResult | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<"png" | "share" | "copy-md" | "download-md" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showFix, setShowFix] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setResult(lintFromPaste(raw));
    }, 80);
    return () => window.clearTimeout(handle);
  }, [raw]);

  const loadSample = useCallback(
    async (id: string) => {
      const sample = SAMPLES.find((item) => item.id === id);
      if (!sample) return;
      try {
        const response = await fetch(sample.file);
        if (!response.ok) throw new Error("missing sample");
        const text = await response.text();
        setRaw(text);
        setSampleId(id);
        setShowFix(true);
      } catch {
        showToast("Could not load that sample.");
      }
    },
    [showToast],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sample = params.get("sample");
    if (sample) void loadSample(sample);
    const shot = params.get("shot");
    if (shot === "card" || shot === "og") {
      document.body.classList.add(`shot-${shot}`);
    }
  }, [loadSample]);

  const onFile = useCallback(async (file: File) => {
    const text = await file.text();
    setSampleId(null);
    setRaw(text);
    setShowFix(true);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt") && !name.endsWith(".json")) {
        showToast("Drop a .md or SKILL.md file.");
        return;
      }
      void onFile(file);
    },
    [onFile, showToast],
  );

  const reset = useCallback(() => {
    setRaw("");
    setResult(null);
    setSampleId(null);
    showToast("Cleared.");
  }, [showToast]);

  const withFrame = useCallback(async () => {
    const node = frameRef.current;
    if (!node || !result) throw new Error("Nothing to print yet.");
    node.classList.add("is-exporting");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      return await cardToPngBlob(node);
    } finally {
      node.classList.remove("is-exporting");
    }
  }, [result]);

  const downloadPng = useCallback(async () => {
    if (!result) return;
    setBusy("png");
    try {
      const blob = await withFrame();
      downloadBlob(blob, `skill-lint-${slugify(result.skillName ?? result.grade)}.png`);
      showToast("PNG downloaded.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "PNG export failed.");
    } finally {
      setBusy(null);
    }
  }, [result, showToast, withFrame]);

  const copyShare = useCallback(async () => {
    if (!result) return;
    setBusy("share");
    try {
      await copyText(formatShareText(result));
      showToast("Share text copied.");
    } catch {
      showToast("Could not copy share text.");
    } finally {
      setBusy(null);
    }
  }, [result, showToast]);

  const copyFixed = useCallback(async () => {
    if (!result?.suggestedMarkdown) return;
    setBusy("copy-md");
    try {
      await copyText(result.suggestedMarkdown);
      showToast("Fixed SKILL.md copied.");
    } catch {
      showToast("Could not copy markdown.");
    } finally {
      setBusy(null);
    }
  }, [result, showToast]);

  const downloadFixed = useCallback(() => {
    if (!result?.suggestedMarkdown) return;
    setBusy("download-md");
    try {
      downloadText(result.suggestedMarkdown, "SKILL.md");
      showToast("SKILL.md downloaded.");
    } catch {
      showToast("Download failed.");
    } finally {
      setBusy(null);
    }
  }, [result, showToast]);

  const live = useMemo(() => {
    if (!result) return "Waiting for a SKILL.md";
    return `${result.grade} ${result.band} · ${result.score}/100`;
  }, [result]);

  return (
    <div className="page">
      <div className="ambient" aria-hidden="true" />
      <Header />
      <SisterStrip current="skill-lint" payload={result?.suggestedMarkdown || raw} />
      <HandoffBanner onPaste={(text) => { setRaw(text); setSampleId(null); }} />
      <main className="layout">
        <Composer
          raw={raw}
          sampleId={sampleId}
          dragging={dragging}
          onRawChange={(value) => {
            setSampleId(null);
            setRaw(value);
          }}
          onSample={(id) => void loadSample(id)}
          onPickFile={() => fileRef.current?.click()}
          onDragState={setDragging}
          onDrop={onDrop}
        />
        <section className="stage" aria-label="Score card">
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
          <div className="stage-scroll">
            <div ref={frameRef} className="export-frame">
              <ScoreCard result={result} />
            </div>
          </div>
          {result ? <p className="stage-stats">{formatCompactStats(result)}</p> : null}
          <Actions
            disabled={!result}
            fixDisabled={!result?.suggestedMarkdown}
            busy={busy}
            onDownloadPng={() => void downloadPng()}
            onCopyShare={() => void copyShare()}
            onDownloadFixed={downloadFixed}
            onCopyFixed={() => void copyFixed()}
            onReset={reset}
          />
          {result?.suggestedMarkdown ? (
            <FixedPreview markdown={result.suggestedMarkdown} open={showFix} onToggle={setShowFix} />
          ) : null}
        </section>
      </main>
      <footer className="site-foot">
        <p>Skill Lint · SMF Works</p>
        <p>
          Sister apps:{" "}
          <a href="https://paste-to-skill.vercel.app" rel="noreferrer" target="_blank">
            Paste → Skill
          </a>
          {" — create · "}
          <a href="https://github.com/smfworks/refuse-card" rel="noreferrer" target="_blank">
            Refuse Card
          </a>
          {" — the gate · "}
          <a href="https://agent-receipt-green.vercel.app" rel="noreferrer" target="_blank">
            Agent Receipt
          </a>
          {" — what ran."}
        </p>
        <p>Intelligence is abundant. Judgment is the product.</p>
        <p>
          MIT · Built by{" "}
          <a href="https://smfworks.com" rel="noreferrer" target="_blank">
            SMF Works
          </a>
          {" · "}
          <a href="https://github.com/smfworks/skill-lint" rel="noreferrer" target="_blank">
            GitHub
          </a>
          {" · "}
          <a href="https://x.com/MichaelGannotti" rel="noreferrer" target="_blank">
            @MichaelGannotti
          </a>
        </p>
        <p className="fineprint">
          No secrets, no monetization, no medical or legal advice. A shareable
          score is not an audit, not compliance, and not a substitute for human
          review.
        </p>
      </footer>
      <Toast message={toast} />
    </div>
  );
}
