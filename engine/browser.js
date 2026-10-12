const { chromium } = require('playwright');
const http = require('http');
const config = require('../config');

class BrowserManager {
  constructor() {
    this.browserContext = null;
    this.activePage = null;
    this.isCdp = false;
    this.isConnected = false;
  }

  /**
   * Check if Chrome CDP port 9222 is actively responding
   */
  async isCdpAvailable() {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${config.CDP_PORT}/json/version`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Initialize browser either via CDP or persistent profile
   */
  async initBrowser(options = {}) {
    if (this.browserContext) {
      return this.browserContext;
    }

    const mode = options.browserMode || 'auto';
    const headless = options.headless !== undefined ? options.headless : false;

    // Check CDP if mode is 'auto' or 'cdp'
    if (mode === 'auto' || mode === 'cdp') {
      const cdpReady = await this.isCdpAvailable();
      if (cdpReady) {
        try {
          this.browserContext = await chromium.connectOverCDP(`http://127.0.0.1:${config.CDP_PORT}`);
          this.isCdp = true;
          this.isConnected = true;
          return this.browserContext;
        } catch (e) {
          if (mode === 'cdp') throw e;
        }
      }
    }

    // Launch persistent Chrome context (try installed Chrome first, fallback to chromium)
    const launchArgs = [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-infobars'
    ];
    if (process.platform === 'win32') {
      launchArgs.push('--start-maximized');
    }

    try {
      this.browserContext = await chromium.launchPersistentContext(config.CHROME_USER_DATA_DIR, {
        channel: 'chrome',
        headless: headless,
        args: launchArgs,
        viewport: null,
        ignoreDefaultArgs: ['--enable-automation']
      });
    } catch (err) {
      // Fallback if Chrome channel is not found (e.g. non-standard install path on macOS)
      this.browserContext = await chromium.launchPersistentContext(config.CHROME_USER_DATA_DIR, {
        headless: headless,
        args: launchArgs,
        viewport: null,
        ignoreDefaultArgs: ['--enable-automation']
      });
    }

    this.isCdp = false;
    this.isConnected = true;
    return this.browserContext;
  }

  /**
   * Get an existing page or create a new tab
   */
  async getPage() {
    if (!this.browserContext) {
      await this.initBrowser();
    }

    const pages = this.browserContext.pages ? this.browserContext.pages() : (this.browserContext.contexts ? this.browserContext.contexts()[0]?.pages() : []);
    if (pages && pages.length > 0) {
      // Find an Alconost studio tab if already open
      const alconostTab = pages.find(p => p.url().includes('studio.alconost.com'));
      this.activePage = alconostTab || pages[0];
    } else {
      this.activePage = await this.browserContext.newPage();
    }

    return this.activePage;
  }

  /**
   * Check if user is logged into Alconost Studio
   */
  async checkAuthStatus() {
    try {
      const page = await this.getPage();
      const currentUrl = page.url();

      if (currentUrl.includes('studio.alconost.com/s/')) {
        // Match username like /s/phamg2944-XXXXX/
        const match = currentUrl.match(/\/s\/([a-zA-Z0-9_]+)-/);
        const username = match ? match[1] : 'user';
        return {
          loggedIn: true,
          username,
          currentUrl
        };
      }

      // If not on studio session URL, navigate to base URL and check
      if (!currentUrl.includes('studio.alconost.com')) {
        await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      }

      const postNavUrl = page.url();
      if (postNavUrl.includes('/s/')) {
        const match = postNavUrl.match(/\/s\/([a-zA-Z0-9_]+)-/);
        return {
          loggedIn: true,
          username: match ? match[1] : 'user',
          currentUrl: postNavUrl
        };
      }

      // Check if session sidebar or chat element exists in DOM
      const hasSessions = await page.locator('.wallwrap, textarea, [placeholder*="Type a message"]').count();
      if (hasSessions > 0 && !postNavUrl.includes('login') && !postNavUrl.includes('auth')) {
        return {
          loggedIn: true,
          username: 'detected',
          currentUrl: postNavUrl
        };
      }

      return {
        loggedIn: false,
        username: null,
        currentUrl: postNavUrl
      };
    } catch (err) {
      return {
        loggedIn: false,
        error: err.message,
        username: null
      };
    }
  }

  /**
   * Launch Chrome and navigate to login page, allowing the user to sign in
   */
  async openLoginWindow(onStatus = null) {
    await this.initBrowser({ headless: false });
    const page = await this.getPage();
    await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (onStatus) onStatus('Đã mở Chrome. Vui lòng đăng nhập Google trên trình duyệt...');

    // Wait until URL changes to /s/ or user logs in (up to 5 minutes)
    const startTime = Date.now();
    const timeout = 5 * 60 * 1000;

    while (Date.now() - startTime < timeout) {
      const auth = await this.checkAuthStatus();
      if (auth.loggedIn) {
        if (onStatus) onStatus(`Đăng nhập Google thành công! Tài khoản: ${auth.username}`);
        return auth;
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error('Hết thời gian chờ đăng nhập (5 phút). Vui lòng thử lại.');
  }

  /**
   * Close browser context
   */
  async close() {
    if (this.browserContext) {
      try {
        if (!this.isCdp) {
          await this.browserContext.close();
        }
      } catch (e) {}
      this.browserContext = null;
      this.activePage = null;
      this.isConnected = false;
    }
  }
}

module.exports = new BrowserManager();

