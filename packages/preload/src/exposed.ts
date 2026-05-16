import {contextBridge} from 'electron';
import {localApi} from './index.js';

contextBridge.exposeInMainWorld('localApi', localApi);

export {localApi};
