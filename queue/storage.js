const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const config = require('../config');

class StorageManager {
  constructor() {
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(config.DATA_DIR)) {
      fs.mkdirSync(config.DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(config.VIDEOS_DIR)) {
      fs.mkdirSync(config.VIDEOS_DIR, { recursive: true });
    }
  }

  /**
   * Load queue from file
   */
  loadQueue() {
    try {
      if (fs.existsSync(config.QUEUE_FILE)) {
        const raw = fs.readFileSync(config.QUEUE_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Lỗi đọc queue file:', e);
    }
    return [];
  }

  /**
   * Save queue to file
   */
  saveQueue(tasks) {
    try {
      this.ensureDirs();
      fs.writeFileSync(config.QUEUE_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
    } catch (e) {
      console.error('Lỗi lưu queue file:', e);
    }
  }

  /**
   * Load settings
   */
  loadSettings() {
    try {
      if (fs.existsSync(config.SETTINGS_FILE)) {
        const raw = fs.readFileSync(config.SETTINGS_FILE, 'utf-8');
        return { ...config.DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {}
    return { ...config.DEFAULT_SETTINGS };
  }

  /**
   * Save settings
   */
  saveSettings(settings) {
    try {
      this.ensureDirs();
      fs.writeFileSync(config.SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (e) {
      console.error('Lỗi lưu settings file:', e);
    }
  }

  /**
   * Import tasks from Excel or CSV file
   */
  importFromExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const importedTasks = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Normalize column names
      const title = row['Title'] || row['Tên'] || row['Tên sản phẩm'] || row['Name'] || `Video_${i + 1}`;
      const url = row['URL'] || row['Link'] || row['Website'] || '';
      const prompt = row['Prompt'] || row['Yêu cầu'] || row['Mô tả'] || '';
      const language = row['Language'] || row['Ngôn ngữ'] || 'English';
      const aspectRatio = row['AspectRatio'] || row['Tỉ lệ'] || row['Ratio'] || '9:16';
      const sessionUrl = row['SessionUrl'] || row['Session'] || '';

      if (!url && !prompt) continue; // Skip empty rows

      importedTasks.push({
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: String(title).trim(),
        url: String(url).trim(),
        prompt: String(prompt).trim(),
        language: String(language).trim(),
        aspectRatio: String(aspectRatio).trim(),
        sessionUrl: String(sessionUrl).trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }

    return importedTasks;
  }

  /**
   * Export all tasks to Excel
   */
  exportToExcel(tasks, targetPath) {
    const data = tasks.map((t, idx) => ({
      'STT': idx + 1,
      'Mã Task': t.id,
      'Tên Sản Phẩm': t.title,
      'URL': t.url,
      'Tỉ Lệ': t.aspectRatio,
      'Ngôn Ngữ': t.language,
      'Trạng Thái': t.status,
      'File Video': t.outputFileName || '',
      'Dung Lượng (MB)': t.fileSizeBytes ? (t.fileSizeBytes / (1024 * 1024)).toFixed(2) : '',
      'Link Video Gốc': t.outputVideoUrl || '',
      'Session URL': t.sessionUrl || '',
      'Prompt': t.prompt,
      'Kịch Bản / Phản Hồi AI': t.aiResponse || '',
      'Lỗi (nếu có)': t.error || '',
      'Ngày Tạo': t.createdAt || '',
      'Hoàn Thành Lúc': t.completedAt || ''
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);

    // Auto width
    const colWidths = [
      { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 35 }, { wch: 10 }, { wch: 15 },
      { wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 45 }, { wch: 40 }, { wch: 40 },
      { wch: 50 }, { wch: 30 }, { wch: 22 }, { wch: 22 }
    ];
    worksheet['!cols'] = colWidths;

    xlsx.utils.book_append_sheet(workbook, worksheet, 'KetQua_Video');
    xlsx.writeFile(workbook, targetPath);
    return targetPath;
  }

  /**
   * Generate sample template Excel
   */
  generateSampleTemplate(targetPath) {
    const sampleData = [
      {
        'Title': 'Nourii App Promo',
        'URL': 'https://ainourii.com',
        'Prompt': 'Focus on AI meal identification, table scene with full week of meals, warm and calm tone',
        'Language': 'English',
        'AspectRatio': '9:16',
        'SessionUrl': ''
      },
      {
        'Title': 'GardenVibe Plant Care',
        'URL': 'https://gardenvibe.app',
        'Prompt': 'Show plant scanning diagnosis, instant tips for house plants, upbeat vibe',
        'Language': 'Vietnamese',
        'AspectRatio': '16:9',
        'SessionUrl': ''
      },
      {
        'Title': 'SleepFlow Tracker',
        'URL': 'https://sleepflow.io',
        'Prompt': 'Calm night atmosphere, smart alarm and deep sleep stages analytics',
        'Language': 'English',
        'AspectRatio': '1:1',
        'SessionUrl': ''
      }
    ];

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 25 }, { wch: 35 }, { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 40 }
    ];

    xlsx.utils.book_append_sheet(workbook, worksheet, 'DanhSach_Prompt_Mau');
    xlsx.writeFile(workbook, targetPath);
    return targetPath;
  }
}

module.exports = new StorageManager();

