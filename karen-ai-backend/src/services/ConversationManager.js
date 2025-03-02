const AiService = require('./AiService');
const BrowserAutomationService = require('./BrowserAutomationService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');

// Conversation states
const STATES = {
  INITIAL: 'initial',
  GATHERING_INFO: 'gathering_info',
  PROCESSING: 'processing',
  AUTOMATING: 'automating',
  COMPLETED: 'completed',
  ERROR: 'error'
};

class ConversationManager {
  constructor() {
    this.conversations = new Map();
    this.sessionTracking = new Map();
    this.useDynamoDB = process.env.AWS_USE_DYNAMODB === 'true';
  }
  
  // Helper method to normalize objects from different data sources
  _normalizeConversation(conversation) {
    if (!conversation) return null;
    
    // If it's already a plain object (from DynamoDB or memory)
    if (!conversation.toObject) {
      return conversation;
    }
    
    // If it's a Mongoose model, convert to object
    return conversation.toObject();
  }

  async initializeConversation(userId) {
    const conversationId = uuidv4();
    
    const conversationData = {
      userId,
      conversationId,
      messages: [],
      state: STATES.INITIAL,
      sessionId: null,
      metadata: {
        issue: null,
        service: null,
        documents: [],
        extractedInfo: {},
        currentStep: 0,
        startTime: Date.now(),
        lastUpdateTime: Date.now()
      }
    };
    
    // Store in memory
    this.conversations.set(conversationId, conversationData);
    
    // Persist to database
    try {
      await Conversation.create(conversationData);
      logger.info(`Initialized and persisted conversation ${conversationId} for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to persist conversation to database:`, error);
    }
    
    return conversationId;
  }

  async processMessage(conversationId, userMessage) {
    if (!this.conversations.has(conversationId)) {
      // Try to load from database
      try {
        const dbConversation = await Conversation.findOne({ conversationId });
        if (dbConversation) {
          const normalizedConversation = this._normalizeConversation(dbConversation);
          this.conversations.set(conversationId, normalizedConversation);
        } else {
          throw new Error(`Conversation ${conversationId} not found`);
        }
      } catch (error) {
        throw new Error(`Conversation ${conversationId} not found: ${error.message}`);
      }
    }

    const conversation = this.conversations.get(conversationId);
    conversation.metadata.lastUpdateTime = Date.now();

    // Add user message to history
    conversation.messages.push({
      role: 'user',
      content: userMessage.text,
      timestamp: new Date().toISOString()
    });

    // Store system prompt if provided
    if (userMessage.systemPrompt) {
      conversation.metadata.systemPrompt = userMessage.systemPrompt;
      logger.info(`Updated conversation ${conversationId} with custom system prompt`);
    }

    // Process based on current state
    let response;
    try {
      switch (conversation.state) {
        case STATES.INITIAL:
          response = await this._handleInitialMessage(conversation, userMessage);
          break;
        case STATES.GATHERING_INFO:
          response = await this._handleGatheringInfo(conversation, userMessage);
          break;
        case STATES.PROCESSING:
          response = await this._handleProcessing(conversation, userMessage);
          break;
        case STATES.AUTOMATING:
          response = await this._handleAutomating(conversation, userMessage);
          break;
        case STATES.COMPLETED:
        case STATES.ERROR:
          response = await this._handleFollowUp(conversation, userMessage);
          break;
        default:
          response = {
            text: "I'm not sure what to do next. Could you please provide more details?",
            timestamp: new Date().toISOString()
          };
      }
    } catch (error) {
      logger.error(`Error processing message in conversation ${conversationId}:`, error);
      response = {
        text: `I encountered an error: ${error.message}. Please try again or provide more information.`,
        timestamp: new Date().toISOString(),
        error: true
      };
      conversation.state = STATES.ERROR;
    }

    // Add assistant response to history
    conversation.messages.push({
      role: 'assistant',
      content: response.text,
      timestamp: response.timestamp
    });
    
    // Persist conversation update to database
    try {
      await Conversation.findOneAndUpdate(
        { conversationId },
        {
          messages: conversation.messages,
          state: conversation.state,
          metadata: conversation.metadata,
          sessionId: conversation.sessionId
        }
      );
      logger.info(`Updated conversation ${conversationId} in database`);
    } catch (error) {
      logger.warn(`Failed to update conversation in database, continuing with in-memory only:`, error);
    }

    return response;
  }

