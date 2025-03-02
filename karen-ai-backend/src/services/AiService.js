const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config/config');
const logger = require('../utils/logger');

class AiService {
  constructor() {
    this.useMockMode = process.env.AI_MOCK_MODE === 'true' || !config.aws.accessKeyId || config.aws.accessKeyId === 'your-access-key' || config.aws.accessKeyId === 'your-access-key-here';
    
    if (!this.useMockMode) {
      this.client = new BedrockRuntimeClient({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        }
      });
      this.modelId = config.aws.bedrockModel;
      logger.info(`Using AWS Bedrock with model: ${this.modelId}`);
    } else {
      logger.info('Using mock AI responses (AI_MOCK_MODE enabled)');
      this.modelId = config.aws.bedrockModel;
    }
    
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
    this.maxRequestsPerMinute = 100; // Adjust based on your AWS limits
  }

  async generateResponse(messages, systemPrompt = null) {
    try {
      // If mock mode is enabled, return mock responses
      if (this.useMockMode) {
        return this._generateMockResponse(messages, systemPrompt);
      }
      
      // Basic rate limiting
      if (this._shouldRateLimit()) {
        logger.warn('Rate limit reached, delaying request');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      this.requestCount++;
      this.lastRequestTime = Date.now();

      // Format based on model type (each model has different formats)
      let input;
      if (this.modelId.includes('claude')) {
        input = this._formatClaudeInput(messages, systemPrompt);
      } else if (this.modelId.includes('titan')) {
        input = this._formatTitanInput(messages, systemPrompt);
      } else if (this.modelId.includes('openai')) {
        input = this._formatOpenAIInput(messages, systemPrompt);
      } else {
        // Default format
        input = this._formatTitanInput(messages, systemPrompt);
      }

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(input)
      });

      logger.info(`Sending request to AWS Bedrock with model: ${this.modelId}`);
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      logger.info('AI response generated successfully');
      return this._extractResponseText(responseBody);
    } catch (error) {
      logger.error('Error generating AI response:', error);
      throw new Error(`AI service error: ${error.message}`);
    }
  }

  _generateMockResponse(messages, systemPrompt) {
    logger.info('Generating mock AI response');
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    // Track previous messages to understand context
    const previousMessages = messages.filter(m => m.role === 'assistant').map(m => m.content);
    const conversationState = this._determineMockConversationState(messages);
    
    // Check if we're examining a Spotify subscription cancellation
    if (userMessage.toLowerCase().includes('spotify') || 
        userMessage.toLowerCase().includes('subscription') || 
        userMessage.toLowerCase().includes('cancel')) {
      
      if (systemPrompt && systemPrompt.includes('Extract the customer service issue')) {
        return JSON.stringify({
          issue: "Subscription cancellation",
          service: "Spotify",
          keyDetails: {}
        });
      }
      
      // Directly check for subscription details in the message
      if (this._hasSubscriptionDetails(userMessage)) {
        logger.info('Mock AI detected sufficient subscription details');
        
        // Return structured JSON with the flag to indicate we have enough info
        return JSON.stringify({
          hasEnoughInfo: true,
          details: {
            accountType: userMessage.toLowerCase().includes('premium') ? 'Premium' : 'Free',
            signupMethod: this._extractSignupMethod(userMessage),
            cancellationReason: 'User requested cancellation'
          }
        });
      }
      
      return "I understand you want to cancel your Spotify subscription. To help with this, can you please confirm if you're using a free or premium account, and how you originally signed up (directly through Spotify, through Apple, etc.)?";
    }
    
    // Handle Amazon refund requests
    if (userMessage.toLowerCase().includes('refund') && userMessage.toLowerCase().includes('amazon')) {
      if (systemPrompt && systemPrompt.includes('Extract the customer service issue')) {
        return JSON.stringify({
          issue: "Refund request",
          service: "Amazon",
          keyDetails: {
            orderNumber: userMessage.match(/#(\d+)/) ? userMessage.match(/#(\d+)/)[1] : "Unknown"
          }
        });
      }
      
      if (conversationState === 'initial') {
        return "I understand you need a refund for your Amazon order. I'll need some additional information to help with this. Can you please provide the order date and the reason for the refund request?";
      }
      
      // If we already have detailed information including order date and reason, transition to processing
      if (this._hasRefundDetails(userMessage)) {
        return JSON.stringify({
          hasEnoughInfo: true,
          details: {
            orderNumber: userMessage.match(/#(\d+)/) ? userMessage.match(/#(\d+)/)[1] : "Unknown",
            orderDate: this._extractDate(userMessage),
            reason: this._extractReason(userMessage)
          }
        });
      }
      
      // Still in gathering info state
      return "To process your Amazon refund request, I'll need a few more details: the order date, the reason for the refund, and whether you've already contacted Amazon customer service about this issue.";
    }
    
    // Default responses
    if (systemPrompt && systemPrompt.includes('Extract')) {
      const serviceMatch = userMessage.match(/(\w+)(?=\s+order|\s+subscription|\s+account)/i);
      return JSON.stringify({
        issue: userMessage.includes('refund') ? 'Refund request' : 
               userMessage.includes('cancel') ? 'Cancellation request' : 
               'Customer service inquiry',
        service: serviceMatch ? serviceMatch[0] : 'Unknown',
        keyDetails: {}
      });
    }
    
    if (systemPrompt && systemPrompt.includes('step-by-step automation plan')) {
      return `
1. Navigate to the service provider's website (${userMessage.includes('Amazon') ? 'Amazon.com' : 'the service website'})
2. Go to the customer service or help section
3. Search for information about ${userMessage.includes('refund') ? 'refunds' : 'the customer issue'}
4. Find and select the specific order using the provided information
5. Submit the ${userMessage.includes('refund') ? 'refund' : 'customer service'} request
6. Capture confirmation details
7. Verify the status of the request`;
    }
    
    // Check if we're determining if we have enough info
    if (systemPrompt && systemPrompt.includes('Do we have enough information')) {
      // Mock logic to determine if we have enough info
      if (userMessage.includes('order') && 
          (userMessage.includes('date') || this._extractDate(userMessage)) && 
          (userMessage.includes('reason') || this._extractReason(userMessage))) {
        return "YES, we have enough information to proceed with automation.";
      } else {
        return "NO, we still need the exact order date and detailed reason for the refund.";
      }
    }
    
    return "I'll help you with your customer service request. Could you please provide more specific details about your issue?";
  }

  _shouldRateLimit() {
    const now = Date.now();
    const elapsedMinutes = (now - this.lastRequestTime) / (1000 * 60);
    
    // Reset counter if a minute has passed
    if (elapsedMinutes >= 1) {
      this.requestCount = 0;
      return false;
    }
    
    return this.requestCount >= this.maxRequestsPerMinute;
  }

  _formatClaudeInput(messages, systemPrompt) {
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      temperature: 0.7,
      messages: formattedMessages,
      system: systemPrompt || ''
    };
  }

  _formatTitanInput(messages, systemPrompt) {
    // Convert message history to the format Titan expects
    let text = systemPrompt ? `${systemPrompt}\n\n` : '';
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        text += `Human: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        text += `Assistant: ${msg.content}\n`;
      }
    }
    
    text += 'Assistant: ';

    return {
      inputText: text,
      textGenerationConfig: {
        maxTokenCount: 1000,
        temperature: 0.7,
        topP: 0.9,
      }
    };
  }

  _formatOpenAIInput(messages, systemPrompt) {
    const formattedMessages = [];
    
    // Add system prompt if provided
    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }
    
    // Add conversation messages
    messages.forEach(msg => {
      formattedMessages.push({
        role: msg.role,
        content: msg.content
      });
    });

    return {
      model: this.modelId.split('.')[1] || 'gpt-4',
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 1000
    };
  }

  _extractResponseText(responseBody) {
    // Extract based on model type
    if (this.modelId.includes('claude')) {
      return responseBody.content?.[0]?.text || responseBody.completion || 'No response generated';
    } else if (this.modelId.includes('titan')) {
      return responseBody.results?.[0]?.outputText || 'No response generated';
    } else if (this.modelId.includes('openai')) {
      return responseBody.choices?.[0]?.message?.content || 'No response generated';
    } else {
      // Default extraction
      return responseBody.results?.[0]?.outputText || responseBody.content?.[0]?.text || responseBody.choices?.[0]?.message?.content || 'No response generated';
    }
  }

  // Helper method to determine mock conversation state based on message history
  _determineMockConversationState(messages) {
    if (messages.length <= 2) return 'initial';
    if (messages.length <= 4) return 'gathering_info';
    return 'processing';
  }
  
  // Helper method to check if we have enough refund details
  _hasRefundDetails(message) {
    const hasOrderNumber = message.match(/#(\d+)/) !== null;
    const hasDate = this._extractDate(message) !== null;
    const hasReason = this._extractReason(message) !== null;
    const result = hasOrderNumber && hasDate && hasReason;
    
    logger.info(`Refund details check: orderNumber=${hasOrderNumber}, date=${hasDate}, reason=${hasReason}, sufficient=${result}`);
    if (hasDate) logger.info(`Extracted date: ${this._extractDate(message)}`);
    if (hasReason) logger.info(`Extracted reason: ${this._extractReason(message)}`);
    
    return result;
  }
  
  // Helper method to check if we have enough subscription details
  _hasSubscriptionDetails(message) {
    const messageLower = message.toLowerCase();
    
    // Check for account type information - be more flexible
    const hasAccountType = 
      messageLower.includes('premium') || 
      messageLower.includes('free') || 
      messageLower.includes('paid subscription') ||
      messageLower.includes('family plan') ||
      messageLower.includes('student plan');
    
    // Check for signup method information - be more flexible
    const hasSignupMethod = 
      messageLower.includes('apple') || 
      messageLower.includes('app store') ||
      messageLower.includes('google') || 
      messageLower.includes('play store') ||
      messageLower.includes('direct') || 
      messageLower.includes('website') ||
      messageLower.includes('iphone') ||
      messageLower.includes('android');
    
    const result = hasAccountType && hasSignupMethod;
    
    logger.info(`Subscription details check: accountType=${hasAccountType}, signupMethod=${hasSignupMethod}, sufficient=${result}`);
    logger.info(`Message being checked: "${message}"`);
    
    return result;
  }
  
  // Helper method to extract date from message
  _extractDate(message) {
    const dateRegex = /([A-Z][a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})|(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
    const match = message.match(dateRegex);
    return match ? match[0] : null;
  }
  
  // Helper method to extract reason from message
  _extractReason(message) {
    const reasonKeywords = ['damaged', 'broken', 'wrong', 'defective', 'late', 'cancel', 'not received'];
    for (const keyword of reasonKeywords) {
      if (message.toLowerCase().includes(keyword)) {
        return keyword;
      }
    }
    return null;
  }
  
  // Helper method to extract signup method
  _extractSignupMethod(message) {
    if (message.toLowerCase().includes('apple')) return 'Apple';
    if (message.toLowerCase().includes('google')) return 'Google Play';
    if (message.toLowerCase().includes('website') || message.toLowerCase().includes('direct')) return 'Spotify Website';
    return 'Unknown';
  }

  async getServiceHealth() {
    try {
      if (this.useMockMode) {
        return {
          status: 'mock_mode',
          message: 'AI service is running in mock mode'
        };
      }
      
      // Check AWS Bedrock connectivity
      try {
        const testPrompt = "This is a health check. Please respond with 'ok'.";
        const response = await this.generateResponse([{ role: 'user', content: testPrompt }]);
        
        return {
          status: 'ok',
          model: this.modelId,
          response: response.substring(0, 100), // Truncate long responses
          requestCount: this.requestCount,
          lastRequestTime: new Date(this.lastRequestTime).toISOString(),
          rateLimitInfo: {
            maxRequests: this.maxRequestsPerMinute,
            currentUsage: this.requestCount
          }
        };
      } catch (error) {
        return {
          status: 'error',
          model: this.modelId,
          error: error.message,
          requestCount: this.requestCount,
          lastRequestTime: new Date(this.lastRequestTime).toISOString()
        };
      }
    } catch (error) {
      logger.error('Error checking AI service health:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

module.exports = new AiService(); 