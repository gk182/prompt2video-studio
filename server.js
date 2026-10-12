const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const { exec } = require('child_process');

const config = require('./config');
const queueManager = require('./queue/queueManager');
const storage = require('./queue/storage');
const browserManager = require('./engine/browser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Multer upload config
const upload = multer({ dest: path.join(__dirname, 'data', 'uploads') });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(config.VIDEOS_DIR));

// WebSocket broadcast
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Hook queueManager events to WebSocket
queueManager.on('log', (logEntry) => broadcast('log', logEntry));
queueManager.on('queue_updated', (status) => broadcast('queue_status', status));
queueManager.on('settings_updated', (settings) => broadcast('settings_status', settings));

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'init',
    payload: {
      status: queueManager.getStatus(),
      tasks: queueManager.getTasks(),
      settings: queueManager.getSettings()
    }
  }));
});

// REST API Endpoints

// 1. Status
app.get('/api/status', async (req, res) => {
  const qStatus = queueManager.getStatus();
  let authStatus = { loggedIn: false };
  if (browserManager.isConnected) {
    authStatus = await browserManager.checkAuthStatus();
  }
  res.json({
    queue: qStatus,
    auth: authStatus,
    browserConnected: browserManager.isConnected
  });
});

// 2. Tasks
app.get('/api/tasks', (req, res) => {
  res.json(queueManager.getTasks());
});

app.post('/api/tasks', (req, res) => {
  const task = queueManager.addTask(req.body);
  res.json(task);
});

app.post('/api/tasks/variants', (req, res) => {
  const created = queueManager.generateVariants(req.body);
  res.json({ success: true, count: created.length, tasks: created });
});

app.delete('/api/tasks/:id', (req, res) => {
  const ok = queueManager.removeTask(req.params.id);
  res.json({ success: ok });
});

app.post('/api/tasks/clear-completed', (req, res) => {
  queueManager.clearCompleted();
  res.json({ success: true });
});

app.post('/api/tasks/retry-failed', (req, res) => {
  const count = queueManager.retryFailed();
  res.json({ success: true, retriedCount: count });
});

// 3. Queue Controls
app.post('/api/queue/start', async (req, res) => {
  queueManager.start();
  res.json({ success: true, state: queueManager.state });
});

app.post('/api/queue/pause', (req, res) => {
  queueManager.pause();
  res.json({ success: true, state: queueManager.state });
});

// 4. Browser & Auth Controls
app.post('/api/browser/open-login', async (req, res) => {
  try {
    queueManager.log('Đang mở Chrome để bạn đăng nhập Google...');
    browserManager.openLoginWindow((msg) => {
      queueManager.log(msg);
      broadcast('auth_status', { message: msg });
    }).then(auth => {
      queueManager.log(`Đã hoàn tất đăng nhập Google! Tài khoản: ${auth.username || 'Google User'}`);
      broadcast('auth_status', { loggedIn: true, auth });
    }).catch(err => {
      queueManager.log(`Lỗi đăng nhập: ${err.message}`, 'error');
    });

    res.json({ success: true, message: 'Đã mở cửa sổ Chrome. Vui lòng đăng nhập Google!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/browser/check-auth', async (req, res) => {
  const status = await browserManager.checkAuthStatus();
  res.json(status);
});

app.post('/api/browser/close', async (req, res) => {
  await browserManager.close();
  res.json({ success: true });
});

// 5. Excel Import & Export
app.post('/api/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Chưa tải file lên' });
    }
    const tasks = storage.importFromExcel(req.file.path);
    fs.unlink(req.file.path, () => {}); // clean temp file
    const added = queueManager.addBatch(tasks);
    res.json({ success: true, importedCount: added.length, tasks: added });
  } catch (err) {
    res.status(500).json({ error: `Lỗi import file: ${err.message}` });
  }
});

app.get('/api/export', (req, res) => {
  try {
    const exportPath = path.join(config.DATA_DIR, `Export_KetQua_${Date.now()}.xlsx`);
    storage.exportToExcel(queueManager.getTasks(), exportPath);
    res.download(exportPath, `KetQua_Video_Alconost_${Date.now()}.xlsx`, () => {
      fs.unlink(exportPath, () => {});
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/template', (req, res) => {
  try {
    const templatePath = path.join(config.DATA_DIR, 'Mau_DanhSach_Prompt_Alconost.xlsx');
    storage.generateSampleTemplate(templatePath);
    res.download(templatePath, 'Mau_DanhSach_Prompt_Alconost.xlsx');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Open Output Folder in OS File Manager (Windows / macOS / Linux)
app.post('/api/open-folder', (req, res) => {
  const folder = config.VIDEOS_DIR;
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  const openCmd = isMac ? `open "${folder}"` : isWin ? `explorer.exe "${folder}"` : `xdg-open "${folder}"`;
  
  exec(openCmd, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, folder });
  });
});

// 7. Settings
app.get('/api/settings', (req, res) => {
  res.json(queueManager.getSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = queueManager.updateSettings(req.body);
  res.json(updated);
});

// Start Server
server.listen(config.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ALCONOST VIDEO AUTOMATION STUDIO IS RUNNING!`);
  console.log(`🌐 Dashboard URL: http://localhost:${config.PORT}`);
  console.log(`📁 Video Output:  ${config.VIDEOS_DIR}`);
  console.log(`=======================================================`);
});