  async _handleInitialMessage(conversation, message) {
    // Default system prompt for initial analysis
    const defaultSystemPrompt = 'You are a customer service automation assistant. Extract the customer service issue, the service provider, and any key details from the user message.';
    
    // Use custom system prompt if available, or fall back to default
    const systemPrompt = message.systemPrompt || conversation.metadata.systemPrompt || defaultSystemPrompt;
    
    const aiResponse = await AiService.generateResponse([{
      role: 'user',
      content: message.text
    }], systemPrompt);

    // Try to extract structured data from the AI response
    try {
      const extractedData = JSON.parse(aiResponse);
      conversation.metadata.issue = extractedData.issue;
      conversation.metadata.service = extractedData.service;
      if (extractedData.keyDetails) {
        conversation.metadata.extractedInfo = { ...extractedData.keyDetails };
      }
    } catch (error) {
      // If JSON parsing fails, use AI to extract key information
      const issuePrompt = `Extract the customer service issue from this text: "${message.text}"`;
      conversation.metadata.issue = await AiService.generateResponse([{
        role: 'user',
        content: issuePrompt
      }]);
      
      const servicePrompt = `Extract the service provider (e.g., Amazon, PayPal) from this text: "${message.text}"`;
      conversation.metadata.service = await AiService.generateResponse([{
        role: 'user',
        content: servicePrompt
      }]);
    }

    // Move to gathering info state
    conversation.state = STATES.GATHERING_INFO;
    
    // Determine what additional information we need
    const infoNeededPrompt = `
      Based on this customer service issue: "${conversation.metadata.issue}" 
      with service provider: "${conversation.metadata.service}", 
      what additional information do I need to collect from the user to resolve this issue?
      Format your response as a friendly message asking for the specific missing information.
    `;
    
    // Use the custom system prompt for generating the response
    const infoResponse = await AiService.generateResponse([{
      role: 'user',
      content: infoNeededPrompt
    }], systemPrompt);

    return {
      text: infoResponse,
      timestamp: new Date().toISOString(),
      state: conversation.state,
      metadata: {
        issue: conversation.metadata.issue,
        service: conversation.metadata.service
      }
    };
  }

  async _handleGatheringInfo(conversation, message) {
    // Extract information from user message
    const defaultSystemPrompt = `
      You are extracting key information for a customer service issue.
      Current issue: ${conversation.metadata.issue}
      Service provider: ${conversation.metadata.service}
      Already known information: ${JSON.stringify(conversation.metadata.extractedInfo)}
      
      Extract any new relevant information from the user's message and format as JSON.
      Include order numbers, dates, account details, amounts, etc.
    `;
    
    // Use custom system prompt if available, or fall back to default
    const systemPrompt = conversation.metadata.systemPrompt || defaultSystemPrompt;
    
    const extractionResponse = await AiService.generateResponse([{
      role: 'user',
      content: message.text
    }], systemPrompt);
    
    logger.info(`AI extraction response: ${typeof extractionResponse === 'string' ? extractionResponse.substring(0, 100) + '...' : 'non-string response'}`);
    
    // Try to parse the extracted information
    try {
      // If the response starts with a non-JSON character, it's likely not JSON
      if (typeof extractionResponse === 'string' && 
          (extractionResponse.trim().startsWith('{') || extractionResponse.trim().startsWith('['))) {
        
        const newInfo = JSON.parse(extractionResponse);
        
        // Check if the AI indicated we have enough info to proceed
        if (newInfo.hasEnoughInfo === true) {
          logger.info('AI indicates we have enough information to proceed to processing');
          // Update information and proceed to processing
          conversation.metadata.extractedInfo = {
            ...conversation.metadata.extractedInfo,
            ...newInfo.details
          };
          
          // Move to processing state
          conversation.state = STATES.PROCESSING;
          return this._beginProcessing(conversation);
        }
        
        conversation.metadata.extractedInfo = {
          ...conversation.metadata.extractedInfo,
          ...newInfo
        };
      } else {
        // If response doesn't look like JSON, treat it as a regular message
        logger.info('AI response does not appear to be JSON format, treating as regular message');
        conversation.metadata.extractedInfo.notes = 
          (conversation.metadata.extractedInfo.notes || '') + ' ' + extractionResponse;
      }
    } catch (error) {
      logger.warn(`Failed to parse extracted information as JSON: ${error.message}`);
      logger.warn(`Response that failed to parse: ${extractionResponse}`);
      // Simply append the extraction response as a note
      conversation.metadata.extractedInfo.notes = 
        (conversation.metadata.extractedInfo.notes || '') + ' ' + extractionResponse;
    }
    
    // Check if we have enough information to proceed
    const checkInfoPrompt = `
      For this customer service issue: "${conversation.metadata.issue}" 
      with service provider: "${conversation.metadata.service}",
      with this information: ${JSON.stringify(conversation.metadata.extractedInfo)}
      
      Do we have enough information to begin automating the customer service process? 
      Answer YES or NO, and if NO, explain what specific information is still needed.
    `;
    
    const checkResponse = await AiService.generateResponse([{
      role: 'user',
      content: checkInfoPrompt
    }]);
    
    if (checkResponse.includes('YES')) {
      // We have enough information to proceed
      conversation.state = STATES.PROCESSING;
      return this._beginProcessing(conversation);
    } else {
      // Still need more information
      const requestMoreInfoPrompt = `
        Based on this customer service issue: "${conversation.metadata.issue}" 
        with service provider: "${conversation.metadata.service}",
        and this information: ${JSON.stringify(conversation.metadata.extractedInfo)},
        
        What specific additional information do I need to ask the user for?
        Format as a friendly message asking for just the specific missing information.
      `;
      
      const requestResponse = await AiService.generateResponse([{
        role: 'user',
        content: requestMoreInfoPrompt
      }]);
      
      return {
        text: requestResponse,
        timestamp: new Date().toISOString(),
        state: conversation.state
      };
    }
  }

