const BrowserAutomationService = require('../services/BrowserAutomationService');
const logger = require('../utils/logger');
const AiService = require('../services/AiService');

/**
 * Specialized adapter for handling Paddy Power help center automation
 */
class PaddyPowerAdapter {
  constructor() {
    this.baseUrl = 'https://helpcenter.paddypower.com/app/home';
    this.selectors = {
      searchBox: '#topicText',
      searchButton: '.input-group-btn button',
      searchResults: '.row.search-result',
      liveChatButton: 'a.chat-link',
      contactOptionsContainer: '.contact-channel-list',
      emailSupportLink: 'a[href*="email-form"]',
      emailSubjectField: '#incident\\.short_description',
      emailDescriptionField: '#incident\\.comments',
      emailSubmitButton: '#submit-button',
      // Add more selectors as needed
    };
  }

  /**
   * Initialize the browser automation for Paddy Power
   */
  async initialize(sessionId) {
    logger.info('Initializing Paddy Power automation session');
    await BrowserAutomationService.init();
    await BrowserAutomationService.newSession(sessionId);
    await this.navigateToHelpCenter();
    return { success: true, message: 'Paddy Power automation initialized' };
  }

  /**
   * Navigate to the help center home page
   */
  async navigateToHelpCenter() {
    logger.info('Navigating to Paddy Power help center');
    await BrowserAutomationService.navigateTo(this.baseUrl);
    return await BrowserAutomationService.takeScreenshot('paddy-power-home');
  }

  /**
   * Search for a specific issue in the help center
   */
  async searchForIssue(query) {
    logger.info(`Searching for issue: ${query}`);
    try {
      await BrowserAutomationService.fillForm(this.selectors.searchBox, query);
      await BrowserAutomationService.clickElement(this.selectors.searchButton);
      
      // Wait for results to load and take screenshot
      await BrowserAutomationService.page.waitForSelector(this.selectors.searchResults, { timeout: 10000 }).catch(() => {});
      const screenshot = await BrowserAutomationService.takeScreenshot('search-results');
      
      // Extract search results
      const results = await BrowserAutomationService.page.$$eval(this.selectors.searchResults, elements => 
        elements.map(el => ({
          title: el.querySelector('h3')?.textContent?.trim() || '',
          description: el.querySelector('p')?.textContent?.trim() || '',
          link: el.querySelector('a')?.href || ''
        }))
      ).catch(() => []);
      
      return {
        success: true,
        results,
        screenshot
      };
    } catch (error) {
      logger.error('Error searching in Paddy Power help center:', error);
      return {
        success: false,
        error: error.message,
        screenshot: await BrowserAutomationService.takeScreenshot('search-error')
      };
    }
  }

  /**
   * Attempt to start a live chat session if available
   */
  async startLiveChat() {
    logger.info('Attempting to start live chat with Paddy Power support');
    try {
      // Check if the live chat button is available
      const chatButton = await BrowserAutomationService.page.$(this.selectors.liveChatButton);
      if (!chatButton) {
        logger.info('Live chat button not found, checking contact options');
        
        // Navigate to contact options if we're not already there
        if (!await BrowserAutomationService.page.$(this.selectors.contactOptionsContainer)) {
          // Look for a "Contact Us" link - this would need to be updated with the actual selector
          await BrowserAutomationService.clickElement('a[href*="contact"]');
        }
        
        // Check again for the chat button
        const chatButtonRetry = await BrowserAutomationService.page.$(this.selectors.liveChatButton);
        if (!chatButtonRetry) {
          return {
            success: false,
            message: 'Live chat is not currently available',
            screenshot: await BrowserAutomationService.takeScreenshot('no-chat-available')
          };
        }
      }
      
      // Click the chat button to initiate chat
      await BrowserAutomationService.clickElement(this.selectors.liveChatButton);
      
      // Take a screenshot of the chat interface
      const screenshot = await BrowserAutomationService.takeScreenshot('chat-interface');
      
      return {
        success: true,
        message: 'Live chat initiated',
        screenshot
      };
    } catch (error) {
      logger.error('Error starting live chat with Paddy Power:', error);
      return {
        success: false,
        error: error.message,
        screenshot: await BrowserAutomationService.takeScreenshot('chat-error')
      };
    }
  }

