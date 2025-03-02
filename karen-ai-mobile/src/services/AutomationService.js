// import config from '../config/config'; 
import { Alert } from 'react-native';

class AutomationService {
  constructor() {
    // Use hardcoded API URL instead of config
    this.apiBaseUrl = 'http://localhost:3000/api';
    this.activeSession = null;
    this.lastScreenshot = null;
  }

  /**
   * Start a new Paddy Power automation session
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - Session information
   */
  async startPaddyPowerSession(userId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/automation/paddypower/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to start automation session');
      }
      
      this.activeSession = {
        sessionId: data.sessionId,
        type: 'paddypower',
        startTime: new Date(),
      };
      
      if (data.screenshotUrl) {
        this.lastScreenshot = `${this.apiBaseUrl}${data.screenshotUrl}`;
      }
      
      return {
        success: true,
        sessionId: data.sessionId,
        message: data.message,
        screenshotUrl: this.lastScreenshot,
      };
    } catch (error) {
      console.error('Error starting Paddy Power session:', error);
      Alert.alert('Automation Error', `Could not start automation: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle a customer service issue through automation
   * @param {Object} issueDetails - Details about the customer issue
   * @returns {Promise<Object>} - Result of the automation
   */
  async handleCustomerIssue(issueDetails) {
    if (!this.activeSession) {
      await this.startPaddyPowerSession();
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/automation/paddypower/handle-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.activeSession.sessionId,
          issueDetails,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to handle issue');
      }
      
      if (data.screenshotUrl) {
        this.lastScreenshot = `${this.apiBaseUrl}${data.screenshotUrl}`;
      }
      
      return {
        success: true,
        action: data.action,
        message: data.message,
        results: data.results,
        screenshotUrl: this.lastScreenshot,
      };
    } catch (error) {
      console.error('Error handling customer issue:', error);
      Alert.alert('Automation Error', `Problem handling your issue: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search for information in the Paddy Power help center
   * @param {string} query - The search query
   * @returns {Promise<Object>} - Search results
   */
  async searchHelpCenter(query) {
    if (!this.activeSession) {
      await this.startPaddyPowerSession();
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/automation/paddypower/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.activeSession.sessionId,
          query,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to search help center');
      }
      
      if (data.screenshotUrl) {
        this.lastScreenshot = `${this.apiBaseUrl}${data.screenshotUrl}`;
      }
      
      return {
        success: true,
        results: data.results,
        message: data.message,
        screenshotUrl: this.lastScreenshot,
      };
    } catch (error) {
      console.error('Error searching help center:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * End the active automation session
   * @returns {Promise<Object>} - Result of ending the session
   */
  async endSession() {
    if (!this.activeSession) {
      return { success: true, message: 'No active session to end' };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/automation/paddypower/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.activeSession.sessionId,
        }),
      });

      const data = await response.json();
      
      // Reset session state regardless of result
      this.activeSession = null;
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to end session');
      }
      
      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('Error ending automation session:', error);
      // Still reset session state
      this.activeSession = null;
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get the currently active session
   * @returns {Object|null} - Active session information or null
   */
  getActiveSession() {
    return this.activeSession;
  }

  /**
   * Get the URL of the last screenshot taken
   * @returns {string|null} - URL of the last screenshot or null
   */
  getLastScreenshot() {
    return this.lastScreenshot;
  }
}

export default new AutomationService(); 