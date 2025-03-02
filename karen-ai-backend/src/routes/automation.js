const express = require('express');
const router = express.Router();
const PaddyPowerAdapter = require('../adapters/PaddyPowerAdapter');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Store active sessions
const activeSessions = new Map();

/**
 * Start a new automation session with Paddy Power
 */
router.post('/paddypower/start', async (req, res) => {
  try {
    const userId = req.body.userId || `user-${uuidv4()}`;
    const sessionId = uuidv4();
    
    logger.info(`Starting Paddy Power automation session for user ${userId}`);
    
    // Initialize the adapter
    const initResult = await PaddyPowerAdapter.initialize(sessionId);
    
    // Store session info
    activeSessions.set(sessionId, {
      userId,
      startTime: new Date(),
      adapter: 'paddypower',
      status: 'active'
    });
    
    return res.status(200).json({
      success: true,
      sessionId,
      message: 'Paddy Power automation session started',
      screenshotUrl: initResult.screenshot ? `/data/screenshots/${initResult.screenshot.split('/').pop()}` : null
    });
  } catch (error) {
    logger.error('Failed to start Paddy Power automation session:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to start automation session'
    });
  }
});

/**
 * Handle a customer issue through automation
 */
router.post('/paddypower/handle-issue', async (req, res) => {
  try {
    const { sessionId, issueDetails } = req.body;
    
    if (!sessionId || !activeSessions.has(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID',
        message: 'Please start a new automation session'
      });
    }
    
    if (!issueDetails) {
      return res.status(400).json({
        success: false,
        error: 'No issue details provided',
        message: 'Please provide issue details'
      });
    }
    
    logger.info(`Handling customer issue for session ${sessionId}:`, issueDetails);
    
    const result = await PaddyPowerAdapter.handleCustomerIssue(issueDetails);
    
    // Format screenshot URLs if present
    if (result.screenshot) {
      result.screenshotUrl = `/data/screenshots/${result.screenshot.split('/').pop()}`;
    }
    if (result.results && result.results.screenshot) {
      result.results.screenshotUrl = `/data/screenshots/${result.results.screenshot.split('/').pop()}`;
    }
    
    return res.status(200).json({
      success: result.success,
      action: result.action,
      message: result.message,
      results: result.results,
      screenshotUrl: result.screenshotUrl || result.results?.screenshotUrl
    });
  } catch (error) {
    logger.error('Error handling customer issue:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to handle customer issue'
    });
  }
});

/**
 * Search for information in Paddy Power help center
 */
router.post('/paddypower/search', async (req, res) => {
  try {
    const { sessionId, query } = req.body;
    
    if (!sessionId || !activeSessions.has(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID',
        message: 'Please start a new automation session'
      });
    }
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'No search query provided',
        message: 'Please provide a search query'
      });
    }
    
    logger.info(`Searching Paddy Power help center for "${query}" in session ${sessionId}`);
    
    const result = await PaddyPowerAdapter.searchForIssue(query);
    
    // Format screenshot URL if present
    if (result.screenshot) {
      result.screenshotUrl = `/data/screenshots/${result.screenshot.split('/').pop()}`;
    }
    
    return res.status(200).json({
      success: result.success,
      results: result.results || [],
      screenshotUrl: result.screenshotUrl || null,
      message: result.success 
        ? `Found ${result.results?.length || 0} results for "${query}"`
        : `Failed to search for "${query}"`
    });
  } catch (error) {
    logger.error('Error searching Paddy Power help center:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to search help center'
    });
  }
});

/**
 * End an automation session
 */
router.post('/paddypower/end', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !activeSessions.has(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID',
        message: 'No active session found with this ID'
      });
    }
    
    logger.info(`Ending Paddy Power automation session ${sessionId}`);
    
    await PaddyPowerAdapter.close();
    activeSessions.delete(sessionId);
    
    return res.status(200).json({
      success: true,
      message: 'Automation session ended successfully'
    });
  } catch (error) {
    logger.error('Error ending automation session:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to end automation session'
    });
  }
});

/**
 * Get active sessions for monitoring
 */
router.get('/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.entries()).map(([id, info]) => ({
    sessionId: id,
    ...info,
    startTime: info.startTime.toISOString(),
    duration: Math.floor((Date.now() - info.startTime) / 1000) // duration in seconds
  }));
  
  return res.status(200).json({
    success: true,
    activeSessions: sessions,
    count: sessions.length
  });
});

module.exports = router; 