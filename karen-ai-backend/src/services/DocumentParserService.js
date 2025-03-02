const AiService = require('./AiService');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

class DocumentParserService {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async saveDocument(file, userId, conversationId) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = path.extname(file.originalname);
      const filename = `${userId}_${timestamp}${fileExtension}`;
      const filepath = path.join(this.uploadsDir, filename);
      
      // Create a write stream to save the file
      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(filepath);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        
        if (file.buffer) {
          // If we have a buffer (e.g., from multer memory storage)
          writeStream.write(file.buffer);
          writeStream.end();
        } else if (file.path) {
          // If we have a path (e.g., from multer disk storage)
          const readStream = fs.createReadStream(file.path);
          readStream.pipe(writeStream);
        } else {
          reject(new Error('Invalid file format'));
        }
      });
      
      logger.info(`Document saved: ${filepath}`);
      
      // Return document metadata
      return {
        id: filename,
        originalName: file.originalname,
        path: filepath,
        mimetype: file.mimetype,
        size: file.size,
        uploadTime: new Date().toISOString(),
        userId,
        conversationId
      };
    } catch (error) {
      logger.error(`Error saving document:`, error);
      throw new Error(`Document save failed: ${error.message}`);
    }
  }

  async extractTextFromImage(imagePath) {
    // For demonstration purposes, we'll use a mock OCR implementation.
    // In a real application, you would integrate with Google Cloud Vision, 
    // AWS Textract, or another OCR service.
    
    logger.info(`Extracting text from image: ${imagePath}`);
    
    // Mock OCR implementation - in a real app, integrate with OCR service
    return new Promise((resolve) => {
      setTimeout(() => {
        // Return mock text based on filename patterns
        const filename = path.basename(imagePath).toLowerCase();
        
        if (filename.includes('receipt') || filename.includes('invoice')) {
          resolve(`RECEIPT #12345
Date: 2023-05-15
Amount: $125.99
Order ID: ORD-987654
Customer: John Doe
Payment Method: Credit Card
Items: 
1. Product A - $49.99
2. Product B - $75.00
Tax: $11.00
Total: $125.99`);
        } else if (filename.includes('order') || filename.includes('confirmation')) {
          resolve(`ORDER CONFIRMATION
Order Number: A12345678
Date: March 15, 2023
Shipped to: Jane Smith
123 Main Street
Anytown, CA 12345
Items:
- 1x Widget Pro ($59.99)
- 2x Accessory Pack ($19.99 each)
Subtotal: $99.97
Shipping: $4.99
Tax: $8.75
Total: $113.71`);
        } else {
          resolve(`Document text extracted.
This appears to be a general document with some information.
Reference Number: REF-123456
Date: January 10, 2023
Contact: support@example.com
Please reference the above information in communications.`);
        }
      }, 1000); // Simulate processing time
    });
  }

  async parseDocument(document) {
    try {
      const filePath = document.path;
      let documentText = '';
      
      // Extract text based on document type
      if (document.mimetype.startsWith('image/')) {
        documentText = await this.extractTextFromImage(filePath);
      } else if (document.mimetype === 'application/pdf') {
        // For demo purposes, we'll use a mock implementation
        documentText = `PDF DOCUMENT
Order #: 987654321
Date: 2023-06-20
Amount: $245.50
Customer: ${document.userId}
Status: Processing`;
      } else if (document.mimetype.includes('text')) {
        // Read text file
        documentText = fs.readFileSync(filePath, 'utf8');
      } else {
        return {
          error: 'Unsupported document type',
          supported: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain']
        };
      }
      
      // Use AI to extract structured information
      const extractionPrompt = `
        Extract key information from this document as JSON:
        ${documentText}
        
        Look for and include if present:
        - Any order numbers or reference numbers
        - Dates
        - Monetary amounts
        - Customer names
        - Email addresses
        - Product descriptions
        - Status information
        
        Format as a clean JSON object with appropriate keys.
      `;
      
      const aiResponse = await AiService.generateResponse([{
        role: 'user',
        content: extractionPrompt
      }]);
      
      // Try to parse structured data
      try {
        const structuredData = JSON.parse(aiResponse);
        logger.info(`Successfully extracted structured data from document: ${document.id}`);
        return {
          rawText: documentText,
          structured: structuredData,
          document: document
        };
      } catch (error) {
        logger.warn(`Failed to parse AI response as JSON: ${error.message}`);
        // Return the raw extraction as a fallback
        return {
          rawText: documentText,
          structured: { text: aiResponse },
          document: document
        };
      }
    } catch (error) {
      logger.error(`Document parsing error:`, error);
      throw new Error(`Document parsing failed: ${error.message}`);
    }
  }

  async extractEntities(text) {
    try {
      // Use AI to extract named entities
      const entityPrompt = `
        Extract named entities from this text as JSON:
        ${text}
        
        Identify and categorize:
        - PERSON: Names of people
        - ORG: Organizations, companies, institutions
        - DATE: Dates or time references
        - MONEY: Monetary values
        - PRODUCT: Product names or descriptions
        - NUMBER: Any important numbers (order numbers, reference numbers)
        - EMAIL: Email addresses
        - PHONE: Phone numbers
        
        Format as a JSON object where keys are entity types and values are arrays of extracted items.
      `;
      
      const aiResponse = await AiService.generateResponse([{
        role: 'user',
        content: entityPrompt
      }]);
      
      // Try to parse the entity extraction result
      try {
        const entities = JSON.parse(aiResponse);
        logger.info(`Successfully extracted entities from text`);
        return entities;
      } catch (error) {
        logger.warn(`Failed to parse entity extraction as JSON: ${error.message}`);
        return { error: 'Entity extraction failed', raw: aiResponse };
      }
    } catch (error) {
      logger.error(`Entity extraction error:`, error);
      throw new Error(`Entity extraction failed: ${error.message}`);
    }
  }
}

module.exports = new DocumentParserService(); 