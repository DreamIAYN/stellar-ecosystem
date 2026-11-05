const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('stellarDesktop', {
  platform: process.platform,
  version: process.versions.electron,
  nativeWebview: true,
})
