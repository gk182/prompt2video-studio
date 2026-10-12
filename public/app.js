// State
let tasks = [];
let queueStatus = { state: 'idle', counts: { total: 0, pending: 0, running: 0, completed: 0, failed: 0 } };
let ws = null;

// DOM Elements
const authBadge = document.getElementById('authStatusBadge');
const btnOpenLogin = document.getElementById('btnOpenLogin');
const btnOpenFolder = document.getElementById('btnOpenFolder');
const metricTotal = document.getElementById('metricTotal');
const metricPending = document.getElementById('metricPending');
const metricRunning = document.getElementById('metricRunning');
const metricCompleted = document.getElementById('metricCompleted');
const metricFailed = document.getElementById('metricFailed');
const btnStartQueue = document.getElementById('btnStartQueue');
const btnPauseQueue = document.getElementById('btnPauseQueue');
const btnOpenVariants = document.getElementById('btnOpenVariants');
const btnOpenAddTask = document.getElementById('btnOpenAddTask');
const btnImportExcel = document.getElementById('btnImportExcel');
const excelFileInput = document.getElementById('excelFileInput');
const btnDownloadTemplate = document.getElementById('btnDownloadTemplate');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnRetryFailed = document.getElementById('btnRetryFailed');
const btnClearCompleted = document.getElementById('btnClearCompleted');
const taskListBody = document.getElementById('taskListBody');
const taskCountSummary = document.getElementById('taskCountSummary');
const liveLogsConsole = document.getElementById('liveLogsConsole');
const btnClearLogs = document.getElementById('btnClearLogs');

// Modals
const modalVariants = document.getElementById('modalVariants');
const modalAddTask = document.getElementById('modalAddTask');
const modalDetail = document.getElementById('modalDetail');

// Connect WebSocket
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    appendLog('Hệ thống', 'Đã kết nối máy chủ thời gian thực (WebSocket).', 'success');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWsMessage(data);
    } catch (e) {
      console.error('Lỗi parse WS message:', e);
    }
  };

  ws.onclose = () => {
    appendLog('Hệ thống', 'Mất kết nối WebSocket. Đang thử kết nối lại...', 'warning');
    setTimeout(initWebSocket, 3000);
  };
}

function handleWsMessage(data) {
  switch (data.type) {
    case 'init':
      tasks = data.payload.tasks || [];
      queueStatus = data.payload.status || queueStatus;
      renderTasks();
      updateMetrics();
      break;

    case 'log':
      appendLog(data.payload.timestamp, data.payload.message, data.payload.level);
      break;

    case 'queue_status':
      queueStatus = data.payload;
      updateMetrics();
      fetchTasks();
      break;

    case 'auth_status':
      checkAuthStatus();
      break;
  }
}

// Log Terminal Helper
function appendLog(time, message, level = 'info') {
  const line = document.createElement('div');
  line.className = `log-entry-${level}`;
  line.innerHTML = `<span class="text-zinc-500 font-mono">[${time}]</span> ${escapeHtml(message)}`;
  liveLogsConsole.appendChild(line);
  liveLogsConsole.scrollTop = liveLogsConsole.scrollHeight;
}

btnClearLogs.addEventListener('click', () => {
  liveLogsConsole.innerHTML = '<div class="text-zinc-500">[System] Đã xóa toàn bộ log.</div>';
});

// Fetch API Helpers
async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks');
    tasks = await res.json();
    renderTasks();
    updateMetrics();
  } catch (e) {}
}

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.auth && data.auth.loggedIn) {
      authBadge.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400';
      authBadge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span class="font-medium">Đã đăng nhập Google (${escapeHtml(data.auth.username || 'Alconost')})</span>
      `;
    } else {
      authBadge.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400';
      authBadge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-rose-400"></span>
        <span class="font-medium">Chưa đăng nhập Google</span>
      `;
    }
  } catch (e) {}
}

// Render Metrics & Status
function updateMetrics() {
  const counts = queueStatus.counts || {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };

  metricTotal.textContent = counts.total;
  metricPending.textContent = counts.pending;
  metricRunning.textContent = counts.running;
  metricCompleted.textContent = counts.completed;
  metricFailed.textContent = counts.failed;
  taskCountSummary.textContent = `${counts.total} tasks (${counts.completed} xong, ${counts.pending} chờ)`;

  if (queueStatus.state === 'running') {
    btnStartQueue.classList.add('opacity-50', 'cursor-not-allowed');
    btnPauseQueue.classList.remove('opacity-50', 'cursor-not-allowed');
  } else {
    btnStartQueue.classList.remove('opacity-50', 'cursor-not-allowed');
    btnPauseQueue.classList.add('opacity-50', 'cursor-not-allowed');
  }
}

