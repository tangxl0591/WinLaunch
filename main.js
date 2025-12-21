
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Storage path: Next to the exe if packaged, or in current dir if not
const getStorageDir = () => {
  const base = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();
  return path.join(base, 'launcher_data');
};

async function ensureStorage() {
  const dir = getStorageDir();
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    title: "WinLaunch Studio"
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const indexPath = path.join(__dirname, 'dist', 'index.html');
  win.loadFile(indexPath).catch(() => {
    console.log('Dist not found. Run "npm run build" first.');
  });
}

// IPC Handlers
ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'lnk', 'com'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('get-file-icon', async (event, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.toDataURL();
  } catch (err) {
    console.error('Icon extraction failed:', err);
    return null;
  }
});

// Fetch remote icon and convert to Base64 to satisfy "binary storage" requirement and bypass CORS
ipcMain.handle('fetch-url-icon', async (event, url) => {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || 'image/png';
        const base64 = buffer.toString('base64');
        resolve(`data:${contentType};base64,${base64}`);
      });
    }).on('error', (e) => {
      console.error('Fetch URL icon failed:', e);
      resolve(null);
    });
  });
});

ipcMain.handle('load-storage-file', async (event, fileName) => {
  await ensureStorage();
  const filePath = path.join(getStorageDir(), `${fileName}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
});

ipcMain.handle('save-storage-file', async (event, { fileName, data }) => {
  await ensureStorage();
  const filePath = path.join(getStorageDir(), `${fileName}.json`);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save file:', err);
    return false;
  }
});

ipcMain.on('launch-app', (event, exePath) => {
  shell.openPath(exePath).then((errorMessage) => {
    if (errorMessage) {
      dialog.showErrorBox('Launch Error', `Could not start application:\n${errorMessage}`);
    }
  });
});

ipcMain.on('launch-link', (event, url) => {
  shell.openExternal(url).catch((err) => {
    dialog.showErrorBox('Launch Error', `Could not open website:\n${err.message}`);
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