  async _beginProcessing(conversation) {
    try {
      // Generate a response plan using AI
      const defaultSystemPrompt = `
        You are a customer service automation assistant creating a plan to handle this issue:
        Issue: ${conversation.metadata.issue}
        Service provider: ${conversation.metadata.service}
        Available information: ${JSON.stringify(conversation.metadata.extractedInfo)}
        
        Create a step-by-step automation plan to resolve this issue with the service provider.
      `;
      
      // Use custom system prompt if available, or fall back to default
      const systemPrompt = conversation.metadata.systemPrompt || defaultSystemPrompt;
      
      const planPrompt = `Based on the information provided, create a detailed step-by-step plan to resolve this customer service issue.`;
      const aiResponse = await AiService.generateResponse([{
        role: 'user',
        content: planPrompt
      }], systemPrompt);
      
      // Store the plan
      conversation.metadata.automationPlan = aiResponse;
      
      // Transition to automation state if automationService is enabled
      if (this.useAutomationService) {
        // Determine the service URL
        let serviceUrl;
        
        if (conversation.metadata.service?.toLowerCase().includes('amazon')) {
          serviceUrl = 'https://www.amazon.com';
        } else if (conversation.metadata.service?.toLowerCase().includes('paypal')) {
          serviceUrl = 'https://www.paypal.com';
        } else if (conversation.metadata.service?.toLowerCase().includes('uber')) {
          serviceUrl = 'https://www.uber.com';
        } else if (conversation.metadata.service?.toLowerCase().includes('airbnb')) {
          serviceUrl = 'https://www.airbnb.com';
        } else if (conversation.metadata.service?.toLowerCase().includes('spotify')) {
          serviceUrl = 'https://www.spotify.com';
        } else {
          // For demo purposes, use a simple site if we can't determine the service
          serviceUrl = 'https://example.com';
        }
        
        conversation.metadata.serviceUrl = serviceUrl;
        conversation.state = STATES.AUTOMATING;
        
        return {
          text: `I have all the information I need! I'm now going to automate the process to resolve your ${conversation.metadata.issue} issue with ${conversation.metadata.service}. I'll keep you updated on my progress.`,
          timestamp: new Date().toISOString(),
          state: conversation.state,
          metadata: {
            plan: conversation.metadata.automationPlan
          }
        };
      }
    } catch (error) {
      logger.error(`Error during automation process: ${error.message}`, error);
      
      // Take a screenshot of the error state if possible
      let errorScreenshot = null;
      try {
        if (BrowserAutomationService.page) {
          errorScreenshot = await BrowserAutomationService.takeScreenshot('automation_error');
          if (conversation.metadata.screenshots) {
            conversation.metadata.screenshots.push(errorScreenshot);
          }
        }
      } catch (screenshotError) {
        logger.error(`Failed to capture error screenshot: ${screenshotError.message}`);
      }
      
      // Move to error state
      conversation.state = STATES.ERROR;
      
      return {
        text: `I encountered an issue while trying to automate your ${conversation.metadata.issue || 'request'}. The error was: ${error.message}. Would you like me to try again or help you complete this process manually?`,
        timestamp: new Date().toISOString(),
        state: conversation.state,
        error: true,
        metadata: {
          errorDetail: error.message,
          screenshot: errorScreenshot
        }
      };
    }
  }