// Render Task Table
function renderTasks() {
  if (!tasks || tasks.length === 0) {
    taskListBody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-zinc-500">
          <i class="fa-solid fa-inbox text-3xl mb-2 block opacity-40"></i>
          Hàng đợi đang trống. Hãy thêm task mới hoặc nhập từ file Excel!
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  tasks.forEach((task, index) => {
    // Status Badge
    let statusBadge = '';
    if (task.status === 'pending') {
      statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Chờ chạy</span>';
    } else if (task.status === 'running') {
      statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i>Đang tạo</span>';
    } else if (task.status === 'completed') {
      statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-check mr-1"></i>Hoàn thành</span>';
    } else if (task.status === 'failed') {
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20" title="${escapeHtml(task.error || '')}"><i class="fa-solid fa-xmark mr-1"></i>Lỗi</span>`;
    }

    // Video Output Column
    let videoCol = '<span class="text-zinc-500 italic">Chưa có</span>';
    if (task.outputFileName) {
      videoCol = `
        <div class="flex items-center space-x-1.5">
          <button onclick="showTaskDetail('${task.id}')" class="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-medium flex items-center gap-1 transition">
            <i class="fa-solid fa-play text-[9px]"></i> Xem
          </button>
          <a href="/videos/${encodeURIComponent(task.outputFileName)}" download class="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400" title="Tải MP4 về máy">
            <i class="fa-solid fa-download"></i>
          </a>
        </div>
      `;
    } else if (task.outputVideoUrl) {
      videoCol = `
        <a href="${task.outputVideoUrl}" target="_blank" class="text-brand-400 hover:underline truncate max-w-[120px] inline-block">
          Link Video
        </a>
      `;
    }

    html += `
      <tr class="transition">
        <td class="p-3 text-zinc-500 font-mono">${index + 1}</td>
        <td class="p-3">
          <div class="font-bold text-zinc-100">${escapeHtml(task.title)}</div>
          ${task.url ? `<a href="${task.url}" target="_blank" class="text-zinc-400 hover:text-brand-400 truncate max-w-[200px] inline-block text-[11px]"><i class="fa-solid fa-link text-[9px] mr-1"></i>${escapeHtml(task.url)}</a>` : ''}
        </td>
        <td class="p-3">
          <span class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[10px]">${escapeHtml(task.aspectRatio || '9:16')}</span>
        </td>
        <td class="p-3">
          <span class="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300 text-[10px]">${escapeHtml(task.language || 'English')}</span>
        </td>
        <td class="p-3">${statusBadge}</td>
        <td class="p-3">${videoCol}</td>
        <td class="p-3 text-right">
          <div class="flex items-center justify-end space-x-1">
            <button onclick="showTaskDetail('${task.id}')" class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200" title="Chi tiết kịch bản">
              <i class="fa-solid fa-circle-info"></i>
            </button>
            <button onclick="deleteTask('${task.id}')" class="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400" title="Xóa task">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  taskListBody.innerHTML = html;
}

// Actions
btnOpenLogin.addEventListener('click', async () => {
  appendLog('Chrome', 'Đang yêu cầu mở Chrome để đăng nhập Google...', 'info');
  try {
    const res = await fetch('/api/browser/open-login', { method: 'POST' });
    const data = await res.json();
    alert(data.message || 'Chrome đã mở. Hãy đăng nhập Google!');
  } catch (e) {
    alert('Lỗi: ' + e.message);
  }
});

btnOpenFolder.addEventListener('click', async () => {
  try {
    await fetch('/api/open-folder', { method: 'POST' });
  } catch (e) {}
});

btnStartQueue.addEventListener('click', async () => {
  await fetch('/api/queue/start', { method: 'POST' });
});

btnPauseQueue.addEventListener('click', async () => {
  await fetch('/api/queue/pause', { method: 'POST' });
});

btnRetryFailed.addEventListener('click', async () => {
  await fetch('/api/tasks/retry-failed', { method: 'POST' });
  fetchTasks();
});

btnClearCompleted.addEventListener('click', async () => {
  if (confirm('Bạn có chắc muốn xóa các task đã hoàn thành?')) {
    await fetch('/api/tasks/clear-completed', { method: 'POST' });
    fetchTasks();
  }
});

btnDownloadTemplate.addEventListener('click', () => {
  window.location.href = '/api/template';
});

btnExportExcel.addEventListener('click', () => {
  window.location.href = '/api/export';
});

btnImportExcel.addEventListener('click', () => {
  excelFileInput.click();
});

excelFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  appendLog('Excel', `Đang nhập danh sách từ file: ${file.name}...`, 'info');
  try {
    const res = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      appendLog('Excel', `Đã nhập thành công ${data.importedCount} task vào Queue!`, 'success');
      fetchTasks();
    } else {
      alert('Lỗi import: ' + (data.error || 'Thất bại'));
    }
  } catch (err) {
    alert('Lỗi tải file: ' + err.message);
  }
  excelFileInput.value = '';
});

// Modal Logic
function openModal(modal) {
  modal.classList.remove('hidden');
}
function closeModal(modal) {
  modal.classList.add('hidden');
}

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    modalVariants.classList.add('hidden');
    modalAddTask.classList.add('hidden');
    modalDetail.classList.add('hidden');
    const player = document.getElementById('detailVideoPlayer');
    if (player) player.pause();
  });
});

btnOpenVariants.addEventListener('click', () => openModal(modalVariants));
btnOpenAddTask.addEventListener('click', () => openModal(modalAddTask));

// Submit Variants
document.getElementById('btnSubmitVariants').addEventListener('click', async () => {
  const title = document.getElementById('varTitle').value.trim();
  const url = document.getElementById('varUrl').value.trim();
  const basePrompt = document.getElementById('varPrompt').value.trim();
  const sessionUrl = document.getElementById('varSessionUrl').value.trim();

  const aspectRatios = Array.from(document.querySelectorAll('input[name="varRatio"]:checked')).map(cb => cb.value);
  const languages = Array.from(document.querySelectorAll('input[name="varLang"]:checked')).map(cb => cb.value);

  if (!url && !basePrompt) {
    alert('Vui lòng nhập ít nhất URL sản phẩm hoặc Prompt!');
    return;
  }
  if (aspectRatios.length === 0) {
    alert('Vui lòng chọn ít nhất 1 tỉ lệ video!');
    return;
  }
  if (languages.length === 0) {
    alert('Vui lòng chọn ít nhất 1 ngôn ngữ!');
    return;
  }

  const payload = {
    title: title || 'Video Ad',
    url,
    basePrompt,
    aspectRatios,
    languages,
    sessionUrl
  };

  try {
    const res = await fetch('/api/tasks/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    closeModal(modalVariants);
    fetchTasks();
    appendLog('Variants', `Đã sinh thành công ${data.count} biến thể vào Queue.`, 'success');
  } catch (e) {
    alert('Lỗi tạo biến thể: ' + e.message);
  }
});

// Submit Single Task
document.getElementById('btnSubmitSingle').addEventListener('click', async () => {
  const title = document.getElementById('singleTitle').value.trim();
  const url = document.getElementById('singleUrl').value.trim();
  const aspectRatio = document.getElementById('singleRatio').value;
  const language = document.getElementById('singleLang').value;
  const prompt = document.getElementById('singlePrompt').value.trim();
  const sessionUrl = document.getElementById('singleSessionUrl').value.trim();

  if (!url && !prompt) {
    alert('Vui lòng nhập URL hoặc Prompt!');
    return;
  }

  const payload = { title, url, aspectRatio, language, prompt, sessionUrl };

  try {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    closeModal(modalAddTask);
    fetchTasks();
  } catch (e) {
    alert('Lỗi: ' + e.message);
  }
});

// Show Task Detail Modal
window.showTaskDetail = function(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('detailTitle').textContent = task.title;
  document.getElementById('detailStatus').textContent = task.status;
  document.getElementById('detailRatio').textContent = task.aspectRatio || '9:16';
  document.getElementById('detailLang').textContent = task.language || 'English';
  document.getElementById('detailFile').textContent = task.outputFileName || 'Chưa tải';
  document.getElementById('detailPrompt').textContent = task.finalPrompt || task.prompt || '(Không có prompt)';
  document.getElementById('detailAiResponse').textContent = task.aiResponse || '(Chưa có phản hồi AI)';

  // Video container
  const videoCont = document.getElementById('detailVideoContainer');
  const videoPlayer = document.getElementById('detailVideoPlayer');
  const downloadBtn = document.getElementById('detailDownloadBtn');

  if (task.outputFileName) {
    videoCont.classList.remove('hidden');
    videoPlayer.src = `/videos/${encodeURIComponent(task.outputFileName)}`;
    downloadBtn.classList.remove('hidden');
    downloadBtn.href = `/videos/${encodeURIComponent(task.outputFileName)}`;
    downloadBtn.download = task.outputFileName;
  } else if (task.outputVideoUrl) {
    videoCont.classList.remove('hidden');
    videoPlayer.src = task.outputVideoUrl;
    downloadBtn.classList.remove('hidden');
    downloadBtn.href = task.outputVideoUrl;
  } else {
    videoCont.classList.add('hidden');
    downloadBtn.classList.add('hidden');
  }

  // Error container
  const errCont = document.getElementById('detailErrorContainer');
  if (task.error) {
    errCont.classList.remove('hidden');
    document.getElementById('detailError').textContent = task.error;
  } else {
    errCont.classList.add('hidden');
  }

  openModal(modalDetail);
};

// Delete Task
window.deleteTask = async function(taskId) {
  if (confirm('Bạn muốn xóa task này khỏi hàng đợi?')) {
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    fetchTasks();
  }
};

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initial Boot
initWebSocket();
fetchTasks();
checkAuthStatus();
setInterval(checkAuthStatus, 15000);