  /**
   * Send an email to support
   */
  async sendEmailSupport(subject, message) {
    logger.info('Preparing to send email to Paddy Power support');
    try {
      // First navigate to contact options if needed
      if (!await BrowserAutomationService.page.$(this.selectors.contactOptionsContainer)) {
        // Look for a "Contact Us" link - update with actual selector
        await BrowserAutomationService.clickElement('a[href*="contact"]');
      }
      
      // Click email support option
      await BrowserAutomationService.clickElement(this.selectors.emailSupportLink);
      
      // Fill in the email form
      await BrowserAutomationService.fillForm(this.selectors.emailSubjectField, subject);
      await BrowserAutomationService.fillForm(this.selectors.emailDescriptionField, message);
      
      // Take screenshot before submission
      await BrowserAutomationService.takeScreenshot('email-form-filled');
      
      // Submit the form
      await BrowserAutomationService.clickElement(this.selectors.emailSubmitButton);
      
      // Take screenshot after submission
      const screenshot = await BrowserAutomationService.takeScreenshot('email-submission-result');
      
      return {
        success: true,
        message: 'Email sent to support',
        screenshot
      };
    } catch (error) {
      logger.error('Error sending email to Paddy Power support:', error);
      return {
        success: false,
        error: error.message,
        screenshot: await BrowserAutomationService.takeScreenshot('email-error')
      };
    }
  }

  /**
   * Handle a specific customer issue using AI to determine approach
   */
  async handleCustomerIssue(issueDetails) {
    logger.info('Handling customer issue with Paddy Power:', issueDetails);
    
    try {
      // First, use AI to determine the best approach for this issue
      const systemPrompt = `
        You are a customer service automation expert for Paddy Power betting site.
        Analyze this customer issue and determine the best approach:
        1. Search knowledge base for information
        2. Start live chat support
        3. Send email to support
        
        Format your response as a JSON object with:
        {
          "approach": "search|chat|email",
          "searchQuery": "string, if search is best approach",
          "chatMessage": "string, if chat is best approach",
          "emailSubject": "string, if email is best approach",
          "emailMessage": "string, if email is best approach"
        }
      `;
      
      // Generate recommendation using AI
      const aiResponse = await AiService.generateResponse([
        { role: 'user', content: JSON.stringify(issueDetails) }
      ], systemPrompt);
      
      let recommendation;
      try {
        recommendation = JSON.parse(aiResponse);
      } catch (e) {
        logger.warn('Failed to parse AI response as JSON, using default approach', aiResponse);
        recommendation = {
          approach: 'search', 
          searchQuery: `${issueDetails.issueType} ${issueDetails.company}`
        };
      }
      
      // Based on AI recommendation, take appropriate action
      switch (recommendation.approach) {
        case 'search':
          const searchResults = await this.searchForIssue(recommendation.searchQuery);
          return {
            success: searchResults.success,
            action: 'search',
            results: searchResults,
            message: `Searched for information about "${recommendation.searchQuery}"`
          };
          
        case 'chat':
          const chatResult = await this.startLiveChat();
          if (chatResult.success) {
            // If chat successful, we could send the initial message
            // This would need more implementation to handle chat interactions
            return {
              success: true,
              action: 'chat',
              result: chatResult,
              message: 'Started live chat with Paddy Power support'
            };
          } else {
            // Fall back to email if chat fails
            logger.info('Live chat not available, falling back to email');
            return await this.handleEmailFallback(recommendation, issueDetails);
          }
          
        case 'email':
          return await this.handleEmailFallback(recommendation, issueDetails);
          
        default:
          logger.warn('Unknown approach recommended by AI:', recommendation.approach);
          const defaultSearchResults = await this.searchForIssue(`${issueDetails.issueType} ${issueDetails.company}`);
          return {
            success: defaultSearchResults.success,
            action: 'search',
            results: defaultSearchResults,
            message: `Used default search for "${issueDetails.issueType} ${issueDetails.company}"`
          };
      }
    } catch (error) {
      logger.error('Error handling customer issue for Paddy Power:', error);
      return {
        success: false,
        error: error.message,
        screenshot: await BrowserAutomationService.takeScreenshot('issue-handling-error')
      };
    }
  }
  
  /**
   * Handle email fallback when other approaches fail
   */
  async handleEmailFallback(recommendation, issueDetails) {
    const subject = recommendation.emailSubject || `${issueDetails.issueType} - Support Request`;
    const message = recommendation.emailMessage || 
      `I need help with the following issue: ${issueDetails.details}. Please contact me as soon as possible.`;
    
    const emailResult = await this.sendEmailSupport(subject, message);
    return {
      success: emailResult.success,
      action: 'email',
      result: emailResult,
      message: 'Sent email to Paddy Power support'
    };
  }

  /**
   * Clean up resources
   */
  async close() {
    logger.info('Closing Paddy Power automation session');
    await BrowserAutomationService.closeSession();
  }
}

module.exports = new PaddyPowerAdapter(); 