  async _handleProcessing(conversation, message) {
    // This state is transitional; normally we would immediately move to automating
    conversation.state = STATES.AUTOMATING;
    return this._beginProcessing(conversation);
  }

  async _handleAutomating(conversation, message) {
    try {
      // Initialize browser session if needed
      if (!conversation.sessionId) {
        conversation.sessionId = uuidv4();
        await BrowserAutomationService.newSession(conversation.sessionId);
        // Store the mapping between sessionId and conversationId
        this.sessionTracking.set(conversation.sessionId, conversation.conversationId);
        
        // Set default service URL if not present
        if (!conversation.metadata.serviceUrl) {
          // Determine appropriate URL based on service
          const serviceUrls = {
            'spotify': 'https://www.spotify.com/account/overview/',
            'amazon': 'https://www.amazon.com/gp/css/order-history',
            'netflix': 'https://www.netflix.com/account',
            'default': 'https://example.com'
          };
          
          conversation.metadata.serviceUrl = serviceUrls[conversation.metadata.service?.toLowerCase()] || serviceUrls.default;
        }
        
        // Navigate to the service website
        logger.info(`Navigating to service URL: ${conversation.metadata.serviceUrl}`);
        const navResult = await BrowserAutomationService.navigateTo(conversation.metadata.serviceUrl);
        conversation.metadata.screenshots = conversation.metadata.screenshots || [];
        conversation.metadata.screenshots.push(navResult);
        
        return {
          text: `I've started the automation process. I'm navigating to the ${conversation.metadata.service} website to handle your ${conversation.metadata.issue} issue.`,
          timestamp: new Date().toISOString(),
          state: conversation.state,
          metadata: {
            screenshot: navResult
          }
        };
      }
      
      // If we already have a session, perform the next step in the automation process
      // Check the current page content to determine the next action
      const currentUrl = await BrowserAutomationService.page.url();
      logger.info(`Current URL in automation: ${currentUrl}`);
      
      // Take a screenshot to show current progress
      const screenshotPath = await BrowserAutomationService.takeScreenshot(`step_${conversation.metadata.currentStep || 0}`);
      conversation.metadata.screenshots = conversation.metadata.screenshots || [];
      conversation.metadata.screenshots.push(screenshotPath);
      
      // For this demo, we're just simulating the automation
      // In a real implementation, we would:
      // 1. Analyze the current page to determine what actions to take
      // 2. Execute the appropriate actions (click buttons, fill forms, etc.)
      // 3. Verify the results
      // 4. Move to the next step
      
      const serviceName = conversation.metadata.service || 'the service';
      
      // Update the current step number
      conversation.metadata.currentStep = (conversation.metadata.currentStep || 0) + 1;
      
      if (conversation.metadata.currentStep >= 3) {
        // After a few steps, simulate completion
        conversation.state = STATES.COMPLETED;
        conversation.metadata.completionTime = new Date().toISOString();
        
        return {
          text: `I've successfully completed the process to handle your ${conversation.metadata.issue} with ${serviceName}. Your request has been submitted and you should receive confirmation from ${serviceName} soon.`,
          timestamp: new Date().toISOString(),
          state: conversation.state,
          metadata: {
            screenshot: screenshotPath,
            completionTime: conversation.metadata.completionTime
          }
        };
      }
      
      return {
        text: `I'm working on your ${conversation.metadata.issue} with ${serviceName}. Currently on step ${conversation.metadata.currentStep} of the process. I'll keep you updated as I make progress.`,
        timestamp: new Date().toISOString(),
        state: conversation.state,
        metadata: {
          screenshot: screenshotPath,
          currentStep: conversation.metadata.currentStep
        }
      };
    } catch (error) {
      logger.error(`Error during automation process: ${error.message}`, error);
      
      // Take a screenshot of the error state if possible
      let errorScreenshot = null;
      try {
        if (BrowserAutomationService.page) {
          errorScreenshot = await BrowserAutomationService.takeScreenshot('automation_error');
          if (conversation.metadata.screenshots) {
            conversation.metadata.screenshots.push(errorScreenshot);
          }
        }
      } catch (screenshotError) {
        logger.error(`Failed to capture error screenshot: ${screenshotError.message}`);
      }
      
      // Move to error state
      conversation.state = STATES.ERROR;
      
      return {
        text: `I encountered an issue while trying to automate your ${conversation.metadata.issue || 'request'}. The error was: ${error.message}. Would you like me to try again or help you complete this process manually?`,
        timestamp: new Date().toISOString(),
        state: conversation.state,
        error: true,
        metadata: {
          errorDetail: error.message,
          screenshot: errorScreenshot
        }
      };
    }
  }

