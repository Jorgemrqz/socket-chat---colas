const { app, BrowserWindow } = require('electron');
const path = require('path');

// Crear la ventana principal
let mainWindow;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true, // Habilitar nodeIntegration
            contextIsolation: false, // Deshabilitar contextIsolation
        },
    });

    mainWindow.loadFile('index.html'); // Cargar la interfaz
});
