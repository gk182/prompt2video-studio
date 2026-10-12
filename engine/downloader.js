const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');

/**
 * Sanitize filename to avoid invalid characters on Windows/Linux
 */
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

/**
 * Download video from URL to local disk
 * @param {string} url - Direct video URL (.mp4)
 * @param {string} filename - Desired filename without extension
 * @param {function} onProgress - Progress callback ({ percent, loaded, total })
 * @returns {Promise<{ filePath: string, fileName: string, sizeBytes: number }>}
 */
async function downloadVideo(url, filename, onProgress = null) {
  if (!url) {
    throw new Error('Video URL is required for download');
  }

  // Ensure output directory exists
  if (!fs.existsSync(config.VIDEOS_DIR)) {
    fs.mkdirSync(config.VIDEOS_DIR, { recursive: true });
  }

  // Determine extension
  let ext = '.mp4';
  const cleanUrl = url.split('?')[0];
  if (cleanUrl.endsWith('.webm')) ext = '.webm';
  if (cleanUrl.endsWith('.mov')) ext = '.mov';

  const safeName = `${sanitizeFilename(filename)}${ext}`;
  const targetPath = path.join(config.VIDEOS_DIR, safeName);

  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Referer': config.BASE_URL
    },
    timeout: 60000
  });

  const totalLength = parseInt(response.headers['content-length'] || '0', 10);
  let downloadedBytes = 0;

  const writer = fs.createWriteStream(targetPath);

  return new Promise((resolve, reject) => {
    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (onProgress && totalLength > 0) {
        const percent = Math.round((downloadedBytes / totalLength) * 100);
        onProgress({ percent, loaded: downloadedBytes, total: totalLength });
      }
    });

    response.data.pipe(writer);

    writer.on('finish', () => {
      const stats = fs.statSync(targetPath);
      resolve({
        filePath: targetPath,
        fileName: safeName,
        sizeBytes: stats.size
      });
    });

    writer.on('error', (err) => {
      fs.unlink(targetPath, () => {});
      reject(err);
    });

    response.data.on('error', (err) => {
      fs.unlink(targetPath, () => {});
      reject(err);
    });
  });
}

module.exports = {
  downloadVideo,
  sanitizeFilename
};

