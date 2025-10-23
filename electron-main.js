const { app, BrowserWindow, BrowserView, ipcMain, nativeImage, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

class AlgorithmMirrorElectronBrowser {
    constructor() {
        this.mainWindow = null;
        this.browserView = null;
        this.memoryData = new Map();
        this.isAIActive = true;
        this.screenshotInterval = null;
        this.currentUrl = '';
        
        this.setupApp();
    }

    setupApp() {
        // App event handlers
        app.whenReady().then(() => {
            this.createMainWindow();
            this.setupIPC();
            this.startAIEngine();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });
    }

    createMainWindow() {
        // Create the main browser window
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 1000,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false // Allow cross-origin requests
            },
            titleBarStyle: 'hiddenInset',
            vibrancy: 'under-window',
            show: false
        });

        // Load the UI
        this.mainWindow.loadFile('index.html');

        // Create browser view for web content
        this.createBrowserView();

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
            this.browserView = null;
        });
    }

    createBrowserView() {
        // Create a browser view for rendering web content
        this.browserView = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true
            }
        });

        this.mainWindow.setBrowserView(this.browserView);

        // Position the browser view (leave space for UI)
        const bounds = this.mainWindow.getBounds();
        this.browserView.setBounds({
            x: 0,
            y: 80, // Space for header
            width: bounds.width - 350, // Space for sidebar
            height: bounds.height - 80
        });

        // Handle navigation events
        this.browserView.webContents.on('did-navigate', (event, url) => {
            this.currentUrl = url;
            this.mainWindow.webContents.send('url-changed', url);
            this.scheduleScreenshot();
        });

        this.browserView.webContents.on('did-finish-load', () => {
            this.mainWindow.webContents.send('page-loaded');
            this.scheduleScreenshot();
        });

        // Handle window resize
        this.mainWindow.on('resize', () => {
            const bounds = this.mainWindow.getBounds();
            this.browserView.setBounds({
                x: 0,
                y: 80,
                width: bounds.width - 350,
                height: bounds.height - 80
            });
        });

        // Load initial page
        this.browserView.webContents.loadURL('https://www.google.com');
    }

    setupIPC() {
        // Handle navigation requests from UI
        ipcMain.handle('navigate-to', async (event, url) => {
            try {
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = url.includes('.') ? `https://${url}` : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
                }
                
                await this.browserView.webContents.loadURL(url);
                return { success: true, url };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // Handle screenshot capture
        ipcMain.handle('capture-screenshot', async () => {
            return await this.captureScreenshot();
        });

        // Handle browser controls
        ipcMain.handle('browser-back', async () => {
            if (this.browserView.webContents.canGoBack()) {
                this.browserView.webContents.goBack();
                return true;
            }
            return false;
        });

        ipcMain.handle('browser-forward', async () => {
            if (this.browserView.webContents.canGoForward()) {
                this.browserView.webContents.goForward();
                return true;
            }
            return false;
        });

        ipcMain.handle('browser-refresh', async () => {
            this.browserView.webContents.reload();
        });

        // Memory operations
        ipcMain.handle('get-memory-data', async () => {
            return Array.from(this.memoryData.entries());
        });

        ipcMain.handle('save-memory-entry', async (event, entry) => {
            this.memoryData.set(entry.id, entry);
            return true;
        });

        // AI control
        ipcMain.handle('toggle-ai', async (event, isActive) => {
            this.isAIActive = isActive;
            if (isActive) {
                this.startAIEngine();
            } else {
                this.stopAIEngine();
            }
            return isActive;
        });

        // PDF handling
        ipcMain.handle('open-pdf-dialog', async () => {
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openFile'],
                filters: [
                    { name: 'PDF Files', extensions: ['pdf'] }
                ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
                return result.filePaths[0];
            }
            return null;
        });

        // Get current URL
        ipcMain.handle('get-current-url', async () => {
            return this.currentUrl;
        });
    }

    async captureScreenshot() {
        try {
            if (!this.browserView || !this.browserView.webContents) {
                return null;
            }

            // Capture the browser view content
            const image = await this.browserView.webContents.capturePage();
            const buffer = image.toPNG();
            
            // Convert to base64 data URL
            const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
            
            // Create memory entry
            const memoryEntry = {
                id: `screenshot_${Date.now()}`,
                timestamp: new Date(),
                url: this.currentUrl,
                screenshot: dataUrl,
                type: 'screenshot'
            };

            // Store in memory
            this.memoryData.set(memoryEntry.id, memoryEntry);

            // Send to renderer for AI analysis
            this.mainWindow.webContents.send('new-screenshot', memoryEntry);

            return memoryEntry;
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            return null;
        }
    }

    scheduleScreenshot() {
        // Clear existing timeout
        if (this.screenshotTimeout) {
            clearTimeout(this.screenshotTimeout);
        }

        // Schedule screenshot after page loads
        this.screenshotTimeout = setTimeout(() => {
            if (this.isAIActive) {
                this.captureScreenshot();
            }
        }, 2000);
    }

    startAIEngine() {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
        }

        // Capture screenshots every 30 seconds
        this.screenshotInterval = setInterval(() => {
            if (this.isAIActive && this.currentUrl) {
                this.captureScreenshot();
            }
        }, 30000);
    }

    stopAIEngine() {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = null;
        }
    }
}

// Create the application
new AlgorithmMirrorElectronBrowser();