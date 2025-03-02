# Karen.ai - AI Customer Service Automation Platform

Karen.ai is an AI-powered customer service automation platform that helps users navigate complex customer service workflows without the hassle of waiting on hold or dealing with chatbots. Karen handles the entire process on your behalf.

## Features

- **AI-Powered Conversations**: Utilizes AWS Bedrock with Claude AI models to understand customer service requests
- **Browser Automation**: Automated website navigation to handle customer service tasks
- **Document Processing**: Upload and analyze receipts, order confirmations, and other documents
- **Real-time Updates**: WebSocket support for live progress updates
- **Multi-platform Support**: Works with major customer service platforms including Amazon, Spotify, PayPal, and more

## Architecture

- **Backend**: Node.js/Express
- **Database**: DynamoDB for data persistence
- **AI**: AWS Bedrock with Anthropic Claude models
- **Automation**: Playwright for browser automation
- **Real-time Communication**: Socket.io

## Getting Started

### Prerequisites

- Node.js (v16+)
- AWS Account with Bedrock access
- DynamoDB table

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/karen-ai-backend.git
cd karen-ai-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit the `.env` file with your AWS credentials and other configuration details.

5. Start the server:
```bash
npm start
```

The server will start on `http://localhost:3000`.

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register a new user
- POST `/api/auth/login` - Login

### Conversations
- POST `/api/message` - Send a message to the AI assistant
- GET `/api/history` - Get conversation history
- POST `/api/end` - End the current conversation

### Documents
- POST `/api/upload` - Upload a document for analysis

## Testing

Run tests with:
```bash
npm test
```

For testing individual components:
```bash
node src/scripts/test-browser.js  # Test browser automation
node src/scripts/test-automation-workflow.js  # Test end-to-end workflow
```

## Deployment

The application can be deployed to AWS using the included deployment script:
```bash
bash scripts/deploy.sh
```

This script handles:
- Setting up the EC2 instance
- Installing dependencies
- Configuring the server
- Setting up PM2 for process management

## Project Structure

- `src/server.js` - Main application entry point
- `src/routes/` - API routes
- `src/services/` - Core business logic
- `src/models/` - Data models
- `src/adapters/` - Database adapters
- `src/utils/` - Utility functions
- `src/scripts/` - Helper scripts
- `logs/` - Application logs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- AWS Bedrock for AI capabilities
- Playwright for browser automation
- MongoDB and DynamoDB for database solutions 