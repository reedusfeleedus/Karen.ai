const AiService = require('../services/AiService');
const BrowserAutomationService = require('../services/BrowserAutomationService');
const logger = require('../utils/logger');
const ConversationManager = require('../services/ConversationManager');
const { v4: uuidv4 } = require('uuid');

async function testAutomationWorkflow() {
  try {
    logger.info('Starting full automation workflow test');
    
    // Step 1: Create a test conversation
    const userId = 'test-user-' + Date.now();
    const conversationId = uuidv4();
    logger.info(`Creating test conversation with ID: ${conversationId}`);
    
    // Initialize conversation with a test message
    const initialMessage = {
      role: 'user',
      content: 'I need to cancel my Spotify Premium subscription that I signed up for through the Apple App Store',
      timestamp: new Date().toISOString()
    };
    
    // Simulate the conversation flow
    logger.info('Creating mock conversation for testing');
    
    // Step 2: Initialize browser automation
    await BrowserAutomationService.init();
    logger.info('Browser automation initialized');
    await BrowserAutomationService.newSession(conversationId);
    
    // Step 3: Generate AI plan for the automation
    logger.info('Generating automation plan using AI');
    const systemPrompt = `
      You are a customer service automation expert. Create a step-by-step automation plan
      for handling the following request: "Cancel Spotify Premium subscription through Apple App Store".
      Format the response as a detailed list of steps that a browser automation tool would execute.
    `;
    
    const aiResponse = await AiService.generateResponse([initialMessage], systemPrompt);
    logger.info('AI generated automation plan:', aiResponse);
    
    // Step 4: Execute a simple automation sequence
    // For this test, we'll navigate to Spotify and take screenshots
    // In a real scenario, we would follow the AI-generated plan
    logger.info('Executing simple automation sequence');
    const actions = [
      { type: 'navigate', url: 'https://spotify.com' },
      { type: 'screenshot', name: 'spotify-homepage' },
      { type: 'extract', selector: 'title' }, 
      { type: 'navigate', url: 'https://support.spotify.com' },
      { type: 'screenshot', name: 'spotify-support' },
      // In a real scenario, we would navigate to Apple's subscription management
      { type: 'navigate', url: 'https://www.apple.com/app-store/' },
      { type: 'screenshot', name: 'apple-app-store' }
    ];
    
    const results = await BrowserAutomationService.executeActions(actions);
    logger.info(`Completed ${results.length} automation actions`);
    
    // Log the results of each action
    results.forEach((result, index) => {
      if (result.success) {
        logger.info(`Action ${index+1} succeeded: ${result.action.type}`);
        if (result.action.type === 'extract') {
          logger.info(`Extracted content: ${result.result}`);
        }
      } else {
        logger.error(`Action ${index+1} failed: ${result.action.type}`, result.error);
      }
    });
    
    // Step 5: Generate a response based on the automation results
    logger.info('Generating final response based on automation results');
    const finalResponsePrompt = `
      Based on the customer request to cancel a Spotify Premium subscription through Apple App Store,
      generate a helpful response that explains:
      1. We've identified the steps needed
      2. Summarize the process to cancel through Apple's subscription settings
      3. Provide any additional helpful information
    `;
    
    const finalResponse = await AiService.generateResponse([
      initialMessage,
      { role: 'assistant', content: 'I understand you want to cancel your Spotify Premium subscription that was purchased through the Apple App Store. Let me help you with that.' }
    ], finalResponsePrompt);
    
    logger.info('Generated final response for the customer');
    logger.info(finalResponse);
    
    // Close browser session
    await BrowserAutomationService.closeSession();
    logger.info('Browser session closed');
    
    // Shutdown browser
    await BrowserAutomationService.shutdown();
    logger.info('Browser shutdown');
    
    return {
      success: true,
      conversationId,
      automationResults: results,
      finalResponse
    };
  } catch (error) {
    logger.error('Automation workflow test failed:', error);
    // Try to clean up resources even if test fails
    try {
      await BrowserAutomationService.closeSession();
      await BrowserAutomationService.shutdown();
    } catch (shutdownError) {
      logger.error('Error during browser shutdown:', shutdownError);
    }
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Run the test
testAutomationWorkflow()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Automation workflow test completed successfully');
      console.log('Final response:');
      console.log(result.finalResponse);
      process.exit(0);
    } else {
      console.error('\n❌ Automation workflow test failed:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Unhandled error during test:', error);
    process.exit(1);
  }); 