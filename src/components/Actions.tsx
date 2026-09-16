interface ActionsProps {
  disabled: boolean;
  fixDisabled: boolean;
  busy: "png" | "share" | "copy-md" | "download-md" | null;
  onDownloadPng: () => void;
  onCopyShare: () => void;
  onDownloadFixed: () => void;
  onCopyFixed: () => void;
  onReset: () => void;
}

export function Actions({
  disabled,
  fixDisabled,
  busy,
  onDownloadPng,
  onCopyShare,
  onDownloadFixed,
  onCopyFixed,
  onReset,
}: ActionsProps) {
  return (
    <div className="actions">
      <button
        type="button"
        className="btn btn-ember"
        disabled={disabled || busy !== null}
        onClick={onDownloadPng}
      >
        {busy === "png" ? "Printing…" : "Download PNG"}
      </button>
      <button
        type="button"
        className="btn"
        disabled={disabled || busy !== null}
        onClick={onCopyShare}
      >
        {busy === "share" ? "Copying…" : "Copy share text"}
      </button>
      <button
        type="button"
        className="btn"
        disabled={fixDisabled || busy !== null}
        onClick={onDownloadFixed}
      >
        {busy === "download-md" ? "Saving…" : "Download fixed SKILL.md"}
      </button>
      <button
        type="button"
        className="btn"
        disabled={fixDisabled || busy !== null}
        onClick={onCopyFixed}
      >
        {busy === "copy-md" ? "Copying…" : "Copy fixed markdown"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
