import { useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { AiMaskProgress, AiRecognizeLogEvent } from '@app/shared';
import { Button } from './ui.js';

type AiRecognizeLogDialogProps = {
  open: boolean;
  events: AiRecognizeLogEvent[];
  inProgress: boolean;
  progress: AiMaskProgress | null;
  onClose: () => void;
  onCancel: () => void;
};

function formatLogLine(event: AiRecognizeLogEvent): string {
  if (event.type === 'window_raw') {
    const idx = event.windowIndex ?? 0;
    const total = event.totalWindows ?? '?';
    return `--- 窗口 ${idx}/${total} ---\n${event.message}`;
  }
  if (event.type === 'error') {
    return `错误：${event.message}`;
  }
  if (event.type === 'done') {
    return `完成：${event.message}`;
  }
  return event.message;
}

export function AiRecognizeLogDialog({
  open,
  events,
  inProgress,
  progress,
  onClose,
  onCancel,
}: AiRecognizeLogDialogProps) {
  const bodyRef = useRef<HTMLPreElement>(null);

  const bodyText = useMemo(
    () => events.map((event) => formatLogLine(event)).join('\n\n'),
    [events],
  );

  const progressLabel =
    progress && progress.totalWindows > 0
      ? `${progress.doneWindows} / ${progress.totalWindows}`
      : null;

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [bodyText]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = () => {
    if (!inProgress) {
      onClose();
    }
  };

  return (
    <div className="match-preview-overlay ai-recognize-log-overlay" onClick={handleOverlayClick}>
      <div
        className="match-preview-dialog ai-recognize-log-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-recognize-log-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="match-preview-dialog-head">
          <div className="match-preview-dialog-title">
            <h2 id="ai-recognize-log-title">AI 识别输出</h2>
          </div>
          {!inProgress ? (
            <Button type="button" variant="ghost" aria-label="关闭" onClick={onClose}>
              <X size={18} />
            </Button>
          ) : null}
        </header>

        <pre ref={bodyRef} className="ai-recognize-log-body">
          {bodyText || '等待模型输出…'}
        </pre>

        <footer className="ai-recognize-log-footer">
          {inProgress ? (
            <>
              {progressLabel ? (
                <span className="ai-recognize-log-progress">进度 {progressLabel}</span>
              ) : (
                <span className="ai-recognize-log-progress">识别进行中…</span>
              )}
              <Button type="button" variant="outline" onClick={onCancel}>
                取消识别
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onClose}>
              关闭
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
