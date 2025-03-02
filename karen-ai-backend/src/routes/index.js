const express = require('express');
const router = express.Router();
const multer = require('multer');
const MessageHandler = require('../services/MessageHandler');
const logger = require('../utils/logger');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../../data/uploads'));
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max size
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and text files
    if (file.mimetype.startsWith('image/') || 
        file.mimetype === 'application/pdf' || 
        file.mimetype.startsWith('text/')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Message handling route
router.post('/message', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Message text is required' });
    }
    
    // Extract user ID from request (in a real app, this would come from auth)
    const userId = req.headers['user-id'] || 'anonymous-user';
    
    const message = {
      text,
      timestamp: new Date().toISOString()
    };
    
    const response = await MessageHandler.processMessage(message, userId);
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error processing message:', error);
    res.status(500).json({
      error: 'Failed to process message',
      message: error.message
    });
  }
});

// Document upload route
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document provided' });
    }
    
    // Extract user ID from request
    const userId = req.headers['user-id'] || 'anonymous-user';
    
    const response = await MessageHandler.processDocumentUpload(req.file, userId);
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error processing document upload:', error);
    res.status(500).json({
      error: 'Failed to process document',
      message: error.message
    });
  }
});

// Get conversation history
router.get('/history', async (req, res) => {
  try {
    const userId = req.headers['user-id'] || 'anonymous-user';
    const history = await MessageHandler.getConversationHistory(userId);
    res.status(200).json({ history });
  } catch (error) {
    logger.error('Error retrieving conversation history:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation history',
      message: error.message
    });
  }
});

// End conversation
router.post('/end', async (req, res) => {
  try {
    const userId = req.headers['user-id'] || 'anonymous-user';
    const response = await MessageHandler.endConversation(userId);
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error ending conversation:', error);
    res.status(500).json({
      error: 'Failed to end conversation',
      message: error.message
    });
  }
});

// Get session status
router.get('/session', async (req, res) => {
  try {
    const userId = req.headers['user-id'] || 'anonymous-user';
    const session = MessageHandler.getUserSession(userId);
    
    if (!session) {
      return res.status(404).json({ error: 'No active session found' });
    }
    
    res.status(200).json({ session });
  } catch (error) {
    logger.error('Error retrieving session:', error);
    res.status(500).json({
      error: 'Failed to retrieve session',
      message: error.message
    });
  }
});

module.exports = router; 