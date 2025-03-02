# Karen AI - Customer Service Automation

An AI-powered customer service automation platform that handles customer interactions across different platforms using LLMs and browser automation.

## Project Structure

This repository contains two main components:

### 1. Mobile App (`karen-ai-mobile/`)
- React Native / Expo mobile application
- Features:
  - Chat interface for customer interactions
  - Document upload capabilities
  - Real-time status updates
  - Settings management

### 2. Backend Server (`karen-ai-backend/`)
- Node.js/Express backend
- Features:
  - RESTful API endpoints
  - Socket.IO for real-time communication
  - MongoDB Atlas integration
  - LLM integration (OpenAI/Anthropic)

## Getting Started

### Mobile App Setup
```bash
cd karen-ai-mobile
npm install
npx expo start
```

### Backend Setup
```bash
cd karen-ai-backend
npm install
# Create .env file with required environment variables
npm run dev
```

See individual README files in each directory for detailed setup instructions.

## Development Status

Current MVP development phase includes:
- Basic chat interface
- Document upload functionality
- Real-time status updates
- MongoDB integration
- LLM integration

## License

MIT 