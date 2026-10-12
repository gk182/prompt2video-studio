const browserManager = require('./browser');
const downloader = require('./downloader');
const config = require('../config');
const fs = require('fs');
const path = require('path');

class AlconostEngine {
  /**
   * Format prompt text from task data using template
   */
  formatPrompt(task, customTemplate = null) {
    const template = customTemplate || config.DEFAULT_SETTINGS.promptTemplate;
    return template
      .replace(/{url}/g, task.url || '')
      .replace(/{prompt}/g, task.prompt || '')
      .replace(/{aspectRatio}/g, task.aspectRatio || '9:16 (Vertical Reels)')
      .replace(/{language}/g, task.language || 'English')
      .replace(/{title}/g, task.title || '');
  }

  /**
   * Ensure user is logged in before proceeding
   */
  async ensureAuthenticated(page, onLog = console.log) {
    const auth = await browserManager.checkAuthStatus();
    if (!auth.loggedIn) {
      onLog('⚠️ Chưa phát hiện phiên đăng nhập Google. Đang chuyển hướng kiểm tra...');
      await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3000);
      
      const retryAuth = await browserManager.checkAuthStatus();
      if (!retryAuth.loggedIn) {
        throw new Error('Vui lòng đăng nhập Google vào Alconost Studio trước khi chạy Queue. Bấm nút "Mở Chrome đăng nhập" trên giao diện!');
      }
    }
    return true;
  }

  /**
   * Open or create a studio session
   */
  async prepareSession(page, task, onLog = console.log) {
    // Case 1: Specific Session URL specified
    if (task.sessionUrl && task.sessionUrl.trim().startsWith('http')) {
      onLog(`🔗 Đang mở session chỉ định: ${task.sessionUrl}`);
      await page.goto(task.sessionUrl.trim(), { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      return page.url();
    }

    // Case 2: Create a new session (if current page is in /s/)
    const currentUrl = page.url();
    if (currentUrl.includes('/s/')) {
      onLog('➕ Đang tìm nút "+ New session" để tạo phiên làm việc mới...');
      try {
        // Try clicking "+ New session" button
        const newSessionBtn = page.locator('button:has-text("New session"), a:has-text("New session"), text="+ New session"').first();
        if (await newSessionBtn.isVisible({ timeout: 4000 })) {
          const oldUrl = currentUrl;
          await newSessionBtn.click();
          await page.waitForTimeout(3000);
          
          // Wait for new session URL
          await page.waitForFunction((prevUrl) => window.location.href !== prevUrl, oldUrl, { timeout: 10000 }).catch(() => {});
          const newUrl = page.url();
          onLog(`✅ Đã tạo session mới: ${newUrl}`);
          return newUrl;
        }
      } catch (err) {
        onLog(`ℹ️ Không tìm thấy nút tạo mới session hoặc đang ở session trống: ${err.message}`);
      }
    } else {
      onLog('🌐 Đang điều hướng đến Alconost Studio...');
      await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
    }

    return page.url();
  }

  /**
   * Type message into chat and send
   */
  async sendPrompt(page, promptText, onLog = console.log) {
    onLog('✍️ Đang nhập prompt vào khung chat...');

    // Wait for chat input textarea
    const textareaSelector = 'textarea[placeholder*="Type a message"], textarea[placeholder*="message"], textarea#prompt, textarea';
    await page.waitForSelector(textareaSelector, { timeout: 15000 });
    
    const textarea = page.locator(textareaSelector).first();
    await textarea.click();
    await textarea.fill('');
    await page.waitForTimeout(500);
    
    // Type or fill the prompt text
    await textarea.fill(promptText);
    await page.waitForTimeout(800);

    onLog('🚀 Đang gửi tin nhắn (Bấm nút Send)...');
    
    // Find Send button or press Ctrl+Enter
    const sendButton = page.locator('button:has-text("Send"), button.pri.go, button[type="submit"], #go').first();
    const canClick = await sendButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (canClick) {
      await sendButton.click();
    } else {
      // Fallback: keyboard shortcut
      await textarea.press('Control+Enter');
    }

    await page.waitForTimeout(2000);
    onLog('📨 Đã gửi tin nhắn thành công. Bắt đầu lắng nghe quá trình AI tạo video...');
  }

  /**
   * Monitor page and network to capture generated video output
   */
  async waitForVideoGeneration(page, timeoutMinutes = 15, onLog = console.log) {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const startTime = Date.now();
    let capturedVideoUrl = null;
    let aiResponseText = '';

    // Intercept network responses for .mp4 files
    const responseHandler = (response) => {
      try {
        const url = response.url();
        if (
          (url.includes('.mp4') || url.includes('r2.dev') || url.includes('/video')) &&
          !url.includes('placeholder') &&
          !url.includes('avatar')
        ) {
          if (!capturedVideoUrl || url.includes('.mp4')) {
            capturedVideoUrl = url;
            onLog(`🎯 Bắt được link video từ Network: ${url}`);
          }
        }
      } catch (e) {}
    };

    page.on('response', responseHandler);

    try {
      while (Date.now() - startTime < timeoutMs) {
        // 1. Check if video link is already in DOM
        const videoElementSrc = await page.evaluate(() => {
          // Check video tag
          const video = document.querySelector('video');
          if (video && video.src && video.src.startsWith('http')) return video.src;
          const source = document.querySelector('video source');
          if (source && source.src && source.src.startsWith('http')) return source.src;
          
          // Check data-src on tiles/preview
          const tile = document.querySelector('[data-src*=".mp4"]');
          if (tile) return tile.getAttribute('data-src');

          // Check links in chat (.mp4)
          const links = Array.from(document.querySelectorAll('a[href*=".mp4"]'));
          if (links.length > 0) return links[links.length - 1].href;

          return null;
        });

        if (videoElementSrc) {
          capturedVideoUrl = videoElementSrc;
          onLog(`🎬 Tìm thấy phần tử video trên trang: ${videoElementSrc}`);
        }

        // 2. Extract AI response text
        const latestChatText = await page.evaluate(() => {
          // Look for chat message bubbles
          const messages = document.querySelectorAll('.message, [class*="bubble"], [class*="msg"], p');
          let text = '';
          messages.forEach(m => {
            if (m.textContent && (m.textContent.includes('.mp4') || m.textContent.includes('ad:') || m.textContent.includes('Hook:'))) {
              text = m.textContent.trim();
            }
          });
          return text;
        });

        if (latestChatText) {
          aiResponseText = latestChatText;
        }

        // If we captured video URL, wait a few seconds to let rendering settle and return
        if (capturedVideoUrl) {
          onLog('✨ Video đã hoàn thành tạo và tải!');
          await page.waitForTimeout(3000);
          return {
            videoUrl: capturedVideoUrl,
            aiText: aiResponseText,
            completed: true
          };
        }

        // Periodic log heartbeat every 30 seconds
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);
        if (elapsedSec > 0 && elapsedSec % 30 === 0) {
          onLog(`⏳ Đang chờ AI xử lý và render video... (${Math.round(elapsedSec / 60)} phút / tối đa ${timeoutMinutes} phút)`);
        }

        await page.waitForTimeout(4000);
      }

      throw new Error(`Quá thời gian chờ (${timeoutMinutes} phút) mà chưa thấy video output.`);
    } finally {
      page.off('response', responseHandler);
    }
  }

  /**
   * Full execution flow for a single queue task
   */
  async processTask(task, settings, onLog = console.log) {
    const page = await browserManager.getPage();
    await this.ensureAuthenticated(page, onLog);

    // Step 1: Open or create session
    onLog(`[${task.title || task.id}] Bắt đầu xử lý task...`);
    const sessionUrl = await this.prepareSession(page, task, onLog);
    task.sessionUrl = sessionUrl;

    // Step 2: Format prompt
    const finalPrompt = this.formatPrompt(task, settings.promptTemplate);
    task.finalPrompt = finalPrompt;

    // Step 3: Send message
    await this.sendPrompt(page, finalPrompt, onLog);

    // Step 4: Wait for generation
    const timeout = settings.taskTimeoutMinutes || config.DEFAULT_SETTINGS.taskTimeoutMinutes;
    const result = await this.waitForVideoGeneration(page, timeout, onLog);
    task.outputVideoUrl = result.videoUrl;
    task.aiResponse = result.aiText;

    // Step 5: Download video if enabled
    if (settings.autoDownloadVideo !== false && result.videoUrl) {
      onLog(`⬇️ Đang tải video xuống máy: ${result.videoUrl}...`);
      const filename = `${task.id}_${task.title || 'video'}_${task.aspectRatio || '9x16'}`.replace(/\s+/g, '_');
      
      const downloadInfo = await downloader.downloadVideo(
        result.videoUrl,
        filename,
        (progress) => {
          if (progress.percent % 25 === 0) {
            onLog(`📊 Tiến độ tải video: ${progress.percent}%`);
          }
        }
      );

      task.outputVideoPath = downloadInfo.filePath;
      task.outputFileName = downloadInfo.fileName;
      task.fileSizeBytes = downloadInfo.sizeBytes;
      onLog(`🎉 Đã lưu video thành công: ${downloadInfo.fileName} (${(downloadInfo.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`);

      // Save metadata JSON
      const metaPath = path.join(config.VIDEOS_DIR, `${filename}_info.json`);
      fs.writeFileSync(metaPath, JSON.stringify({
        task,
        downloadedAt: new Date().toISOString(),
        videoUrl: result.videoUrl,
        aiResponse: result.aiText
      }, null, 2), 'utf-8');
    }

    return task;
  }
}

module.exports = new AlconostEngine();

