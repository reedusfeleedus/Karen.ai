import { OpenAI } from 'openai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AutomationService from './AutomationService';

// System prompts for different conversation stages
const SYSTEM_PROMPTS = {
  INITIAL: `You are Karen, a personal customer service AI advocate who fights for users.
  Your tone is friendly, extremely casual, concise, and slightly sassy. You text like a friend, not a customer service rep.
  
  Rules:
  1. Keep all messages extremely short - 1-3 sentences max
  2. Be conversational and use casual language, contractions, etc.
  3. NEVER ask for basic user info like name, phone, address, email - assume it's already stored in the app
  4. Use emojis occasionally 👍
  5. Ask only 1 question at a time
  6. You MUST collect these essential pieces of information:
     - Which company/service the issue is with (ask this first)
     - What type of issue it is (refund, login, billing, etc.)
     - Specific details about the problem
  
  When a user starts a conversation:
  - First ask which company they need help with if not mentioned
  - Then ask what type of issue they're having
  - Finally ask for specific details needed to resolve it
  - Once you have enough info, tell them "Great! I'll handle this for you now"`,
  
  GATHERING_INFO: `As Karen, you're gathering ESSENTIAL information for ticket creation.
  
  YOU MUST collect these pieces of information (in this order):
  1. Company name (ask "Which company is this about?" if not mentioned)
  2. Issue type (ask "What type of problem are you having? Refund, account, etc.")
  3. Specific details about their issue
  
  Rules:
  1. Ask only ONE question at a time in super short texts
  2. Don't ask for basic user details that would be stored in their profile
  3. Use casual, friendly language and short sentences
  4. For each new information, acknowledge what they told you before asking the next question
  
  Once you have company name, issue type, and specific details, say "Got everything I need! I'll handle this for you now."`,
  
  AUTOMATING: `You're now actively handling the customer service issue.
  A ticket has been or is being created with all the information you've gathered.
  
  Give short, friendly updates on what you're doing.
  
  Examples:
  - "On the phone with United now. Hold tight!"
  - "Just sent the refund request. They're processing it!"
  - "Looking at your account now. Almost done!"
  
  Keep updates brief, casual and friendly. Use occasional emojis to keep it personable.`
};
// Add hardcoded API key - replace with your actual key
const OPENAI_API_KEY = 'sk-svcacct-qKfmZyHws6aHWbnJ1z74vfP-fP-t3vDtihPEvw2bVLt4-Y3J8lTsGP5P3Do-gh7vBbfhrT3BlbkFJamnomjPQdPi5iXZAwSvdT7F7HwxDpz8Z4zm8Mslhg23EKtzAJtN1diwXk2buD-8FVn7AA';

// API key storage key
const API_KEY_STORAGE_KEY = '@karen_openai_api_key';

// Add a function to determine if we have enough information to proceed
function hasEnoughInformation(messages) {
  if (!messages || messages.length < 3) {
    return false;
  }
  
  // Join all user messages to analyze content
  const userText = messages
    .filter(msg => msg.sender === 'user')
    .map(msg => msg.text)
    .join(' ');
  
  if (userText.length < 20) {
    return false; // Not enough text to analyze
  }
  
  // Check for key information patterns
  const hasCompany = /\b(amazon|netflix|uber|apple|google|facebook|twitter|instagram|spotify|airbnb|doordash|grubhub|walmart|target|bestbuy|att|verizon|tmobile|sprint|comcast|xfinity|bank|airline|hotel)\b/i.test(userText);
  
  const hasIssueType = /\b(refund|cancel|charge|bill|account|password|login|access|subscription|order|delivery|shipping|return|broken|damage|repair|not working|error|problem|issue|help|support)\b/i.test(userText);
  
  const hasDetails = userText.length > 50;
  
  // Count how many bot questions and user responses we have
  let questionCount = 0;
  let responseAfterQuestion = 0;
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.sender === 'bot' && msg.text.includes('?')) {
      questionCount++;
    } else if (msg.sender === 'user' && questionCount > 0) {
      responseAfterQuestion++;
    }
  }
  
  // Consider information sufficient if:
  // 1. We have company + issue type + details, OR
  // 2. We've had at least 3 back-and-forth exchanges (questions and answers)
  const hasAllKeyInfo = hasCompany && hasIssueType && hasDetails;
  const hasEnoughExchanges = questionCount >= 3 && responseAfterQuestion >= 3;
  
  console.log(`Information check: Company: ${hasCompany}, IssueType: ${hasIssueType}, Details: ${hasDetails}, Exchanges: ${questionCount}Q/${responseAfterQuestion}A`);
  
  return hasAllKeyInfo || hasEnoughExchanges;
}

