const ConversationManager = require('./ConversationManager');
const DocumentParserService = require('./DocumentParserService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class MessageHandler {
  constructor() {
    this.activeUsers = new Map(); // Map of userId to active conversationId
    this.userSessions = new Map(); // Map of userId to session metadata
  }

  async processMessage(message, userId) {
    try {
      logger.info(`Processing message from user ${userId}`);
      
      let conversationId = this.activeUsers.get(userId);
      
      // Initialize conversation if it doesn't exist
      if (!conversationId) {
        conversationId = await ConversationManager.initializeConversation(userId);
        this.activeUsers.set(userId, conversationId);
        this.userSessions.set(userId, {
          lastActivity: Date.now(),
          conversationId,
          isActive: true
        });
        logger.info(`Created new conversation ${conversationId} for user ${userId}`);
      }
      
      // Log if system prompt is present
      if (message.systemPrompt) {
        logger.info(`Message includes custom system prompt: ${message.systemPrompt.substring(0, 100)}...`);
      }
      
      // Process the message, passing the systemPrompt if available
      const response = await ConversationManager.processMessage(conversationId, message);
      
      // Update session activity
      const session = this.userSessions.get(userId);
      if (session) {
        session.lastActivity = Date.now();
      }
      
      return response;
    } catch (error) {
      logger.error(`Error processing message:`, error);
      return {
        text: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        error: true
      };
    }
  }

  async processDocumentUpload(file, userId) {
    try {
      logger.info(`Processing document upload from user ${userId}`);
      
      // Get the active conversation
      const conversationId = this.activeUsers.get(userId);
      if (!conversationId) {
        throw new Error('No active conversation found');
      }
      
      // Save the document
      const document = await DocumentParserService.saveDocument(file, userId, conversationId);
      
      // Parse the document
      const parsedDocument = await DocumentParserService.parseDocument(document);
      
      // Add the document to the conversation metadata
      const conversation = await ConversationManager.getConversationMetadata(conversationId);
      if (conversation) {
        // Update the conversation with document info
        conversation.documents = [...(conversation.documents || []), document];
        
        // Update extracted info with document data
        if (parsedDocument.structured) {
          conversation.extractedInfo = {
            ...conversation.extractedInfo,
            ...parsedDocument.structured
          };
        }
      }
      
      return {
        text: `I've analyzed your document and extracted the key information. This will help me resolve your issue more effectively.`,
        timestamp: new Date().toISOString(),
        documentInfo: {
          id: document.id,
          name: document.originalName,
          extractedInfo: parsedDocument.structured
        }
      };
    } catch (error) {
      logger.error(`Error processing document upload:`, error);
      return {
        text: `I couldn't process your document: ${error.message}. Please try uploading it again or in a different format.`,
        timestamp: new Date().toISOString(),
        error: true
      };
    }
  }

  async endConversation(userId) {
    try {
      const conversationId = this.activeUsers.get(userId);
      if (conversationId) {
        // Clean up any resources
        // Close browser sessions, etc.
        this.activeUsers.delete(userId);
        
        const session = this.userSessions.get(userId);
        if (session) {
          session.isActive = false;
        }
        
        logger.info(`Ended conversation ${conversationId} for user ${userId}`);
      }
      
      return {
        text: `Thank you for using our service. Your session has been closed.`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error ending conversation:`, error);
      return {
        text: `There was an issue closing your session: ${error.message}`,
        timestamp: new Date().toISOString(),
        error: true
      };
    }
  }

  async getConversationHistory(userId) {
    const conversationId = this.activeUsers.get(userId);
    if (!conversationId) {
      return [];
    }
    return await ConversationManager.getConversationHistory(conversationId) || [];
  }
  
  getUserSession(userId) {
    return this.userSessions.get(userId);
  }
}

module.exports = new MessageHandler(); 