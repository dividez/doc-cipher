export type DebugApi = {
  ping: () => Promise<{ message: string; time: string }>;
  selectDocx: () => Promise<string | null>;
  maskDocx: (payload: { filePath: string }) => Promise<{ success: boolean; outputPath: string }>;
};

export function getDebugApi(): DebugApi | null {
  if (window.doccipher) {
    return window.doccipher;
  }

  const api = window.localApi;
  if (!api?.ping || !api.selectDocx || !api.smokeMaskDocx) {
    return null;
  }

  return {
    ping: () => api.ping(),
    selectDocx: () => api.selectDocx(),
    maskDocx: (payload) => api.smokeMaskDocx(payload),
  };
}
