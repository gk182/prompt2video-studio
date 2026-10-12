const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_URL: 'https://studio.alconost.com',
  CDP_PORT: 9222,
  CHROME_USER_DATA_DIR: path.join(__dirname, 'chrome_user_data'),
  OUTPUT_DIR: path.join(__dirname, 'output'),
  VIDEOS_DIR: path.join(__dirname, 'output', 'videos'),
  DATA_DIR: path.join(__dirname, 'data'),
  QUEUE_FILE: path.join(__dirname, 'data', 'queue.json'),
  SETTINGS_FILE: path.join(__dirname, 'data', 'settings.json'),
  
  // Default Settings
  DEFAULT_SETTINGS: {
    promptTemplate: 'Create an engaging video for: {url}\nRequirements & Key selling points: {prompt}\nVideo Aspect Ratio: {aspectRatio}\nLanguage: {language}',
    taskTimeoutMinutes: 15,
    delayBetweenTasksSeconds: 5,
    browserMode: 'auto', // 'auto' (try cdp then profile), 'profile', 'cdp'
    headless: false,
    autoDownloadVideo: true
  }
};

