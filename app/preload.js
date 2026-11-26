'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('DP', {
  invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a),
  send: (ch, d) => ipcRenderer.send(ch, d),
  on: (ch, cb) => { const f = (e, d) => cb(d); ipcRenderer.on(ch, f); return () => ipcRenderer.removeListener(ch, f); },
  pathOf: file => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } },
  platform: process.platform,
});
