require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI || process.env.AWS_DOCDB_URI || 'mongodb://localhost:27017/karen-ai',
  environment: process.env.NODE_ENV || 'development',
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bedrockModel: process.env.AWS_BEDROCK_MODEL || 'amazon.titan-text-express-v1',
    useDynamoDB: process.env.AWS_USE_DYNAMODB === 'true',
    dynamoDBTable: process.env.AWS_DYNAMODB_TABLE || 'karen-ai-conversations',
    docdb: {
      uri: process.env.AWS_DOCDB_URI,
      sslCAPath: process.env.AWS_DOCDB_SSL_CA_PATH
    }
  },
  playgroundUrl: process.env.PLAYGROUND_URL || 'http://localhost:3001',
  websiteDetectionPatterns: {
    amazon: ['amazon.com', 'amazon.'],
    paypal: ['paypal.com', 'paypal.'],
    uber: ['uber.com', 'ubereats.com'],
    airbnb: ['airbnb.com'],
    spotify: ['spotify.com']
  }
}; 