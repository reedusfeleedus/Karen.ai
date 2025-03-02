const express = require('express');
const router = express.Router();
const os = require('os');
const BrowserAutomationService = require('../services/BrowserAutomationService');
const AiService = require('../services/AiService');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// System health status
router.get('/health/system', (req, res) => {
  try {
    const systemInfo = {
      uptime: Math.floor(process.uptime()),
      memory: {
        free: os.freemem(),
        total: os.totalmem(),
        percentUsed: Math.round((1 - os.freemem() / os.totalmem()) * 100)
      },
      cpu: os.cpus().length,
      loadAvg: os.loadavg(),
      platform: os.platform(),
      nodeVersion: process.version
    };
    
    res.status(200).json({
      status: 'ok',
      system: systemInfo
    });
  } catch (error) {
    logger.error('Error fetching system health:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system health information'
    });
  }
});

// Database health status
router.get('/health/database', async (req, res) => {
  try {
    let dbStatus = {
      status: 'ok'
    };
    
    // Check MongoDB connection if not using DynamoDB
    if (process.env.AWS_USE_DYNAMODB !== 'true') {
      if (mongoose.connection.readyState === 1) {
        dbStatus.mongodb = 'connected';
        
        // Get collection stats
        const collections = await mongoose.connection.db.listCollections().toArray();
        dbStatus.collections = collections.length;
      } else {
        dbStatus.mongodb = 'disconnected';
        dbStatus.status = 'warning';
      }
    } else {
      // If using DynamoDB
      const AWS = require('aws-sdk');
      const dynamoDB = new AWS.DynamoDB({
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });
      
      try {
        const tableName = process.env.AWS_DYNAMODB_TABLE || 'karen-ai-conversations';
        const result = await dynamoDB.describeTable({ TableName: tableName }).promise();
        dbStatus.dynamodb = 'connected';
        dbStatus.table = result.Table.TableName;
        dbStatus.itemCount = result.Table.ItemCount;
      } catch (error) {
        dbStatus.dynamodb = 'error';
        dbStatus.error = error.code;
        dbStatus.status = 'error';
      }
    }
    
    res.status(200).json(dbStatus);
  } catch (error) {
    logger.error('Error fetching database health:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch database health information'
    });
  }
});

// Browser automation service health
router.get('/health/browser', async (req, res) => {
  try {
    const browsers = await BrowserAutomationService.getBrowserStatistics();
    res.status(200).json({
      status: 'ok',
      browser: browsers || { status: 'not initialized' }
    });
  } catch (error) {
    logger.error('Error fetching browser automation health:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch browser automation status'
    });
  }
});

// AI service health
router.get('/health/ai', async (req, res) => {
  try {
    const aiStatusResponse = await AiService.getServiceHealth();
    res.status(200).json(aiStatusResponse);
  } catch (error) {
    logger.error('Error fetching AI service health:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch AI service status',
      error: error.message
    });
  }
});

// Log Stats
router.get('/logs/stats', (req, res) => {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const files = fs.readdirSync(logDir);
    
    const logStats = files.map(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      return {
        file,
        size: stats.size,
        modified: stats.mtime
      };
    });
    
    res.status(200).json({
      status: 'ok',
      logs: logStats
    });
  } catch (error) {
    logger.error('Error fetching log stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch log statistics'
    });
  }
});

// Comprehensive status
router.get('/status', async (req, res) => {
  try {
    // System info
    const systemInfo = {
      uptime: Math.floor(process.uptime()),
      memory: {
        free: os.freemem(),
        total: os.totalmem(),
        percentUsed: Math.round((1 - os.freemem() / os.totalmem()) * 100)
      },
      platform: os.platform(),
      nodeVersion: process.version
    };
    
    // Database status
    let dbStatus = {};
    if (process.env.AWS_USE_DYNAMODB === 'true') {
      dbStatus.type = 'dynamodb';
      dbStatus.status = 'connected'; // Simplified for now
    } else {
      dbStatus.type = 'mongodb';
      dbStatus.status = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    }
    
    // Automation status
    const automationStatus = BrowserAutomationService.browser ? 'active' : 'inactive';
    
    // AI service status
    const aiStatus = !AiService.useMockMode ? 'active' : 'mock_mode';
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: systemInfo,
      database: dbStatus,
      automation: automationStatus,
      ai: aiStatus,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Error fetching comprehensive status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system status'
    });
  }
});

module.exports = router; 