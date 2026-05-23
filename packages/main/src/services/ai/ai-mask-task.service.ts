import type { AiMaskProgress, AiRecognizeLogEvent } from '@app/shared';
import type { BrowserWindow } from 'electron';

let activeAbortController: AbortController | null = null;
let progressSink: ((progress: AiMaskProgress) => void) | null = null;
let recognizeLogSink: ((event: AiRecognizeLogEvent) => void) | null = null;
let aiInferenceCancelled = false;

export function resetAiMaskCancelled(): void {
  aiInferenceCancelled = false;
}

export function markAiMaskCancelled(): void {
  aiInferenceCancelled = true;
}

export function isAiMaskCancelled(): boolean {
  return aiInferenceCancelled;
}

export function setAiMaskProgressSink(sink: ((progress: AiMaskProgress) => void) | null): void {
  progressSink = sink;
}

export function broadcastAiMaskProgress(windows: BrowserWindow[], progress: AiMaskProgress): void {
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('ai:mask-progress', progress);
    }
  }
}

export function emitAiMaskProgress(progress: AiMaskProgress): void {
  progressSink?.(progress);
}

export function setAiRecognizeLogSink(sink: ((event: AiRecognizeLogEvent) => void) | null): void {
  recognizeLogSink = sink;
}

export function broadcastAiRecognizeLog(
  windows: BrowserWindow[],
  event: AiRecognizeLogEvent,
): void {
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('ai:recognize-log', event);
    }
  }
}

export function emitAiRecognizeLog(event: AiRecognizeLogEvent): void {
  recognizeLogSink?.(event);
}

export function beginMaskTask(): AbortSignal {
  activeAbortController?.abort();
  activeAbortController = new AbortController();
  resetAiMaskCancelled();
  return activeAbortController.signal;
}

export function getMaskTaskSignal(): AbortSignal | undefined {
  return activeAbortController?.signal;
}

export function endMaskTask(): void {
  activeAbortController = null;
}

export async function cancelMaskTask(): Promise<void> {
  activeAbortController?.abort();
  markAiMaskCancelled();
  activeAbortController = null;
}
