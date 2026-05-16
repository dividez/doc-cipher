export {};

declare global {
  interface Window {
    doccipher?: {
      ping: () => Promise<{
        message: string;
        time: string;
      }>;
      selectDocx: () => Promise<string | null>;
      maskDocx: (payload: { filePath: string }) => Promise<{
        success: boolean;
        outputPath: string;
      }>;
    };
  }
}
