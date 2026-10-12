const EventEmitter = require('events');
const storage = require('./storage');
const engine = require('../engine/alconost');
const browserManager = require('../engine/browser');
const config = require('../config');

class QueueManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = storage.loadQueue();
    this.settings = storage.loadSettings();
    this.state = 'idle'; // 'idle' | 'running' | 'paused'
    this.currentTaskId = null;
    this.isProcessing = false;
  }

  log(message, level = 'info') {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    };
    this.emit('log', entry);
    console.log(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`);
  }

  getTasks() {
    return this.tasks;
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    storage.saveSettings(this.settings);
    this.emit('settings_updated', this.settings);
    return this.settings;
  }

  getStatus() {
    const counts = {
      total: this.tasks.length,
      pending: this.tasks.filter(t => t.status === 'pending').length,
      running: this.tasks.filter(t => t.status === 'running').length,
      completed: this.tasks.filter(t => t.status === 'completed').length,
      failed: this.tasks.filter(t => t.status === 'failed').length
    };
    return {
      state: this.state,
      currentTaskId: this.currentTaskId,
      counts
    };
  }

  addTask(taskData) {
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: taskData.title || 'Video Task',
      url: taskData.url || '',
      prompt: taskData.prompt || '',
      language: taskData.language || 'English',
      aspectRatio: taskData.aspectRatio || '9:16',
      sessionUrl: taskData.sessionUrl || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.tasks.push(task);
    storage.saveQueue(this.tasks);
    this.emit('queue_updated', this.getStatus());
    this.log(`Đã thêm task mới: "${task.title}" (${task.aspectRatio}, ${task.language})`);
    return task;
  }

  addBatch(tasksList) {
    const created = [];
    for (const t of tasksList) {
      created.push(this.addTask(t));
    }
    return created;
  }

  /**
   * Generate combinations of prompt + aspect ratio + language
   */
  generateVariants(variantOptions) {
    const { title, url, basePrompt, aspectRatios = [], languages = [], sessionUrl = '' } = variantOptions;
    const ratios = aspectRatios.length > 0 ? aspectRatios : ['9:16'];
    const langs = languages.length > 0 ? languages : ['English'];

    const newTasks = [];
    for (const lang of langs) {
      for (const ratio of ratios) {
        const variantTitle = `${title || 'Video'} [${ratio} - ${lang}]`;
        newTasks.push(this.addTask({
          title: variantTitle,
          url,
          prompt: basePrompt,
          language: lang,
          aspectRatio: ratio,
          sessionUrl
        }));
      }
    }

    this.log(`🔥 Đã tự động sinh ${newTasks.length} biến thể vào Queue!`);
    return newTasks;
  }

  removeTask(taskId) {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      const removed = this.tasks.splice(idx, 1)[0];
      storage.saveQueue(this.tasks);
      this.emit('queue_updated', this.getStatus());
      this.log(`Đã xóa task: ${removed.title}`);
      return true;
    }
    return false;
  }

  clearCompleted() {
    this.tasks = this.tasks.filter(t => t.status !== 'completed');
    storage.saveQueue(this.tasks);
    this.emit('queue_updated', this.getStatus());
    this.log('Đã dọn dẹp các task đã hoàn thành.');
  }

  retryFailed() {
    let count = 0;
    for (const t of this.tasks) {
      if (t.status === 'failed') {
        t.status = 'pending';
        t.error = null;
        count++;
      }
    }
    storage.saveQueue(this.tasks);
    this.emit('queue_updated', this.getStatus());
    this.log(`Đã đặt lại trạng thái chờ cho ${count} task lỗi.`);
    return count;
  }

  async start() {
    if (this.state === 'running') return;
    this.state = 'running';
    this.emit('queue_updated', this.getStatus());
    this.log('▶️ Khởi động Queue runner...');
    this.runLoop();
  }

  pause() {
    this.state = 'paused';
    this.emit('queue_updated', this.getStatus());
    this.log('⏸️ Đã tạm dừng Queue runner (task đang chạy sẽ hoàn thành nốt).');
  }

  async runLoop() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.state === 'running') {
        const nextTask = this.tasks.find(t => t.status === 'pending');
        if (!nextTask) {
          this.log('✅ Đã hoàn thành tất cả các task trong Queue!');
          this.state = 'idle';
          this.currentTaskId = null;
          this.emit('queue_updated', this.getStatus());
          break;
        }

        this.currentTaskId = nextTask.id;
        nextTask.status = 'running';
        nextTask.startedAt = new Date().toISOString();
        storage.saveQueue(this.tasks);
        this.emit('queue_updated', this.getStatus());

        this.log(`▶️ Bắt đầu xử lý: "${nextTask.title}" (${nextTask.aspectRatio}, ${nextTask.language})`);

        try {
          await engine.processTask(nextTask, this.settings, (msg) => this.log(msg));
          nextTask.status = 'completed';
          nextTask.completedAt = new Date().toISOString();
          this.log(`🏆 Hoàn thành xuất sắc task: "${nextTask.title}"!`);
        } catch (err) {
          nextTask.status = 'failed';
          nextTask.error = err.message;
          this.log(`❌ Lỗi khi xử lý task "${nextTask.title}": ${err.message}`, 'error');
        }

        storage.saveQueue(this.tasks);
        this.emit('queue_updated', this.getStatus());
        this.currentTaskId = null;

        // Delay between tasks if still running
        if (this.state === 'running') {
          const delaySec = this.settings.delayBetweenTasksSeconds || 5;
          this.log(`⏳ Nghỉ ${delaySec}s trước task kế tiếp...`);
          await new Promise(r => setTimeout(r, delaySec * 1000));
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.state !== 'paused') {
        this.state = 'idle';
      }
      this.emit('queue_updated', this.getStatus());
    }
  }
}

module.exports = new QueueManager();

