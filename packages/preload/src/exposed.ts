import { doccipher } from './doccipher.js';
import { localApi } from './index.js';

const { contextBridge } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('localApi', localApi);
contextBridge.exposeInMainWorld('doccipher', doccipher);
