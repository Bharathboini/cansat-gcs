'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const TelemetryGenerator = require('./src/telemetry');

let mainWindow = null;
let simInterval = null;
const telemetry = new TelemetryGenerator();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#0d1117',
    frame: true,
    title: 'CanSat GCS — Mission GEO',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    if (simInterval) clearInterval(simInterval);
    mainWindow = null;
  });
}

function startSimulation() {
  if (simInterval) return;
  simInterval = setInterval(() => {
    if (!mainWindow) return;
    const packet = telemetry.tick();
    mainWindow.webContents.send('telemetry-data', packet);
  }, 1000);
}

function pauseSimulation() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
}

function resetSimulation() {
  pauseSimulation();
  telemetry.reset();
  if (mainWindow) {
    mainWindow.webContents.send('telemetry-reset');
  }
}

ipcMain.on('start-sim', () => startSimulation());
ipcMain.on('pause-sim', () => pauseSimulation());
ipcMain.on('reset-sim', () => resetSimulation());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
