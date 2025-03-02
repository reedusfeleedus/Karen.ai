const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('./config/config');
const MessageHandler = require('./services/MessageHandler');
const BrowserAutomationService = require('./services/BrowserAutomationService');
const logger = require('./utils/logger');
const routes = require('./routes');
const monitoringRoutes = require('./routes/monitoring');
const automationRoutes = require('./routes/automation');

// Ensure required directories exist
const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(dataDir, 'uploads');
const screenshotsDir = path.join(dataDir, 'screenshots');

[dataDir, uploadsDir, screenshotsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Serve static files from data directory (for screenshots, etc.)
app.use('/data', express.static(path.join(__dirname, '../data')));

// Register API routes
app.use('/api', routes);
app.use('/monitoring', monitoringRoutes);
app.use('/api/automation', automationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    environment: config.environment,
    mongodb: process.env.AWS_USE_DYNAMODB === 'true' ? 'using-dynamodb' : 
             (mongoose.connection.readyState === 1 ? 'connected' : 'disconnected')
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  
  // Add user ID to socket
  let userId = socket.handshake.query.userId || `user-${socket.id}`;
  socket.userId = userId;
  
  // Handle incoming messages
  socket.on('message', async (message) => {
    logger.info(`Received message from ${userId}:`, message);
    
    try {
      const response = await MessageHandler.processMessage(message, userId);
      socket.emit('message', response);
    } catch (error) {
      logger.error('Error handling message:', error);
      socket.emit('message', {
        text: 'Sorry, an error occurred while processing your message.',
        timestamp: new Date().toISOString(),
        error: true
      });
    }
  });
  
  // Handle document uploads
  socket.on('document', async (document) => {
    logger.info(`Received document from ${userId}`);
    
    try {
      // In a real app, you'd process the binary data here
      // For now, we'll just send back a mock response
      socket.emit('document_processed', {
        text: 'I\'ve received your document and I\'m analyzing it now.',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error handling document:', error);
      socket.emit('message', {
        text: 'Sorry, I couldn\'t process your document.',
        timestamp: new Date().toISOString(),
        error: true
      });
    }
  });
  
  // Handle session status requests
  socket.on('get_status', async () => {
    try {
      const session = MessageHandler.getUserSession(userId);
      socket.emit('status_update', {
        active: !!session,
        lastActivity: session?.lastActivity,
        conversationId: session?.conversationId
      });
    } catch (error) {
      logger.error('Error getting session status:', error);
      socket.emit('status_update', { error: true });
    }
  });
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Initialize browser automation service
const initAutomation = async () => {
  try {
    await BrowserAutomationService.init();
    logger.info('Browser automation service initialized');
  } catch (error) {
    logger.error('Failed to initialize browser automation:', error);
  }
};

// Initialize DynamoDB if needed
const initDynamoDB = async () => {
  if (process.env.AWS_USE_DYNAMODB === 'true') {
    const DynamoDBAdapter = require('./adapters/DynamoDBAdapter');
    try {
      await DynamoDBAdapter.init();
      logger.info('DynamoDB initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize DynamoDB:', error);
      return false;
    }
  }
  return false;
};

// Initialize database and start server
const initApp = async () => {
  // Try DynamoDB first if enabled
  const dynamoDBInitialized = await initDynamoDB();
  
  if (!dynamoDBInitialized && !process.env.AWS_USE_DYNAMODB) {
    // Only try MongoDB if DynamoDB is not being used or failed to initialize
    const mongooseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };
  
    try {
      await mongoose.connect(config.mongoUri, mongooseOptions);
      logger.info('Connected to MongoDB');
    } catch (err) {
      logger.error('MongoDB connection error:', err);
      logger.warn('Starting server without MongoDB connection - functionality will be limited');
    }
  }
  
  // Initialize automation service and start server
  try {
    await initAutomation();
    logger.info('Starting server...');
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (err) {
    logger.error('Failed to initialize automation service:', err);
    // Start server anyway, even if automation fails
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} (limited functionality)`);
    });
  }
};

// Start the application
initApp();

// Handle MongoDB connection events
mongoose.connection.on('error', err => {
  logger.error('Database error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.info('Database disconnected');
});

// Handle application shutdown
process.on('SIGINT', async () => {
  logger.info('Application shutdown initiated');
  
  try {
    // Close browser automation
    await BrowserAutomationService.shutdown();
    
    // Close MongoDB connection if it's active
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    logger.info('Clean shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}); 