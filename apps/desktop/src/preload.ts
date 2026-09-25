import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  copyToClipboard: (text: string) => ipcRenderer.send('copy-to-clipboard', text),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
});
