const AWS = require('aws-sdk');
const logger = require('../utils/logger');
const config = require('../config/config');

class DynamoDBAdapter {
  constructor() {
    this.dynamoDB = new AWS.DynamoDB.DocumentClient({
      region: config.aws.region,
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey
    });
    
    this.tableName = process.env.AWS_DYNAMODB_TABLE || 'karen-ai-conversations';
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Check if table exists
      const dynamoDB = new AWS.DynamoDB({
        region: config.aws.region,
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      });
      
      try {
        await dynamoDB.describeTable({ TableName: this.tableName }).promise();
        logger.info(`DynamoDB table ${this.tableName} exists`);
      } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
          logger.info(`Creating DynamoDB table ${this.tableName}`);
          await dynamoDB.createTable({
            TableName: this.tableName,
            KeySchema: [
              { AttributeName: 'conversationId', KeyType: 'HASH' }
            ],
            AttributeDefinitions: [
              { AttributeName: 'conversationId', AttributeType: 'S' },
              { AttributeName: 'userId', AttributeType: 'S' }
            ],
            GlobalSecondaryIndexes: [
              {
                IndexName: 'UserIdIndex',
                KeySchema: [
                  { AttributeName: 'userId', KeyType: 'HASH' }
                ],
                Projection: {
                  ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                  ReadCapacityUnits: 5,
                  WriteCapacityUnits: 5
                }
              }
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
            }
          }).promise();
          logger.info(`Created DynamoDB table ${this.tableName}`);
        } else {
          throw error;
        }
      }
      
      this.initialized = true;
      logger.info('DynamoDB adapter initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DynamoDB adapter:', error);
      throw error;
    }
  }

  async create(data) {
    await this.init();
    
    try {
      // DynamoDB doesn't like undefined values
      const cleanData = JSON.parse(JSON.stringify(data));
      
      await this.dynamoDB.put({
        TableName: this.tableName,
        Item: cleanData
      }).promise();
      
      logger.info(`Created item in DynamoDB: ${data.conversationId}`);
      return data;
    } catch (error) {
      logger.error(`Failed to create item in DynamoDB: ${error.message}`);
      throw error;
    }
  }

  async findOne(query) {
    await this.init();
    
    try {
      // If querying by conversationId (primary key)
      if (query.conversationId) {
        const result = await this.dynamoDB.get({
          TableName: this.tableName,
          Key: { conversationId: query.conversationId }
        }).promise();
        
        return result.Item || null;
      }
      
      // If querying by userId (using GSI)
      if (query.userId) {
        const result = await this.dynamoDB.query({
          TableName: this.tableName,
          IndexName: 'UserIdIndex',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': query.userId
          },
          Limit: 1
        }).promise();
        
        return result.Items && result.Items.length > 0 ? result.Items[0] : null;
      }
      
      logger.warn('Unsupported query for DynamoDB adapter:', query);
      return null;
    } catch (error) {
      logger.error(`Failed to find item in DynamoDB: ${error.message}`);
      return null;
    }
  }

  async findOneAndUpdate(query, update) {
    await this.init();
    
    try {
      // First get the item
      const item = await this.findOne(query);
      
      if (!item) {
        logger.warn(`Item not found for update: ${JSON.stringify(query)}`);
        return null;
      }
      
      // Merge updates
      const updatedItem = { ...item, ...update };
      
      // Save back to DynamoDB
      await this.dynamoDB.put({
        TableName: this.tableName,
        Item: updatedItem
      }).promise();
      
      logger.info(`Updated item in DynamoDB: ${item.conversationId}`);
      return updatedItem;
    } catch (error) {
      logger.error(`Failed to update item in DynamoDB: ${error.message}`);
      throw error;
    }
  }

  async find(query, options = {}) {
    await this.init();
    
    try {
      let params = {
        TableName: this.tableName
      };
      
      // If querying by userId
      if (query.userId) {
        params = {
          ...params,
          IndexName: 'UserIdIndex',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': query.userId
          }
        };
        
        if (options.limit) {
          params.Limit = options.limit;
        }
        
        const result = await this.dynamoDB.query(params).promise();
        return result.Items || [];
      }
      
      // Fall back to scan (less efficient)
      const result = await this.dynamoDB.scan(params).promise();
      return result.Items || [];
    } catch (error) {
      logger.error(`Failed to find items in DynamoDB: ${error.message}`);
      return [];
    }
  }
}

module.exports = new DynamoDBAdapter(); 