export const DEFAULT_WINDOW_SIZE = 1800;
export const DEFAULT_STRIDE = 1200;

const SECONDS_PER_WINDOW_MIN = 2;
const SECONDS_PER_WINDOW_MAX = 5;

export function countWindows(
  textLength: number,
  windowSize = DEFAULT_WINDOW_SIZE,
  stride = DEFAULT_STRIDE,
): number {
  if (textLength <= 0) {
    return 0;
  }
  if (textLength <= windowSize) {
    return 1;
  }
  return Math.ceil((textLength - windowSize) / stride) + 1;
}

export function* iterTextWindows(
  text: string,
  windowSize = DEFAULT_WINDOW_SIZE,
  stride = DEFAULT_STRIDE,
): Generator<{ start: number; slice: string }> {
  if (text.length === 0) {
    return;
  }
  if (text.length <= windowSize) {
    yield { start: 0, slice: text };
    return;
  }

  let start = 0;
  while (true) {
    const slice = text.slice(start, start + windowSize);
    if (!slice) {
      break;
    }
    yield { start, slice };
    if (start + windowSize >= text.length) {
      break;
    }
    start += stride;
  }
}

export function estimateInferenceSeconds(totalWindows: number): {
  estimatedSecondsMin: number;
  estimatedSecondsMax: number;
} {
  if (totalWindows <= 0) {
    return { estimatedSecondsMin: 0, estimatedSecondsMax: 0 };
  }
  return {
    estimatedSecondsMin: totalWindows * SECONDS_PER_WINDOW_MIN,
    estimatedSecondsMax: totalWindows * SECONDS_PER_WINDOW_MAX,
  };
}