class ChatService {
  constructor() {
    this.messageHandlers = new Set();
    this.connectionHandlers = new Set();
    this.errorHandlers = new Set();
    this.userId = 'mobile-user-' + Date.now(); // Generate a unique user ID
    this.connected = false;
    this.currentState = 'initial';
    this.messages = []; // Track conversation history
    
    // Initialize OpenAI client with hardcoded key
    this.apiKey = OPENAI_API_KEY;
    this.openai = null;
    
    // Track connection state
    this.isConnecting = false;
    
    // Initialize OpenAI with hardcoded key
    this.initializeOpenAI();
  }
  
  // Load API key from AsyncStorage
  async loadApiKey() {
    // Use hardcoded key instead of AsyncStorage
    this.apiKey = OPENAI_API_KEY;
    this.initializeOpenAI();
  }
  
  // Save API key to AsyncStorage
  async saveApiKey(apiKey) {
    // Just use the hardcoded key
    this.apiKey = OPENAI_API_KEY;
    return true;
  }
  
  // Set API key
  async setApiKey(apiKey) {
    // Ignore the passed key and use hardcoded key
    this.apiKey = OPENAI_API_KEY;
    return this.initializeOpenAI();
  }
  
  // Initialize OpenAI client with API key
  initializeOpenAI() {
    if (!this.apiKey) {
      console.error('No API key available');
      return false;
    }
    
    try {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true // Required for React Native web
      });
      
      // Set connected state
      this.connected = true;
      this.isConnecting = false;
      this.currentState = 'initial';
      
      // Notify connection handlers
      this.connectionHandlers.forEach(handler => handler(true));
      
