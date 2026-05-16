const {ipcRenderer} = require('electron') as typeof import('electron');

const doccipher = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<{message: string; time: string}>,
  selectDocx: () => ipcRenderer.invoke('file:select-docx') as Promise<string | null>,
  maskDocx: (payload: {filePath: string}) =>
    ipcRenderer.invoke('docx:smoke-mask', payload) as Promise<{success: boolean; outputPath: string}>,
};

export {doccipher};
