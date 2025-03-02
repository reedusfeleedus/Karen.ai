const PaddyPowerAdapter = require('../adapters/PaddyPowerAdapter');
const BrowserAutomationService = require('../services/BrowserAutomationService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Test script for Paddy Power automation
 */
async function testPaddyPowerAutomation() {
  const sessionId = uuidv4();
  logger.info(`Starting Paddy Power automation test with session ID: ${sessionId}`);
  
  try {
    // Initialize the adapter
    await PaddyPowerAdapter.initialize(sessionId);
    logger.info('Paddy Power adapter initialized successfully');
    
    // Take screenshots to verify we're on the correct page
    const homeScreenshot = await BrowserAutomationService.takeScreenshot('paddy-power-home-verification');
    logger.info(`Home page screenshot saved: ${homeScreenshot}`);
    
    // Test search functionality
    const searchTest = await PaddyPowerAdapter.searchForIssue('how to withdraw funds');
    logger.info('Search test completed:', searchTest.success ? 'Success' : 'Failed');
    if (searchTest.results) {
      logger.info(`Found ${searchTest.results.length} search results`);
    }
    
    // Test handling a specific customer issue
    const issueDetails = {
      issueType: 'Account Access',
      company: 'Paddy Power',
      details: 'I cannot log into my account. It says my password is incorrect but I am sure it is right.'
    };
    
    const automationResult = await PaddyPowerAdapter.handleCustomerIssue(issueDetails);
    logger.info('Customer issue handling completed:', 
                automationResult.success ? 'Success' : 'Failed', 
                'Action:', automationResult.action);
    
    // Clean up resources
    await PaddyPowerAdapter.close();
    await BrowserAutomationService.shutdown();
    
    return {
      success: true,
      sessionId,
      searchTest,
      automationResult
    };
  } catch (error) {
    logger.error('Paddy Power automation test failed:', error);
    
    // Attempt to clean up resources even if the test fails
    try {
      await PaddyPowerAdapter.close();
      await BrowserAutomationService.shutdown();
    } catch (cleanupError) {
      logger.error('Failed to clean up resources:', cleanupError);
    }
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Execute the test if this script is run directly
if (require.main === module) {
  logger.info('Running Paddy Power automation test script...');
  
  testPaddyPowerAutomation()
    .then(result => {
      if (result.success) {
        console.log('\n✅ Paddy Power automation test completed successfully');
        console.log('Search results found:', result.searchTest?.results?.length || 0);
        console.log('Automation action performed:', result.automationResult?.action);
        process.exit(0);
      } else {
        console.error('\n❌ Paddy Power automation test failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Unhandled error during Paddy Power test:', error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = testPaddyPowerAutomation;
} 