  async _handleFollowUp(conversation, message) {
    // Default follow-up system prompt
    const defaultSystemPrompt = `
      You are a customer service automation assistant who has handled this issue:
      Issue: ${conversation.metadata.issue}
      Service: ${conversation.metadata.service}
      Status: ${conversation.state === STATES.COMPLETED ? 'Successfully completed' : 'Error occurred'}
      
      Respond helpfully to the user's follow-up question.
    `;
    
    // Use custom system prompt if available, or fall back to default
    const systemPrompt = message.systemPrompt || conversation.metadata.systemPrompt || defaultSystemPrompt;
    
    const aiResponse = await AiService.generateResponse(
      conversation.messages.slice(-5), // Use last 5 messages for context
      systemPrompt
    );
    
    return {
      text: aiResponse,
      timestamp: new Date().toISOString(),
      state: conversation.state
    };
  }

  async getConversationHistory(conversationId) {
    if (!this.conversations.has(conversationId)) {
      // Try to load from database
      try {
        const dbConversation = await Conversation.findOne({ conversationId });
        if (dbConversation) {
          const normalizedConversation = this._normalizeConversation(dbConversation);
          this.conversations.set(conversationId, normalizedConversation);
          return normalizedConversation.messages;
        }
      } catch (error) {
        logger.error(`Error loading conversation from database:`, error);
      }
      return null;
    }
    return this.conversations.get(conversationId).messages;
  }

  async getConversationMetadata(conversationId) {
    if (!this.conversations.has(conversationId)) {
      // Try to load from database
      try {
        const dbConversation = await Conversation.findOne({ conversationId });
        if (dbConversation) {
          const normalizedConversation = this._normalizeConversation(dbConversation);
          this.conversations.set(conversationId, normalizedConversation);
          return normalizedConversation.metadata;
        }
      } catch (error) {
        logger.error(`Error loading conversation from database:`, error);
      }
      return null;
    }
    return this.conversations.get(conversationId).metadata;
  }
  
  async getUserConversations(userId, limit = 10) {
    try {
      let conversations;
      
      if (this.useDynamoDB) {
        // For DynamoDB, we need to handle sorting in the application
        conversations = await Conversation.find({ userId }, { limit });
        
        // Sort manually for DynamoDB
        conversations.sort((a, b) => {
          const timeA = a.metadata?.lastUpdateTime || 0;
          const timeB = b.metadata?.lastUpdateTime || 0;
          return timeB - timeA; // Descending
        });
      } else {
        // For MongoDB, we can use the sort option
        conversations = await Conversation.find(
          { userId },
          {
            sort: { 'metadata.lastUpdateTime': -1 },
            limit,
            select: 'conversationId state metadata.issue metadata.service metadata.startTime metadata.lastUpdateTime metadata.completionTime'
          }
        );
      }
      
      return conversations.map(conv => this._normalizeConversation(conv));
    } catch (error) {
      logger.warn(`Error fetching user conversations from database, using in-memory fallback:`, error);
      
      // In-memory fallback
      const userConversations = Array.from(this.conversations.values())
        .filter(conv => conv.userId === userId)
        .sort((a, b) => b.metadata.lastUpdateTime - a.metadata.lastUpdateTime)
        .slice(0, limit)
        .map(conv => ({
          conversationId: conv.conversationId,
          state: conv.state,
          metadata: {
            issue: conv.metadata.issue,
            service: conv.metadata.service,
            startTime: conv.metadata.startTime,
            lastUpdateTime: conv.metadata.lastUpdateTime,
            completionTime: conv.metadata.completionTime
          }
        }));
      
      return userConversations;
    }
  }
}

module.exports = new ConversationManager(); 