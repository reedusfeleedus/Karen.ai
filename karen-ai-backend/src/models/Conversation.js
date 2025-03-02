const mongoose = require('mongoose');
const DynamoDBAdapter = process.env.AWS_USE_DYNAMODB === 'true' ? require('../adapters/DynamoDBAdapter') : null;

const ConversationSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    state: {
      type: String,
      enum: ['initial', 'gathering_info', 'processing', 'automating', 'completed', 'error'],
      default: 'initial'
    },
    messages: [{
      role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
      },
      content: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    metadata: {
      issue: String,
      service: String,
      documents: [{
        id: String,
        originalName: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadTime: Date
      }],
      extractedInfo: mongoose.Schema.Types.Mixed,
      automationPlan: String,
      serviceUrl: String,
      screenshots: [String],
      currentStep: {
        type: Number,
        default: 0
      },
      startTime: {
        type: Date,
        default: Date.now
      },
      lastUpdateTime: {
        type: Date,
        default: Date.now
      },
      completionTime: Date
    },
    sessionId: String
  },
  {
    timestamps: true
  }
);

// Indexes for performance
ConversationSchema.index({ userId: 1, createdAt: -1 });
ConversationSchema.index({ 'metadata.service': 1 });
ConversationSchema.index({ state: 1 });

// Create a class to wrap either Mongoose or DynamoDB
class ConversationModel {
  constructor() {
    this.mongooseModel = mongoose.model('Conversation', ConversationSchema);
    this.useDynamoDB = process.env.AWS_USE_DYNAMODB === 'true';
  }

  async create(data) {
    if (this.useDynamoDB && DynamoDBAdapter) {
      return DynamoDBAdapter.create(data);
    }
    return this.mongooseModel.create(data);
  }

  async findOne(query) {
    if (this.useDynamoDB && DynamoDBAdapter) {
      return DynamoDBAdapter.findOne(query);
    }
    return this.mongooseModel.findOne(query);
  }

  async findOneAndUpdate(query, update) {
    if (this.useDynamoDB && DynamoDBAdapter) {
      return DynamoDBAdapter.findOneAndUpdate(query, update);
    }
    return this.mongooseModel.findOneAndUpdate(query, update, { new: true });
  }

  async find(query, options = {}) {
    if (this.useDynamoDB && DynamoDBAdapter) {
      return DynamoDBAdapter.find(query, options);
    }
    
    let mongooseQuery = this.mongooseModel.find(query);
    
    if (options.sort) {
      mongooseQuery = mongooseQuery.sort(options.sort);
    }
    
    if (options.limit) {
      mongooseQuery = mongooseQuery.limit(options.limit);
    }
    
    if (options.select) {
      mongooseQuery = mongooseQuery.select(options.select);
    }
    
    return mongooseQuery.exec();
  }
}

module.exports = new ConversationModel(); 