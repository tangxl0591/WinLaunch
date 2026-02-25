
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import https from 'https';
import http from 'http';

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

  // 优先尝试加载开发服务器地址，如果失败或不在开发环境，则加载本地文件
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // Vite 默认端口是 5173
    win.loadURL('http://localhost:5173').catch(() => {
      console.log('Vite dev server not found, falling back to file...');
      loadStaticFile(win);
    });
  } else {
    loadStaticFile(win);
  }
}

function loadStaticFile(win) {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  win.loadFile(indexPath).catch((err) => {
    console.error('Failed to load index.html:', err);
    // 尝试备选路径（有些打包配置会将 dist 内容直接放在根目录）
    const fallbackPath = path.join(__dirname, 'index.html');
    win.loadFile(fallbackPath).catch(() => {
      console.log('Dist not found. Please run "npm run build" first.');
    });
  });
}

// 通用的远程内容获取助手，支持协议切换、重定向处理和 User-Agent 伪装
async function fetchRemote(url, options = {}) {
  const protocol = url.startsWith('https') ? https : http;
  const defaultOptions = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    },
    timeout: 8000
  };

  return new Promise((resolve, reject) => {
    const req = protocol.get(url, { ...defaultOptions, ...options }, (res) => {
      // 处理 3xx 重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectCount = (options._redirectCount || 0) + 1;
        if (redirectCount > 5) return reject(new Error('Too many redirects'));
        
        let nextUrl = res.headers.location;
        if (!nextUrl.startsWith('http')) {
          const origin = new URL(url).origin;
          nextUrl = new URL(nextUrl, origin).href;
        }
        return resolve(fetchRemote(nextUrl, { ...options, _redirectCount: redirectCount }));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Error: ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), headers: res.headers }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// IPC 处理器
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

// 根据网页链接地址获取图标和主题颜色
ipcMain.handle('fetch-url-info', async (event, targetUrl) => {
  try {
    const urlObj = new URL(targetUrl);
    const domain = urlObj.hostname;
    // 使用 Google 的高分辨率 Favicon 服务作为最稳定的源
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    
    let base64Icon = null;
    let themeColor = null;

    // 1. 获取图标
    try {
      const iconResult = await fetchRemote(faviconUrl);
      const contentType = iconResult.headers['content-type'] || 'image/png';
      base64Icon = `data:${contentType};base64,${iconResult.buffer.toString('base64')}`;
    } catch (e) {
      console.error('Fetch icon failed:', e.message);
    }

    // 2. 尝试抓取网页 HTML 来获取主题颜色
    try {
      const htmlResult = await fetchRemote(targetUrl);
      const html = htmlResult.buffer.toString('utf-8');
      
      const themeMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i);
      
      if (themeMatch && themeMatch[1]) {
        themeColor = themeMatch[1];
      } else {
        const tileMatch = html.match(/<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i);
        if (tileMatch) themeColor = tileMatch[1];
      }
    } catch (e) {
      // 颜色抓取失败不影响图标返回
    }

    return { icon: base64Icon, themeColor };
  } catch (err) {
    console.error('Fetch URL info failed:', err);
    return null;
  }
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
