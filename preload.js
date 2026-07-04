'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startSim: () => ipcRenderer.send('start-sim'),
  pauseSim: () => ipcRenderer.send('pause-sim'),
  resetSim: () => ipcRenderer.send('reset-sim'),
  onTelemetry: (callback) =>
    ipcRenderer.on('telemetry-data', (event, data) => callback(data)),
  onReset: (callback) =>
    ipcRenderer.on('telemetry-reset', () => callback()),
  offTelemetry: () => ipcRenderer.removeAllListeners('telemetry-data'),
  offReset: () => ipcRenderer.removeAllListeners('telemetry-reset'),
});
