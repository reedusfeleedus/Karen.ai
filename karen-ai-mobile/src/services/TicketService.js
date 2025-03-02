import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

// Define ticket status constants
export const TICKET_STATUS = {
  CONTACTED: 1,
  IN_PROGRESS: 2,
  ACCEPTED: 3,
  COMPLETED: 4
};

// Helper function for safe UUID generation with fallback
function generateId() {
  try {
    return uuidv4();
  } catch (error) {
    console.warn('UUID generation failed, using fallback ID mechanism');
    return `ticket-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
}

// Define ticket model structure
export class Ticket {
  constructor({
    id = generateId(),
    title = '',
    subtitle = '',
    status = 'inProgress',
    progress = 0,
    icon = 'ticket-outline',
    company = '',
    currentStep = TICKET_STATUS.IN_PROGRESS,
    dateCreated = new Date().toISOString(),
    dateUpdated = new Date().toISOString(),
    summary = [],
    actions = [],
    chatHistory = []
  } = {}) {
    this.id = id;
    this.title = title;
    this.subtitle = subtitle;
    this.status = status;
    this.progress = progress;
    this.icon = icon;
    this.company = company;
    this.currentStep = currentStep;
    this.dateCreated = dateCreated;
    this.dateUpdated = dateUpdated;
    this.summary = summary;
    this.actions = actions;
    this.chatHistory = chatHistory; // Store chat messages for this ticket
  }
}

class TicketService {
  constructor() {
    this.STORAGE_KEY = '@karen_tickets';
    this.listeners = [];
    this.tickets = [];
    this.loaded = false;
  }

  // Add a change listener
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Notify listeners of changes
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.tickets));
  }

  // Load tickets from storage
  async loadTickets(forceReload = false) {
    if (this.loaded && !forceReload) {
      return this.tickets;
    }

    try {
      console.log('Loading tickets from storage');
      const storedTickets = await AsyncStorage.getItem(this.STORAGE_KEY);
      
      if (storedTickets) {
        console.log('Found stored tickets');
        this.tickets = JSON.parse(storedTickets);
        
        // Make sure tickets are properly sorted by date (newest first)
        this.tickets.sort((a, b) => new Date(b.dateUpdated) - new Date(a.dateUpdated));
        console.log(`Loaded ${this.tickets.length} tickets from storage`);
      } else {
        console.log('No stored tickets found, seeding with demo data');
        // If no tickets found, seed with demo data
        await this.seedDemoTickets();
      }
      
      this.loaded = true;
      this.notifyListeners();
      return this.tickets;
    } catch (error) {
      console.error('Error loading tickets:', error);
      // Fallback to demo tickets if there's an error
      if (!this.tickets.length) {
        this.tickets = this.getDemoTickets();
      }
      return this.tickets;
    }
  }

  // Save tickets to storage
  async saveTickets() {
    try {
      console.log('Saving tickets to storage:', this.tickets.length);
      
      // Make sure all tickets have proper timestamps
      this.tickets.forEach(ticket => {
        if (!ticket.dateUpdated) {
          ticket.dateUpdated = new Date().toISOString();
        }
        if (!ticket.dateCreated) {
          ticket.dateCreated = ticket.dateUpdated;
        }
      });
      
      // Verify we have valid data before saving
      if (!Array.isArray(this.tickets)) {
        console.error('Cannot save tickets: tickets is not an array');
        return false;
      }
      
      // Save to AsyncStorage and handle errors properly
      try {
        const ticketsJson = JSON.stringify(this.tickets);
        await AsyncStorage.setItem(this.STORAGE_KEY, ticketsJson);
        console.log(`Saved ${this.tickets.length} tickets to AsyncStorage, size: ${ticketsJson.length} bytes`);
        this.notifyListeners();
        return true;
      } catch (storageError) {
        console.error('AsyncStorage save error:', storageError);
        return false;
      }
    } catch (error) {
      console.error('Error preparing tickets for save:', error);
      return false;
    }
  }

  // Get all tickets (loads if not loaded)
  async getAll() {
    if (!this.loaded) {
      await this.loadTickets();
    }
    console.log('Getting all tickets:', this.tickets.length);
    return this.tickets;
  }

  // Get tickets by status
  async getByStatus(status) {
    const allTickets = await this.getAll();
    return allTickets.filter(ticket => ticket.status === status);
  }

  // Get a single ticket by ID
  async getById(id) {
    if (!id) {
      console.error('getById called with invalid id:', id);
      return null;
    }
    
    console.log('Getting ticket by ID:', id);
    
    // Ensure tickets are loaded
    if (!this.loaded) {
      await this.loadTickets();
    }
    
    // Convert ID to string for comparison if needed
    const searchId = String(id);
    
    const ticket = this.tickets.find(t => String(t.id) === searchId);
    console.log('Found ticket:', ticket ? 'yes' : 'no');
    return ticket || null;
  }

  // Add a ticket to the store
  async addTicket(ticketData) {
    try {
      console.log('Adding ticket with data:', ticketData?.title);
      
      // Ensure we have valid data by setting defaults for missing properties
      const safeTicketData = {
        id: ticketData?.id || generateId(),
        title: ticketData?.title || 'New Ticket',
        subtitle: ticketData?.subtitle || 'Created from app',
        status: ticketData?.status || 'inProgress',
        progress: ticketData?.progress || 0,
        icon: ticketData?.icon || 'ticket-outline',
        company: ticketData?.company || '',
        currentStep: ticketData?.currentStep || TICKET_STATUS.IN_PROGRESS,
        dateCreated: ticketData?.dateCreated || new Date().toISOString(),
        dateUpdated: ticketData?.dateUpdated || new Date().toISOString(),
        summary: ticketData?.summary || [{ id: '1', text: 'New ticket created', isActive: true }],
        actions: ticketData?.actions || [{ id: '1', text: 'Ticket created', timestamp: new Date().toISOString() }],
        chatHistory: ticketData?.chatHistory || []
      };
      
      // Create the ticket instance
      const ticket = new Ticket(safeTicketData);
      
      // Ensure tickets are loaded
      if (!this.loaded) {
        await this.loadTickets();
      }
      
      // Add to front of tickets array (newest first)
      this.tickets = [ticket, ...this.tickets];
      
      // Save to storage
      try {
        await this.saveTickets();
        this.notifyListeners();
        console.log('Ticket added successfully with ID:', ticket.id);
        return ticket;
      } catch (storageError) {
        console.error('Error saving ticket to storage:', storageError);
        // Even if storage fails, we've added it to in-memory array
        this.notifyListeners();
        return ticket;
      }
    } catch (error) {
      console.error('Error in addTicket:', error);
      
      // Last-resort fallback - create an emergency ticket with minimal data
      try {
        const emergencyTicket = new Ticket({
          id: `emergency-${Date.now()}`,
          title: ticketData?.title || 'Emergency Ticket',
          subtitle: 'Created during error recovery',
          status: 'inProgress',
          progress: 10,
          icon: 'alert-circle',
          dateCreated: new Date().toISOString(),
          dateUpdated: new Date().toISOString(),
          chatHistory: []
        });
        
        this.tickets = [emergencyTicket, ...this.tickets];
        this.saveTickets().catch(e => console.error('Failed to save emergency ticket:', e));
        this.notifyListeners();
        
        return emergencyTicket;
      } catch (fallbackError) {
        console.error('Fatal error in ticket creation:', fallbackError);
        return null;
      }
    }
  }

  // Enhanced ticket creation from chat
  async createTicketFromChat(title, details, extractedInfo = null) {
    console.log('Creating ticket from chat with title:', title);
    console.log('Extracted info available:', !!extractedInfo);
    
    // Build the ticket object with extracted info if available
    const newTicket = {
      id: generateId(), // Use our safe ID generator
      title: title || 'New Support Request',
      subtitle: details || 'Created from chat',
      status: 'inProgress',
      progress: 10,
      icon: extractedInfo?.icon || 'chat',
      company: extractedInfo?.company || '',
      currentStep: TICKET_STATUS.CONTACTED,
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      summary: [
        { id: '1', text: 'Support request initiated via chat', isActive: true },
        { id: '2', text: 'Collecting issue details', isActive: true }
      ],
      actions: [
        { id: '1', text: 'Created support ticket from chat conversation', timestamp: new Date().toISOString() }
      ],
      chatHistory: []
    };
    
    // If we have extracted info, add more detailed summary and actions
    if (extractedInfo) {
      // Add issue type to subtitle if available
      if (extractedInfo.issueType) {
        newTicket.subtitle = extractedInfo.issueType;
      }
      
      // Add more detailed summary items based on the extracted info
      if (extractedInfo.details) {
        newTicket.summary.push({ 
          id: '3', 
          text: `Issue details: ${extractedInfo.details}`, 
          isActive: true 
        });
      }
      
      if (extractedInfo.product) {
        newTicket.summary.push({ 
          id: '4', 
          text: `Related to: ${extractedInfo.product}`, 
          isActive: true 
        });
      }
      
      // Add appropriate icon if company is recognized
      if (extractedInfo.company) {
        // Add company-specific information
        newTicket.actions.push({ 
          id: '2', 
          text: `Identified issue with ${extractedInfo.company}`, 
          timestamp: new Date().toISOString() 
        });
        
        // Adjust progress based on information completeness
        let infoCompleteness = 0;
        if (extractedInfo.company) infoCompleteness += 1;
        if (extractedInfo.product) infoCompleteness += 1;
        if (extractedInfo.details) infoCompleteness += 1;
        if (extractedInfo.priority) infoCompleteness += 1;
        
        // Set progress based on how much info we have (baseline 10 + up to 15 more)
        newTicket.progress = Math.min(25, 10 + (infoCompleteness * 3.75));
      }
    }
    
    // Actually add the ticket to the store
    try {
      const ticket = await this.addTicket(newTicket);
      console.log('Successfully created and saved ticket with ID:', ticket.id);
      return ticket;
    } catch (error) {
      console.error('Error saving ticket:', error);
      throw error;
    }
  }

  // Update an existing ticket
  async updateTicket(id, updates) {
    // Load tickets if not loaded
    if (!this.loaded) {
      await this.loadTickets();
    }
    
    // Convert ID to string for comparison if needed
    const searchId = String(id);
    
    const ticketIndex = this.tickets.findIndex(ticket => String(ticket.id) === searchId);
    
    if (ticketIndex !== -1) {
      const updatedTicket = {
        ...this.tickets[ticketIndex],
        ...updates,
        dateUpdated: new Date().toISOString()
      };
      
      this.tickets[ticketIndex] = updatedTicket;
      await this.saveTickets();
      return updatedTicket;
    }
    
    return null;
  }

  // Delete a ticket
  async deleteTicket(id) {
    // Load tickets if not loaded
    if (!this.loaded) {
      await this.loadTickets();
    }
    
    // Convert ID to string for comparison if needed
    const searchId = String(id);
    
    const initialLength = this.tickets.length;
    this.tickets = this.tickets.filter(ticket => String(ticket.id) !== searchId);
    
    if (this.tickets.length !== initialLength) {
      await this.saveTickets();
      return true;
    }
    
    return false;
  }

  // Add an action to a ticket
  async addAction(ticketId, actionText) {
    if (!actionText) return null;
    
    try {
      // Find the ticket
      const ticket = await this.getById(ticketId);
      if (!ticket) return null;
      
      // Create new action
      const newAction = {
        id: generateId(),
        text: actionText,
        timestamp: new Date().toISOString()
      };
      
      // Add to ticket actions
      ticket.actions = [...(ticket.actions || []), newAction];
      ticket.dateUpdated = new Date().toISOString();
      
      // Save and notify
      await this.saveTickets();
      this.notifyListeners();
      
      return newAction;
    } catch (error) {
      console.error('Error adding action:', error);
      return null;
    }
  }

  // Update ticket progress
  async updateProgress(ticketId, progress) {
    return this.updateTicket(ticketId, { progress });
  }

  // Update ticket step
  async updateStep(ticketId, step) {
    return this.updateTicket(ticketId, { currentStep: step });
  }

  // Mark ticket as completed
  async completeTicket(ticketId) {
    return this.updateTicket(ticketId, {
      status: 'finished',
      progress: 100,
      currentStep: TICKET_STATUS.COMPLETED
    });
  }

  // Reset all data (for testing)
  async resetAllData() {
    try {
      console.log('Resetting all ticket data');
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      this.tickets = [];
      this.loaded = false;
      this.notifyListeners();
      
      // Re-seed with demo tickets
      return this.seedDemoTickets();
    } catch (error) {
      console.error('Error resetting ticket data:', error);
      return false;
    }
  }

  // Force reload tickets from storage
  async forceReload() {
    return this.loadTickets(true);
  }

  // Move a ticket to the top of the list
  async moveToTop(ticketId) {
    // Load tickets if not loaded
    if (!this.loaded) {
      await this.loadTickets();
    }
    
    // Convert ID to string for comparison if needed
    const searchId = String(ticketId);
    
    const ticketIndex = this.tickets.findIndex(ticket => String(ticket.id) === searchId);
    
    if (ticketIndex !== -1) {
      // Remove the ticket from its current position
      const ticket = this.tickets.splice(ticketIndex, 1)[0];
      
      // Update the date updated
      ticket.dateUpdated = new Date().toISOString();
      
      // Add it to the top of the list
      this.tickets.unshift(ticket);
      
      await this.saveTickets();
      return ticket;
    }
    
    return null;
  }

  // Get demo tickets
  getDemoTickets() {
    return [
      // One currently processing ticket
      new Ticket({
        id: '1',
        title: 'Amazon',
        subtitle: 'Refund for Black Cap',
        status: 'inProgress',
        progress: 65,
        icon: 'shopping',
        company: 'Amazon',
        currentStep: TICKET_STATUS.ACCEPTED,
        summary: [
          { id: '1', text: 'Purchase identified: Black Cap on 02/15/2025', isActive: true },
          { id: '2', text: 'Reason for refund: Item doesn\'t fit properly', isActive: true },
          { id: '3', text: 'Amazon contacted for return authorization', isActive: true },
          { id: '4', text: 'Return label created and emailed', isActive: false }
        ],
        actions: [
          { id: '1', text: 'Retrieved order information from Amazon account', timestamp: '2025-02-16T14:25:00Z' },
          { id: '2', text: 'Contacted Amazon customer service about the issue', timestamp: '2025-02-16T14:32:00Z' },
          { id: '3', text: 'Submitted refund request with reason: wrong size', timestamp: '2025-02-16T14:40:00Z' }
        ],
        chatHistory: []
      }),
      
      // Three recent in-progress tasks
      new Ticket({
        id: '2',
        title: 'Lebarra',
        subtitle: '10 Euro Refund',
        status: 'inProgress',
        progress: 30,
        icon: 'phone',
        company: 'Lebarra',
        currentStep: TICKET_STATUS.IN_PROGRESS,
        summary: [
          { id: '1', text: 'Billing discrepancy identified on recent invoice', isActive: true },
          { id: '2', text: 'Collected invoice details for reference', isActive: true },
          { id: '3', text: 'Issue reported to Lebarra support', isActive: false }
        ],
        actions: [
          { id: '1', text: 'Reviewed billing statement to identify the overcharge', timestamp: '2025-02-14T12:15:00Z' },
          { id: '2', text: 'Verified correct rate with customer\'s plan details', timestamp: '2025-02-14T12:22:00Z' }
        ],
        chatHistory: []
      }),
      new Ticket({
        id: '3',
        title: 'Netflix',
        subtitle: 'Account Unauthorized Access',
        status: 'inProgress',
        progress: 45,
        icon: 'movie',
        company: 'Netflix',
        currentStep: TICKET_STATUS.IN_PROGRESS,
        summary: [
          { id: '1', text: 'Suspicious login detected from unknown location', isActive: true },
          { id: '2', text: 'Account temporarily secured with password change', isActive: true },
          { id: '3', text: 'Case opened with Netflix security team', isActive: false }
        ],
        actions: [
          { id: '1', text: 'Identified unauthorized login from an IP in Brazil', timestamp: '2025-02-15T22:15:00Z' },
          { id: '2', text: 'Changed account password and enabled 2FA', timestamp: '2025-02-15T22:25:00Z' }
        ],
        chatHistory: []
      }),
      new Ticket({
        id: '4',
        title: 'Uber',
        subtitle: 'Driver Dispute',
        status: 'inProgress',
        progress: 20,
        icon: 'car',
        company: 'Uber',
        currentStep: TICKET_STATUS.CONTACTED,
        summary: [
          { id: '1', text: 'Complaint filed about incorrect route taken', isActive: true },
          { id: '2', text: 'Trip details submitted to Uber support', isActive: false }
        ],
        actions: [
          { id: '1', text: 'Recorded trip details and route discrepancy', timestamp: '2025-02-17T09:05:00Z' }
        ],
        chatHistory: []
      }),
      
      // Seven finished tickets
      new Ticket({
        id: '5',
        title: 'Amazon',
        subtitle: 'Late Delivery Compensation',
        status: 'finished',
        progress: 100,
        icon: 'shopping',
        company: 'Amazon',
        currentStep: TICKET_STATUS.COMPLETED,
        summary: [
          { id: '1', text: 'Package guaranteed delivery date missed by 3 days', isActive: true },
          { id: '2', text: 'Contacted Amazon about delivery guarantee', isActive: true },
          { id: '3', text: '$10 credit applied to account as compensation', isActive: true },
          { id: '4', text: 'Case resolved with customer satisfaction', isActive: true }
        ],
        actions: [
          { id: '1', text: 'Identified delivery guarantee terms in order confirmation', timestamp: '2025-01-25T16:15:00Z' },
          { id: '2', text: 'Contacted Amazon customer service with delivery complaint', timestamp: '2025-01-25T16:30:00Z' },
          { id: '3', text: 'Negotiated compensation for the delay', timestamp: '2025-01-25T16:45:00Z' },
          { id: '4', text: 'Confirmed $10 credit added to customer account', timestamp: '2025-01-25T17:00:00Z' }
        ],
        chatHistory: []
      }),
      new Ticket({
        id: '6',
        title: 'Spotify',
        subtitle: 'Account Upgrade Refund',
        status: 'finished',
        progress: 100,
        icon: 'music',
        company: 'Spotify',
        currentStep: TICKET_STATUS.COMPLETED,
        summary: [
          { id: '1', text: 'Accidental premium upgrade processed', isActive: true },
          { id: '2', text: 'Refund request submitted within 24 hours', isActive: true },
          { id: '3', text: 'Full refund processed to original payment method', isActive: true }
        ],
        chatHistory: []
      }),
      new Ticket({
        id: '7',
        title: 'Apple',
        subtitle: 'App Store Purchase Dispute',
        status: 'finished',
        progress: 100,
        icon: 'apple',
        company: 'Apple',
        currentStep: TICKET_STATUS.COMPLETED,
        chatHistory: []
      }),
      new Ticket({
        id: '8',
        title: 'DoorDash',
        subtitle: 'Missing Items Refund',
        status: 'finished',
        progress: 100,
        icon: 'food',
        company: 'DoorDash',
        currentStep: TICKET_STATUS.COMPLETED,
        chatHistory: []
      }),
      new Ticket({
        id: '9',
        title: 'AT&T',
        subtitle: 'Service Outage Credit',
        status: 'finished',
        progress: 100,
        icon: 'wifi',
        company: 'AT&T',
        currentStep: TICKET_STATUS.COMPLETED,
        chatHistory: []
      }),
      new Ticket({
        id: '10',
        title: 'Hotels.com',
        subtitle: 'Booking Cancellation Fee',
        status: 'finished',
        progress: 100,
        icon: 'bed',
        company: 'Hotels.com',
        currentStep: TICKET_STATUS.COMPLETED,
        chatHistory: []
      }),
      new Ticket({
        id: '11',
        title: 'Adobe',
        subtitle: 'Subscription Cancellation',
        status: 'finished',
        progress: 100,
        icon: 'file-document',
        company: 'Adobe',
        currentStep: TICKET_STATUS.COMPLETED,
        chatHistory: []
      })
    ];
  }

  // Seed with demo tickets
  async seedDemoTickets() {
    console.log('Seeding storage with demo tickets');
    this.tickets = this.getDemoTickets();
    
    // Set lastUpdated timestamps based on creation order
    // This ensures demo tickets appear in a sensible order
    const now = new Date();
    this.tickets.forEach((ticket, index) => {
      // Stagger creation dates for demo tickets
      const timeOffset = index * 24 * 60 * 60 * 1000; // One day apart
      const date = new Date(now.getTime() - timeOffset);
      ticket.dateCreated = date.toISOString();
      ticket.dateUpdated = date.toISOString();
    });
    
    await this.saveTickets();
    console.log(`Saved ${this.tickets.length} demo tickets to storage`);
    return this.tickets;
  }

  // Add chat message to a ticket
  async addChatMessage(ticketId, messageData) {
    try {
      // Find the ticket
      const ticket = await this.getById(ticketId);
      if (!ticket) return false;
      
      // Initialize chatHistory if it doesn't exist
      if (!ticket.chatHistory) {
        ticket.chatHistory = [];
      }
      
      // Add the message to chat history
      ticket.chatHistory.push(messageData);
      ticket.dateUpdated = new Date().toISOString();
      
      // Save changes
      await this.saveTickets();
      return true;
    } catch (error) {
      console.error('Error adding chat message:', error);
      return false;
    }
  }
  
  // Get chat history for a ticket
  async getChatHistory(ticketId) {
    try {
      const ticket = await this.getById(ticketId);
      if (!ticket) return [];
      
      return ticket.chatHistory || [];
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }
  
  // Save the entire chat history for a ticket
  async saveChatHistory(ticketId, messages) {
    try {
      const ticket = await this.getById(ticketId);
      if (!ticket) return false;
      
      ticket.chatHistory = messages;
      ticket.dateUpdated = new Date().toISOString();
      
      await this.saveTickets();
      return true;
    } catch (error) {
      console.error('Error saving chat history:', error);
      return false;
    }
  }
}

// Create a singleton instance
const ticketServiceInstance = new TicketService();

// Export the singleton
export default ticketServiceInstance; 