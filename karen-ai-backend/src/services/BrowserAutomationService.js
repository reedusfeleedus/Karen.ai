const { chromium } = require('playwright');
const config = require('../config/config');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

class BrowserAutomationService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.screenshotDir = path.join(process.cwd(), 'data', 'screenshots');
    
    // Ensure screenshot directory exists
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async init() {
    if (!this.browser) {
      logger.info('Initializing browser automation service');
      try {
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
        });
        logger.info('Browser launched successfully');
      } catch (error) {
        logger.error('Failed to launch browser:', error);
        throw new Error(`Browser launch failed: ${error.message}`);
      }
    }
    return this.browser;
  }

  async newSession(sessionId) {
    await this.init();
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    this.page = await this.context.newPage();
    logger.info(`New browser session created: ${sessionId}`);
    return this.page;
  }

  async navigateTo(url) {
    if (!this.page) {
      throw new Error('No active browser session');
    }
    
    try {
      logger.info(`Navigating to ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      return await this.takeScreenshot('navigation');
    } catch (error) {
      logger.error(`Failed to navigate to ${url}:`, error);
      throw new Error(`Navigation failed: ${error.message}`);
    }
  }

  async detectWebsite(url) {
    // Detect which service this is based on URL patterns
    for (const [service, patterns] of Object.entries(config.websiteDetectionPatterns)) {
      if (patterns.some(pattern => url.includes(pattern))) {
        logger.info(`Detected website: ${service}`);
        return service;
      }
    }
    logger.info('Unknown website detected');
    return 'unknown';
  }

  async fillForm(selector, value) {
    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      await this.page.fill(selector, value);
      logger.info(`Filled form field ${selector}`);
      return true;
    } catch (error) {
      logger.error(`Failed to fill form field ${selector}:`, error);
      return false;
    }
  }

  async clickElement(selector) {
    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      await this.page.click(selector);
      logger.info(`Clicked element ${selector}`);
      return true;
    } catch (error) {
      logger.error(`Failed to click element ${selector}:`, error);
      return false;
    }
  }

  async extractText(selector) {
    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      const text = await this.page.textContent(selector);
      logger.info(`Extracted text from ${selector}`);
      return text;
    } catch (error) {
      logger.error(`Failed to extract text from ${selector}:`, error);
      return null;
    }
  }

  async takeScreenshot(actionName) {
    if (!this.page) {
      throw new Error('No active browser session');
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${actionName}_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      
      await this.page.screenshot({ path: filepath, fullPage: true });
      logger.info(`Screenshot taken: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error('Failed to take screenshot:', error);
      return null;
    }
  }

  async executeActions(actions) {
    if (!this.page) {
      throw new Error('No active browser session');
    }
    
    const results = [];
    for (const action of actions) {
      try {
        let result;
        switch (action.type) {
          case 'navigate':
            result = await this.navigateTo(action.url);
            break;
          case 'fill':
            result = await this.fillForm(action.selector, action.value);
            break;
          case 'click':
            result = await this.clickElement(action.selector);
            break;
          case 'extract':
            result = await this.extractText(action.selector);
            break;
          case 'screenshot':
            result = await this.takeScreenshot(action.name || 'custom');
            break;
          case 'wait':
            await this.page.waitForTimeout(action.ms || 1000);
            result = true;
            break;
          default:
            logger.warn(`Unknown action type: ${action.type}`);
            result = false;
        }
        results.push({ action, success: !!result, result });
      } catch (error) {
        logger.error(`Action failed: ${action.type}`, error);
        results.push({ action, success: false, error: error.message });
      }
    }
    return results;
  }

  async closeSession() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
      logger.info('Browser session closed');
    }
  }

  async shutdown() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser automation service shut down');
    }
  }

  async getBrowserStatistics() {
    try {
      if (!this.browser) {
        return { status: 'not_initialized' };
      }
      
      const contexts = this.browser.contexts();
      const pages = [];
      
      for (const context of contexts) {
        const contextPages = context.pages();
        for (const page of contextPages) {
          pages.push({
            url: page.url(),
            title: await page.title().catch(() => 'Unknown')
          });
        }
      }
      
      return {
        status: 'active',
        browserVersion: await this.browser.version(),
        contexts: contexts.length,
        pages: pages,
        screenshotCount: fs.readdirSync(this.screenshotDir).length
      };
    } catch (error) {
      logger.error('Error getting browser statistics:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

module.exports = new BrowserAutomationService(); 