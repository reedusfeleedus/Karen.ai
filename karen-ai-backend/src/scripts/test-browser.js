const BrowserAutomationService = require('../services/BrowserAutomationService');
const logger = require('../utils/logger');

async function testBrowserAutomation() {
  try {
    // Initialize the browser
    await BrowserAutomationService.init();
    logger.info('Browser initialized successfully');
    
    // Create a new session
    const sessionId = 'test-session';
    await BrowserAutomationService.newSession(sessionId);
    logger.info('Session created successfully');
    
    // Test navigation
    const screenshotPath = await BrowserAutomationService.navigateTo('https://example.com');
    logger.info(`Navigation successful, screenshot saved to ${screenshotPath}`);
    
    // Test form interaction (though example.com doesn't have forms)
    const actions = [
      { type: 'extract', selector: 'h1' },
      { type: 'screenshot', name: 'example-com' }
    ];
    
    const results = await BrowserAutomationService.executeActions(actions);
    logger.info('Action results:', results);
    
    // Close the session
    await BrowserAutomationService.closeSession();
    logger.info('Session closed successfully');
    
    // Shutdown browser
    await BrowserAutomationService.shutdown();
    logger.info('Browser shutdown successfully');
    
    return { success: true, results };
  } catch (error) {
    logger.error('Browser automation test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testBrowserAutomation()
  .then(result => {
    if (result.success) {
      console.log('Browser automation test completed successfully');
      process.exit(0);
    } else {
      console.error('Browser automation test failed:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error during test:', error);
    process.exit(1);
  }); 