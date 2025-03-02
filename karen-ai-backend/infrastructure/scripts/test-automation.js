const { chromium } = require('playwright');

async function testAutomation() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Test navigation
    await page.goto('https://example.com');
    console.log('Page title:', await page.title());

    // Take a screenshot
    await page.screenshot({ path: '/app/data/test-screenshot.png' });

    console.log('Browser automation test successful!');
  } catch (error) {
    console.error('Browser automation test failed:', error);
  } finally {
    await browser.close();
  }
}

testAutomation(); 