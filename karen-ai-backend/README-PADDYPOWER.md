# Paddy Power Automation Implementation

This README explains how to run the specialized Paddy Power customer service automation that has been implemented in the Karen.ai backend.

## Overview

We've implemented a specific website automation for Paddy Power's help center that can:

1. Navigate to the Paddy Power help center
2. Search for information about common issues
3. Start live chat support (when available)
4. Submit email support requests
5. Automatically decide the best approach for a given customer issue

## Setup and Running

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Playwright dependencies installed (`npx playwright install`)

### Starting the Backend

1. Navigate to the backend directory:
   ```
   cd karen-ai-backend
   ```

2. Install dependencies if you haven't already:
   ```
   npm install
   ```

3. Make sure your .env file is configured with the necessary API keys.

4. Start the backend server:
   ```
   npm start
   ```
   
   The server will start on port 3000 by default.

### Testing the Paddy Power Automation

We've included a test script specifically for the Paddy Power automation:

```
cd karen-ai-backend
node src/scripts/test-paddy-power.js
```

This script will:
1. Start a browser session
2. Navigate to the Paddy Power help center
3. Test searching for information
4. Test handling a simulated customer issue
5. Take screenshots during the process (saved to /data/screenshots)

### Mobile App Integration

The mobile app has been updated to connect to this automation:

1. Make sure the backend server is running
2. Update the mobile app's config file to point to the correct API URL:
   ```
   // In karen-ai-mobile/src/config/config.js
   export default {
     API_BASE_URL: 'http://YOUR_SERVER_IP:3000/api',
     // ...other config
   };
   ```

3. Start the mobile app
4. When chatting about Paddy Power issues, the app will automatically connect to the backend automation

## API Endpoints

The following API endpoints are available for the Paddy Power automation:

- `POST /api/automation/paddypower/start` - Start a new automation session
- `POST /api/automation/paddypower/handle-issue` - Handle a customer issue
- `POST /api/automation/paddypower/search` - Search the help center
- `POST /api/automation/paddypower/end` - End an automation session
- `GET /api/automation/sessions` - Get a list of active sessions

## How It Works

1. The user chats with Karen in the mobile app about a Paddy Power issue
2. Once enough information is gathered, ChatService extracts ticket details
3. If the issue is related to Paddy Power, the automation is started
4. The backend launches a headless browser to navigate the Paddy Power help center
5. Based on the issue details, the appropriate action is taken (search, chat, email)
6. Results and screenshots are sent back to the mobile app

## Common Selectors

The automation uses these key selectors to interact with the Paddy Power website:

- Search box: `#topicText`
- Search button: `.input-group-btn button`
- Search results: `.row.search-result`
- Live chat button: `a.chat-link`
- Email support link: `a[href*="email-form"]`

If the website structure changes, update the selectors in `src/adapters/PaddyPowerAdapter.js`.

## Troubleshooting

- **Browser doesn't start**: Make sure Playwright dependencies are installed with `npx playwright install`
- **Cannot connect to API**: Check that the backend server is running and the API URL is correct
- **Automation fails**: Check the logs for details and verify that the selectors in the adapter match the current website structure
- **Cannot find screenshots**: Screenshots are saved to /data/screenshots in the backend directory 