      console.log('Successfully initialized OpenAI client');
      return true;
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error);
      this.handleConnectionFailure('Failed to initialize OpenAI client: ' + error.message);
      return false;
    }
  }

  connect() {
    if (this.isConnected()) {
      console.log('Already connected to ChatService');
      return;
    }

    console.log('Connecting to ChatService...');
    this.connected = true;
    this.resetConversation(); // Reset conversation state on new connection
    this.notifyConnectionChange();
  }
  
  handleConnectionFailure(errorMessage) {
    console.error('Handling connection failure:', errorMessage);
    // Clean up state
    this.connected = false;
    this.isConnecting = false;
    
    // Notify listeners of error
    this.errorHandlers.forEach(handler => handler(errorMessage));
    this.connectionHandlers.forEach(handler => handler(false));
  }

  disconnect() {
    console.log('Disconnecting from OpenAI API service');
    
    this.openai = null;
    this.connected = false;
    this.connectionHandlers.forEach(handler => handler(false));
  }

  isConnected() {
    return this.connected && this.openai !== null;
  }

  // New method to sync conversation
  syncConversation(screenMessages) {
    // Reset conversation first
    this.resetConversation();
    
    // Then sync with new messages
    // Convert screen messages to our internal format
    this.messages = screenMessages.map(msg => ({
      text: msg.text,
      sender: msg.isUser ? 'user' : 'bot',
      timestamp: msg.timestamp
    }));
    
    // Also store in conversationHistory for backwards compatibility
    this.conversationHistory = screenMessages.map(msg => ({
      text: msg.text,
      isUser: msg.isUser,
      timestamp: msg.timestamp
    }));
    
    console.log(`Synced ${this.messages.length} messages`);
  }

  getSystemPrompt() {
    // Return appropriate system prompt based on current state
    switch(this.currentState) {
      case 'gathering_info':
        return SYSTEM_PROMPTS.GATHERING_INFO + "\n\nThis is a new conversation, completely separate from any previous conversations. Please don't reference previous tickets.";
      case 'automating':
      case 'processing':
        return SYSTEM_PROMPTS.AUTOMATING + "\n\nThis is a new conversation, completely separate from any previous conversations. Please don't reference previous tickets.";
      case 'initial':
      default:
        return SYSTEM_PROMPTS.INITIAL + "\n\nThis is a new conversation, completely separate from any previous conversations. Please don't reference previous tickets.";
    }
  }

  async sendMessage(message) {
    console.log('Sending message to OpenAI:', message);
    
    // Add to our local history
    this.messages.push({
      ...message,
      sender: 'user'
    });
    
    // Check if we're connected
    if (!this.isConnected()) {
      try {
        // Try to connect first
        this.connect();
        
        // If still not connected, throw error
        if (!this.isConnected()) {
          throw new Error('Not connected to OpenAI API');
        }
      } catch (error) {
        console.error('Failed to connect to OpenAI API:', error);
        this.handleMessageError('Connection to OpenAI API failed. Please check your internet connection.');
        return;
      }
    }
    
    try {
      // Convert our message history to OpenAI format
      const formattedMessages = this.formatMessagesForOpenAI();
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',  // Or gpt-3.5-turbo if preferred for cost/speed
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 150 // Keep responses short
      });
      
      console.log('OpenAI API response:', response);
      
      // Extract the response text
      const responseText = response.choices[0]?.message?.content || 
        "Sorry, I didn't get a proper response. Let's try again.";
      
      // Determine if we should change state based on message content
      let newState = this.currentState;
      
      if (this.currentState === 'initial' && this.messages.length > 3) {
        newState = 'gathering_info';
      }
      else if ((this.currentState === 'initial' || this.currentState === 'gathering_info') && 
               hasEnoughInformation(this.messages)) {
        // If text indicates we have enough info, change to automating state
        if (responseText.includes("I'll handle this") || 
            responseText.includes("Got everything I need") ||
            responseText.includes("Great! I have all the info")) {
          newState = 'automating';
        }
      }
      
      // Create formatted response
      const formattedResponse = {
        id: Date.now().toString(),
        text: responseText,
        timestamp: new Date().toISOString(),
        state: newState
      };
      
      // Update our state if it changed
      if (newState !== this.currentState) {
        this.currentState = newState;
      }
      
      // Add to message history
      this.messages.push({
        ...formattedResponse,
        sender: 'bot'
      });
      
      // Notify handlers
      this.messageHandlers.forEach(handler => handler(formattedResponse));

      // Check if we have enough information and should start automation
      if (this.currentState !== 'automating' && hasEnoughInformation(this.messages)) {
        console.log('We have enough information, checking if we should start automation');
        
        // If this is our first time having enough information, try to start automation
        if (this.messages.length > 3) {
          try {
            // Try to start automation, but continue with normal message flow regardless of result
            this.startAutomation().catch(err => console.error('Background automation error:', err));
          } catch (e) {
            console.error('Error starting automation:', e);
            // Continue with normal message flow even if automation fails
          }
        }
      }

      // If we're in automating state, check if we should add automation details
      if (newState === 'automating' && AutomationService.getLastScreenshot()) {
        formattedResponse.automationScreenshot = AutomationService.getLastScreenshot();
      }
    } catch (error) {
      console.error('OpenAI API request failed:', error);
      this.handleMessageError('Failed to get a response: ' + (error.message || 'Unknown error'));
    }
  }
  
  formatMessagesForOpenAI() {
    // Start with system prompt based on current state
    const formattedMessages = [
      { role: 'system', content: this.getSystemPrompt() }
    ];
    
    // Add conversation history (limit to last 10 messages to stay within token limits)
    const recentMessages = this.messages.slice(-10);
    
    recentMessages.forEach(msg => {
      formattedMessages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });
    
    return formattedMessages;
  }
  
  handleMessageError(errorMessage) {
    // Notify error handlers
    this.errorHandlers.forEach(handler => handler(errorMessage));
    
    // Create a fallback error message response
    const errorResponse = {
      id: Date.now().toString(),
      text: "I'm having trouble connecting right now. Please check your connection or try again later.",
      timestamp: new Date().toISOString(),
      error: true
    };
    
    // Still notify message handlers so the UI can update
    this.messageHandlers.forEach(handler => handler(errorResponse));
  }

  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler) {
    this.connectionHandlers.add(handler);
    handler(this.connected); // Call immediately with current state
    return () => this.connectionHandlers.delete(handler);
  }

  onError(handler) {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  // New method to extract ticket information from conversation
  async extractTicketInfoFromConversation() {
    console.log('Extracting ticket information from conversation');
    console.log(`Current message count in ChatService: ${this.messages.length}`);
    
    // Get all user messages for extraction
    const allUserMessages = this.messages
      .filter(msg => msg.sender === 'user')
      .map(msg => msg.text);
    
    // If we don't have any user messages, return default info immediately 
    if (allUserMessages.length === 0) {
      console.log('No user messages found, using default ticket information');
      return {
        company: 'Unknown Company',
        issueType: 'Support Request',
        summary: 'New support request (no user messages)',
        details: 'User initiated a conversation but didn\'t provide details',
        priority: 'medium',
        product: '',
        icon: 'chat'
      };
    }
    
    // Try to infer company and issue type from user messages without API call first
    const combinedText = allUserMessages.join(' ');
    const inferredCompany = this.inferCompanyFromText(combinedText) || 'Unknown Company';
    const inferredIssueType = this.inferIssueTypeFromText(combinedText) || 'Support Request';
    
    // Create fallback ticket info that doesn't require API call
    const fallbackTicketInfo = {
      company: inferredCompany,
      issueType: inferredIssueType,
      summary: allUserMessages[0] || 'New support request',
      details: allUserMessages.join('\n') || 'Created from chat conversation',
      priority: 'medium',
      product: '',
      icon: this.getIconForCompany(inferredCompany) || 'chat'
    };
    
    // If we have just a few messages or OpenAI client is not available, return the fallback
    if (this.messages.length < 3 || !this.openai) {
      console.log('Using basic inference for ticket information (skipping API call)');
      return fallbackTicketInfo;
    }
    
    try {
      // Try to extract more detailed information using OpenAI API
      console.log('Calling OpenAI API to extract ticket information...');
      
      // Convert all messages to a format suitable for analysis
      // Include both user and assistant messages for better context
      const conversationHistory = this.messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
      
      // Prepare extraction prompt
      const extractionPrompt = {
        role: 'system',
        content: `Extract the following information from the conversation to create a customer service ticket:
        1. Company name - MUST be a single word (e.g., Amazon, Netflix, Uber) representing the company the user has an issue with
        2. Issue type - MUST be VERY BRIEF (1-3 words only) like "Refund", "Account Access", "Late Delivery"
        3. Issue summary (1 sentence description)
        4. Issue details (more detailed explanation)
        5. Priority (low, medium, high)
        6. Product/service involved (if mentioned)
        7. Appropriate icon (one of: shopping, movie, music, phone, wifi, car, chat, food, bed, apple, ticket-outline)
        
        CRITICAL FORMAT RULES:
        - Company name must be a single word when possible (e.g., "Amazon" not "Amazon.com")
        - Issue type must be extremely concise (1-3 words maximum)
        - If a company name isn't explicitly mentioned, use the most likely company based on context
        - Never return empty values for company, issueType, summary, or details - provide reasonable defaults
        
        Format your response as a JSON object with these exact fields:
        {
          "company": "",
          "issueType": "",
          "summary": "",
          "details": "",
          "priority": "",
          "product": "",
          "icon": ""
        }
        
        If any information is not available, use a best guess placeholder rather than empty string.
        `
      };
      
      // Set a timeout to avoid hanging forever on API call
      const apiCallPromise = this.openai.chat.completions.create({
        model: 'gpt-4o',  // Use a more capable model for extraction
        messages: [extractionPrompt, ...conversationHistory],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      
      // Add a timeout to prevent waiting too long
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API call timed out')),
        3000); // 3 second timeout
      });
      
      // Race the API call against the timeout
      const response = await Promise.race([apiCallPromise, timeoutPromise]);
      
      // Parse the response
      const responseText = response.choices[0]?.message?.content || '{}';
      console.log('Extraction response received from OpenAI');
      
      let extractedInfo;
      try {
        extractedInfo = JSON.parse(responseText);
        console.log('Successfully parsed extraction response');
        
        // Combine with our fallback for any missing fields
        return {
          company: extractedInfo.company || fallbackTicketInfo.company,
          issueType: extractedInfo.issueType || fallbackTicketInfo.issueType,
          summary: extractedInfo.summary || fallbackTicketInfo.summary,
          details: extractedInfo.details || fallbackTicketInfo.details,
          priority: extractedInfo.priority || 'medium',
          product: extractedInfo.product || '',
          icon: extractedInfo.icon || this.getIconForCompany(extractedInfo.company) || 'chat'
        };
      } catch (parseError) {
        console.error('Failed to parse extraction response, using fallback');
        return fallbackTicketInfo;
      }
    } catch (error) {
      // Handle API call errors gracefully
      console.error('Error extracting ticket info:', error);
      
      if (error.message?.includes('Rate limit') || error.message?.includes('timed out')) {
        console.log('Using fallback ticket info due to API limitations');
      }
      
      // Always return valid ticket information even if API call fails
      return fallbackTicketInfo;
    }
  }
  
  // Helper method to infer company from text
  inferCompanyFromText(text) {
    const companyPatterns = [
      { pattern: /amazon/i, name: 'Amazon', icon: 'shopping' },
      { pattern: /netflix/i, name: 'Netflix', icon: 'movie' },
      { pattern: /spotify/i, name: 'Spotify', icon: 'music' },
      { pattern: /uber/i, name: 'Uber', icon: 'car' },
      { pattern: /lyft/i, name: 'Lyft', icon: 'car' },
      { pattern: /apple/i, name: 'Apple', icon: 'apple' },
      { pattern: /google/i, name: 'Google', icon: 'wifi' },
      { pattern: /facebook/i, name: 'Facebook', icon: 'chat' },
      { pattern: /instagram/i, name: 'Instagram', icon: 'chat' },
      { pattern: /twitter|x\s+app/i, name: 'Twitter', icon: 'chat' },
      { pattern: /airbnb/i, name: 'Airbnb', icon: 'bed' },
      { pattern: /doordash/i, name: 'DoorDash', icon: 'food' },
      { pattern: /grubhub/i, name: 'Grubhub', icon: 'food' },
      { pattern: /ubereats/i, name: 'UberEats', icon: 'food' },
      { pattern: /att|at&t/i, name: 'AT&T', icon: 'phone' },
      { pattern: /verizon/i, name: 'Verizon', icon: 'phone' },
      { pattern: /t-?mobile/i, name: 'TMobile', icon: 'phone' },
      { pattern: /sprint/i, name: 'Sprint', icon: 'phone' },
      { pattern: /comcast/i, name: 'Comcast', icon: 'wifi' },
      { pattern: /xfinity/i, name: 'Xfinity', icon: 'wifi' },
      { pattern: /spectrum/i, name: 'Spectrum', icon: 'wifi' },
      { pattern: /cox/i, name: 'Cox', icon: 'wifi' },
      { pattern: /delta\s+airlines?|delta\s+air/i, name: 'Delta', icon: 'ticket-outline' },
      { pattern: /united\s+airlines?/i, name: 'United', icon: 'ticket-outline' },
      { pattern: /american\s+airlines?/i, name: 'American', icon: 'ticket-outline' },
      { pattern: /southwest\s+airlines?/i, name: 'Southwest', icon: 'ticket-outline' },
      { pattern: /marriott/i, name: 'Marriott', icon: 'bed' },
      { pattern: /hilton/i, name: 'Hilton', icon: 'bed' },
      { pattern: /hyatt/i, name: 'Hyatt', icon: 'bed' },
      { pattern: /hotels\.com/i, name: 'Hotels', icon: 'bed' },
      { pattern: /walmart/i, name: 'Walmart', icon: 'shopping' },
      { pattern: /target/i, name: 'Target', icon: 'shopping' },
      { pattern: /best\s*buy/i, name: 'BestBuy', icon: 'shopping' },
      
      // Generic fallbacks (use these last)
      { pattern: /airline|flight/i, name: 'Airline', icon: 'ticket-outline' },
      { pattern: /hotel/i, name: 'Hotel', icon: 'bed' },
      { pattern: /internet|provider|isp/i, name: 'Internet', icon: 'wifi' },
      { pattern: /phone|carrier|mobile/i, name: 'Phone', icon: 'phone' },
      { pattern: /food|delivery/i, name: 'Food', icon: 'food' },
      { pattern: /store|shop/i, name: 'Store', icon: 'shopping' },
    ];
    
    for (const { pattern, name } of companyPatterns) {
      if (pattern.test(text)) {
        return name;
      }
    }
    
    return null;
  }
  
  // Helper method to infer issue type from text
  inferIssueTypeFromText(text) {
    const issuePatterns = [
      { pattern: /refund|money\s+back|reimburse/i, type: 'Refund' },
      { pattern: /cancel|cancelation|subscription/i, type: 'Cancellation' },
      { pattern: /bill|billing|charge|payment|overcharge/i, type: 'Billing Issue' },
      { pattern: /login|password|access|account|can'?t\s+log\s+in/i, type: 'Account Access' },
      { pattern: /order|delivery|shipping|package|tracking/i, type: 'Delivery Issue' },
      { pattern: /broken|damage|not\s+working|error|problem/i, type: 'Technical Issue' },
      { pattern: /return|exchange/i, type: 'Return' },
      { pattern: /late|delayed|wait/i, type: 'Late Delivery' },
      { pattern: /wrong|incorrect|different/i, type: 'Wrong Item' },
      { pattern: /missing|not\s+included/i, type: 'Missing Item' },
      { pattern: /credit\s+card|payment\s+method|declined/i, type: 'Payment Issue' },
      { pattern: /subscription|plan|upgrade|downgrade/i, type: 'Subscription' },
      { pattern: /customer\s+service|support|help|contact/i, type: 'Support Issue' },
    ];
    
    for (const { pattern, type } of issuePatterns) {
      if (pattern.test(text)) {
        return type;
      }
    }
    
    return 'Support Request';
  }
  
  // Helper method to get icon for company
  getIconForCompany(company) {
    if (!company) return null;
    
    const companyIcons = {
      'Amazon': 'shopping',
      'Netflix': 'movie',
      'Spotify': 'music',
      'Uber': 'car',
      'Lyft': 'car',
      'Apple': 'apple',
      'Google': 'wifi',
      'Facebook': 'chat',
      'Instagram': 'chat',
      'Twitter': 'chat',
      'Airbnb': 'bed',
      'Phone Carrier': 'phone',
      'Internet Provider': 'wifi',
      'Airline': 'ticket-outline',
      'Hotel': 'bed',
    };
    
    return companyIcons[company] || null;
  }

  // New method to handle automation
  async startAutomation(conversation) {
    console.log('Starting automation based on conversation');
    
    if (!this.connected) {
      console.warn('Cannot start automation: ChatService not connected');
      return {
        success: false,
        error: 'Not connected to AI service'
      };
    }
    
    try {
      // Extract ticket info from conversation
      const ticketInfo = await this.extractTicketInfoFromConversation();
      console.log('Extracted ticket info for automation:', ticketInfo);
      
      // Check if this is Paddy Power related
      if (ticketInfo.company.toLowerCase().includes('paddy') || 
          ticketInfo.company.toLowerCase().includes('power') ||
          ticketInfo.details.toLowerCase().includes('paddy power')) {
        
        console.log('Starting Paddy Power specific automation');
        
        // Start the automation session
        const sessionStart = await AutomationService.startPaddyPowerSession(this.userId);
        
        if (!sessionStart.success) {
          throw new Error(sessionStart.error || 'Failed to start automation session');
        }
        
        // Hand off the issue to the automation
        const result = await AutomationService.handleCustomerIssue(ticketInfo);
        
        // Update conversation state
        this.currentState = 'automating';
        
        // Add a message to the chat about the automation
        const automationMessage = {
          id: Date.now().toString(),
          text: `I'm working with ${ticketInfo.company} to resolve your ${ticketInfo.issueType} issue. ${result.message || ''}`,
          timestamp: new Date().toISOString(),
          sender: 'bot'
        };
        
        this.messages.push(automationMessage);
        
        // Notify message handlers
        this.messageHandlers.forEach(handler => handler(automationMessage));
        
        return {
          success: true,
          ticketInfo,
          automationResult: result
        };
      } else {
        console.log('No specific automation available for', ticketInfo.company);
        return {
          success: false,
          error: `No automation available for ${ticketInfo.company}`
        };
      }
    } catch (error) {
      console.error('Automation error:', error);
      
      // Add an error message to the chat
      const errorMessage = {
        id: Date.now().toString(),
        text: `I'm having some technical difficulties with the automation. Let me try a different approach to help you.`,
        timestamp: new Date().toISOString(),
        sender: 'bot'
      };
      
      this.messages.push(errorMessage);
      
      // Notify message handlers
      this.messageHandlers.forEach(handler => handler(errorMessage));
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Add new method to reset conversation state
  resetConversation() {
    console.log('Resetting conversation state');
    this.conversationHistory = [];
    this.lastResponse = null;
    this.currentState = 'initial';
    this.messages = []; // Also clear the messages array
  }

  notifyConnectionChange() {
    this.connectionHandlers.forEach(handler => handler(this.connected));
  }
}

export default new ChatService(); 