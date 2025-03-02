import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Alert, ScrollView, Button, TextInput, TouchableOpacity, Platform } from 'react-native';
// Comment out GiftedChat temporarily
// import { GiftedChat, Bubble } from 'react-native-gifted-chat';
import { useTheme, Snackbar, Avatar } from 'react-native-paper';
import ChatService from '../services/ChatService';
import TicketService, { TICKET_STATUS } from '../services/TicketService';
import { appTheme } from '../theme/theme';
import TypewriterText from '../components/TypewriterText';

const ChatScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastReceivedMessageId, setLastReceivedMessageId] = useState(null);
  const theme = useTheme();
  const messageListenerRef = useRef(null);
  const connectionListenerRef = useRef(null);
  const errorListenerRef = useRef(null);
  const scrollViewRef = useRef(null);
  const messageTimeoutRef = useRef(null);
  const loadingRef = useRef(false);

  // Initialize welcome message only once
  useEffect(() => {
    if (!isInitialized) {
      setMessages([
        {
          id: 1,
          text: "Hey! I'm Karen 👋 Your personal assistant. How can I help you today?",
          timestamp: new Date().toISOString(),
          isUser: false,
          isWelcome: true,
        }
      ]);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Store messages in a ref to prevent loss during state updates
  const messagesRef = useRef([]);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
    console.log(`Messages state updated, current count: ${messages.length}`);
    
    // After 3 user messages, check if we need to prompt for specific details
    const userMessages = messages.filter(m => m.isUser);
    if (userMessages.length === 3 && messages[messages.length - 1].isUser) {
      // Ensure we have company, issue type, and details by prompting if needed
      ensureRequiredTicketInfo();
    }
  }, [messages]);

  // Function to ensure we have all required ticket information
  const ensureRequiredTicketInfo = () => {
    // Don't ask additional questions if we're already loading/waiting for a response
    if (loading) {
      return;
    }
    
    // Get the full conversation text
    const conversation = messages.map(m => m.text).join(' ');
    
    // Get the last bot message
    const lastBotMessage = [...messages].reverse().find(m => !m.isUser);
    
    // If the last bot message already asks about company or service, don't ask again
    if (lastBotMessage && 
        (lastBotMessage.text.includes('company') || 
         lastBotMessage.text.includes('service') ||
         lastBotMessage.text.includes('business') ||
         lastBotMessage.text.includes('having this issue with'))) {
      console.log('Already asked about company, skipping duplicate question');
      return;
    }
    
    // Check if we're missing essential information
    if (!conversation.toLowerCase().includes('amazon') && 
        !conversation.toLowerCase().includes('netflix') && 
        !conversation.toLowerCase().includes('apple') && 
        !conversation.toLowerCase().includes('google') && 
        !conversation.toLowerCase().includes('facebook') && 
        !conversation.match(/company|business|organization|service/i)) {
      // Ask about company explicitly if not mentioned
      sendSystemMessage("Which company or service is this issue related to?");
    } else if (!conversation.match(/problem|issue|help with|support for/i)) {
      // Ask about the issue type if not clear
      sendSystemMessage("Could you clarify what type of issue you're having? (e.g. refund, account access, billing)");
    }
  };

  // Helper to send a system message
  const sendSystemMessage = (text) => {
    const systemMessage = {
      id: Date.now().toString(),
      text: text,
      timestamp: new Date().toISOString(),
      isUser: false,
    };
    
    setMessages(prevMessages => [...prevMessages, systemMessage]);
  };

  // Debugging effect for ticket creation flag
  useEffect(() => {
    console.log(`ticketCreated flag changed to: ${ticketCreated}`);
  }, [ticketCreated]);

  // Sync loading state with loadingRef
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      // Clean up message timeout
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      
      // Remove listeners
      if (messageListenerRef.current) {
        messageListenerRef.current();
        messageListenerRef.current = null;
      }
      
      if (connectionListenerRef.current) {
        connectionListenerRef.current();
        connectionListenerRef.current = null;
      }
      
      if (errorListenerRef.current) {
        errorListenerRef.current();
        errorListenerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    console.log('ChatScreen mounted');
    
    // Don't reset conversation state here, as it would clear messages needed for ticket creation
    // ChatService.resetConversation(); - We'll reset after ticket creation is complete
    
    // Add navigation options to prevent swipe back
    navigation.setOptions({
      // Disable swipe back to prevent the native-level back navigation that bypasses our JS handler
      gestureEnabled: false,
    });

    // Add listener for when the screen is about to be unfocused but not using beforeRemove
    const backListener = navigation.addListener('beforeRemove', (e) => {
      // Prevent the default navigation behavior so we can handle ticket creation
      e.preventDefault();
      
      // Instead of doing everything in the handler, extract the logic to a separate async function
      handleNavigation(e.data.action);
    });

    // Set up message listener if not already set
    if (!messageListenerRef.current) {
      messageListenerRef.current = ChatService.onMessage((message) => {
        console.log("Received message in ChatScreen:", message);
        
        // Process and add message
        if (message && (message.text || message.error)) {
          // Clear the message timeout since we received a response
          if (messageTimeoutRef.current) {
            clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = null;
          }
          
          // Generate a unique ID for the message
          const messageId = message.id || Date.now().toString();
          
          // Store this ID as the most recently received message
          setLastReceivedMessageId(messageId);
          
          // Add message to state
          setMessages(prevMessages => [
            ...prevMessages, 
            {
              id: messageId,
              text: message.text,
              timestamp: message.timestamp || new Date().toISOString(),
              isUser: false,
              isError: !!message.error
            }
          ]);
          
          console.log('Message added to state:', message.text);
          
          // Reset loading state after processing the message
          setLoading(false);
          
          // Check if the conversation has reached the "automating" state
          if (message.state === 'automating' && !ticketCreated) {
            console.log('Conversation has reached automating state, creating ticket automatically');
            createTicketFromConversation();
          }
          
          // Scroll to bottom when message received
          if (scrollViewRef.current) {
            setTimeout(() => {
              scrollViewRef.current.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      });
    }

    // Set up connection and error listeners
    if (!connectionListenerRef.current) {
      connectionListenerRef.current = ChatService.onConnectionChange((status) => {
        console.log('Connection status changed:', status);
        setConnected(status);
      });
    }

    if (!errorListenerRef.current) {
      errorListenerRef.current = ChatService.onError((errorMsg) => {
        console.error('Error received in ChatScreen:', errorMsg);
        setError(errorMsg);
        setLoading(false); // Make sure loading is reset on error
      });
    }

    // Connect to ChatService if not already connected
    if (!ChatService.isConnected()) {
      console.log('Connecting to ChatService');
      ChatService.connect();
    }
    
    // Create a simple ID generator as fallback when UUID fails
    const generateSimpleId = () => {
      return `ticket-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    };
    
    // Clean up function
    return () => {
      console.log('Cleaning up ChatScreen');
      if (messageListenerRef.current) messageListenerRef.current();
      if (connectionListenerRef.current) connectionListenerRef.current();
      if (errorListenerRef.current) errorListenerRef.current();
      backListener(); // Remove the listener
      
      // Don't disconnect - let the service stay connected in the background
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [navigation, ticketCreated, error]);

  // Handle navigation logically and explicitly outside of the event handler
  const handleNavigation = async (action) => {
    console.log('Handling navigation away from ChatScreen');
    
    // Use messagesRef.current to get the most up-to-date messages
    const currentMessages = messagesRef.current;
    console.log(`Messages count: ${currentMessages.length}, ticketCreated: ${ticketCreated}`);
    
    // Get the user's issue from their messages
    const userMessages = currentMessages.filter(m => m.isUser);
    
    try {
      // Only try to create a ticket if we have user messages and haven't already created one
      if (userMessages.length > 0 && !ticketCreated) {
        setLoading(true);
        console.log('Creating ticket before navigation...');
        
        // Create the ticket with a limited timeout to prevent hanging
        const ticketPromise = createTicketFromConversation(currentMessages);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ticket creation timed out')), 5000)
        );
        
        try {
          await Promise.race([ticketPromise, timeoutPromise]);
        } catch (timeoutError) {
          console.log('Ticket creation timed out, proceeding with navigation');
        }
      } else {
        console.log('No user messages or ticket already created, skipping ticket creation');
      }
    } catch (error) {
      console.error('Error during navigation handling:', error);
    } finally {
      // Always make sure to complete the navigation
      setLoading(false);
      console.log('Navigation handler completed, dispatching action');
      
      // NOW is the safe time to reset the conversation - after ticket creation is complete
      // This ensures the ticket has all necessary info before we clear the state
      console.log('Resetting conversation state after ticket creation');
      ChatService.resetConversation();
      
      navigation.dispatch(action);
    }
  };

  // Make sure the ticketCreated state is properly reset when entering the screen
  useEffect(() => {
    // Reset ticketCreated state when screen is focused
    const onFocus = navigation.addListener('focus', () => {
      console.log('ChatScreen focused, resetting ticketCreated state');
      setTicketCreated(false);
    });
    
    // Cleanup the listener
    return onFocus;
  }, [navigation]);

  const handleRetryConnection = () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    setError(null);
    
    // Force reconnection
    if (!ChatService.isConnected()) {
      ChatService.disconnect();
      setTimeout(() => {
        ChatService.connect();
        setIsRetrying(false);
      }, 500);
    } else {
      setIsRetrying(false);
    }
  };

  const onSend = () => {
    if (inputText.trim() === '') return;
    
    const newMessage = {
      id: Date.now().toString(),
      text: inputText,
      timestamp: new Date().toISOString(),
      isUser: true,
    };
    
    // Add the message to our local state
    setMessages(previousMessages => {
      const updatedMessages = [...previousMessages, newMessage];
      
      // Sync the updated messages with ChatService to ensure it has complete context
      ChatService.syncConversation(updatedMessages);
      
      return updatedMessages;
    });
    
    setText('');
    
    // Set loading state and send message
    setLoading(true);
    loadingRef.current = true;
    
    // Set a safety timeout to clear loading state if no response comes in 20 seconds
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    
    messageTimeoutRef.current = setTimeout(() => {
      if (loadingRef.current) {
        console.log('Message timeout triggered - resetting loading state');
        setLoading(false);
        loadingRef.current = false;
        setMessages(prevMessages => [
          ...prevMessages,
          {
            id: Date.now().toString(),
            text: "I didn't receive a response in time. Please try again or check your connection.",
            timestamp: new Date().toISOString(),
            isUser: false,
            isError: true,
          }
        ]);
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollToEnd({ animated: true });
        }
      }
    }, 20000); // 20 second timeout
    
    // If not connected, try to connect first
    if (!ChatService.isConnected()) {
      ChatService.connect();
    }
    
    // Send the message
    ChatService.sendMessage({
      text: inputText,
      timestamp: new Date().toISOString(),
    });
    
    // Scroll to bottom on send
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Enhanced function to create a ticket from the current conversation
  const createTicketFromConversation = async (messagesSource = null) => {
    try {
      console.log('Starting ticket creation from conversation');
      
      // Prevent multiple tickets from being created
      if (ticketCreated) {
        console.log('Ticket already created, skipping');
        return;
      }
      
      // Use provided messages or current messages state
      const currentMessages = messagesSource || messagesRef.current;
      
      // Get the user's issue from their messages
      const userMessages = currentMessages.filter(m => m.isUser).map(m => m.text);
      console.log(`Found ${userMessages.length} user messages`);
      
      if (userMessages.length === 0) {
        console.log('No user messages found, skipping ticket creation');
        return;
      }
      
      // Show loading indicator
      setLoading(true);
      console.log('Analyzing conversation for ticket creation...');
      
      // Make sure ChatService has the latest conversation
      ChatService.syncConversation(currentMessages);
      
      // Extract ticket information using ChatService's new method
      let extractedInfo = null;
      try {
        extractedInfo = await ChatService.extractTicketInfoFromConversation();
        console.log('Successfully extracted ticket info:', extractedInfo);
      } catch (extractError) {
        console.error('Error extracting ticket info:', extractError);
        // Continue with fallback values if extraction fails
      }
      
      if (!extractedInfo) {
        console.log('No extracted info available, using basic ticket info');
        extractedInfo = {
          company: 'Unknown Company',
          issueType: 'Support request',
          summary: userMessages[0] || 'New support request',
          details: userMessages.join('\n'),
          priority: 'medium',
          icon: 'chat'
        };
      }
      
      // Use company name as the title (keep it short and meaningful)
      const title = extractedInfo?.company || 'Unknown';
      console.log('Using company name as title:', title);
      
      // Use issue type as the subtitle (short descriptor)
      const subtitle = extractedInfo?.issueType || 'Support request';
      console.log('Using issue type as subtitle:', subtitle);
      
      // Create the ticket with extracted information
      console.log('Creating ticket with TicketService...');
      
      try {
        // Add a timeout to the ticket creation to avoid hanging
        const createTicketPromise = async () => {
          const ticket = await TicketService.createTicketFromChat(title, subtitle, extractedInfo);
          
          if (ticket && ticket.id) {
            console.log('Ticket created successfully with ID:', ticket.id);
            
            // Mark as created immediately when we have a valid ticket
            setTicketCreated(true);
            
            // Save chat history to the ticket
            const formattedChatHistory = currentMessages.map(msg => ({
              id: msg.id,
              text: msg.text,
              sender: msg.isUser ? 'user' : 'ai',
              timestamp: msg.timestamp
            }));
            
            // Try to save chat history
            try {
              await TicketService.saveChatHistory(ticket.id, formattedChatHistory);
              console.log('Chat history saved with ticket');
            } catch (chatHistoryError) {
              console.error('Error saving chat history:', chatHistoryError);
            }
            
            // Try to update the ticket status but don't block on it
            try {
              await TicketService.updateTicket(ticket.id, {
                status: 'inProgress',
                currentStep: TICKET_STATUS.IN_PROGRESS,
                progress: Math.max(25, ticket.progress || 0)
              });
              
              await TicketService.addAction(ticket.id, "Karen is actively working on this issue");
            } catch (updateError) {
              console.log('Non-critical error updating ticket:', updateError);
            }
            
            return ticket;
          }
          return null;
        };
        
        // Set a timeout for ticket creation
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ticket creation timed out')), 3000)
        );
        
        const ticket = await Promise.race([createTicketPromise(), timeoutPromise]);
        
        // If we got here successfully, the ticket was created
        if (ticket) {
          console.log('Ticket created successfully');
          setTicketCreated(true);
        }
      } catch (ticketError) {
        console.error('Error creating ticket:', ticketError);
        
        // If it's a UUID error, try to recover with a more explicit fallback
        if (ticketError.message && ticketError.message.includes('uuid')) {
          console.log('UUID error detected, trying direct ticket creation...');
          
          try {
            // Create a simpler ticket with a timestamp-based ID
            const fallbackId = `ticket-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            
            const simplifiedTicket = {
              id: fallbackId,
              title: title,
              subtitle: subtitle,
              status: 'inProgress',
              icon: extractedInfo?.icon || 'chat',
              company: extractedInfo?.company || '',
              progress: 10,
              currentStep: TICKET_STATUS.CONTACTED,
              dateCreated: new Date().toISOString(),
              dateUpdated: new Date().toISOString(),
              summary: [
                { id: '1', text: 'Created from chat conversation', isActive: true }
              ],
              actions: [
                { id: '1', text: 'Support ticket created', timestamp: new Date().toISOString() }
              ]
            };
            
            const addedTicket = await TicketService.addTicket(simplifiedTicket);
            if (addedTicket) {
              console.log('Successfully created fallback ticket');
              setTicketCreated(true);
              
              // Save chat history to the fallback ticket
              const formattedChatHistory = currentMessages.map(msg => ({
                id: msg.id,
                text: msg.text,
                sender: msg.isUser ? 'user' : 'ai',
                timestamp: msg.timestamp
              }));
              
              // Try to save chat history to the fallback ticket
              try {
                await TicketService.saveChatHistory(addedTicket.id, formattedChatHistory);
                console.log('Chat history saved with fallback ticket');
              } catch (chatHistoryError) {
                console.error('Error saving chat history to fallback ticket:', chatHistoryError);
              }
            }
          } catch (fallbackError) {
            console.error('Failed to create fallback ticket:', fallbackError);
          }
        }
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error('General error in ticket creation:', error);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.messagesContainer}
        ref={scrollViewRef}
        contentContainerStyle={styles.messagesContentContainer}
      >
        {messages.map((message, index) => {
          // Only animate an AI message if it's the latest received message
          const shouldAnimate = !message.isUser && 
                               !message.isWelcome && 
                               !message.isError && 
                               message.id === lastReceivedMessageId;
          
          return (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.isUser ? styles.userBubble : 
                  message.isWelcome ? styles.welcomeBubble : styles.botBubble
              ]}
            >
              {message.isUser ? (
                <Text style={styles.userText}>
                  {message.text}
                </Text>
              ) : (
                <TypewriterText 
                  text={message.text}
                  style={styles.botText}
                  typingSpeed={10}
                  startDelay={50}
                  skipAnimation={!shouldAnimate}
                />
              )}
            </View>
          );
        })}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Karen is typing...</Text>
          </View>
        )}
      </ScrollView>
      
      {!connected && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineContent}>
            <Avatar.Icon 
              size={20} 
              icon="wifi-off" 
              color="#FFFFFF" 
              style={styles.offlineIcon} 
            />
            <Text style={styles.offlineText}>
              {error ? `Error: ${error}` : 'Disconnected from server'}
            </Text>
          </View>
          <View style={styles.offlineActions}>
            <TouchableOpacity 
              onPress={handleRetryConnection}
              disabled={isRetrying}
              style={styles.actionButton}
            >
              <Text style={styles.actionText}>
                {isRetrying ? 'Connecting...' : 'Retry'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setText}
          placeholder="Type your message here..."
          placeholderTextColor={theme.colors.placeholder}
          onSubmitEditing={onSend}
          editable={!loading}
        />
        <TouchableOpacity 
          onPress={onSend} 
          disabled={loading || !inputText.trim()}
          style={styles.sendButton}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
    position: 'relative',
  },
  messagesContainer: {
    flex: 1,
    padding: 10,
    marginBottom: 0,
  },
  messagesContentContainer: {
    paddingBottom: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: appTheme.colors.accent,
    alignSelf: 'flex-end',
  },
  botBubble: {
    backgroundColor: appTheme.colors.card,
    alignSelf: 'flex-start',
  },
  userText: {
    color: '#fff',
  },
  botText: {
    color: appTheme.colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    marginBottom: 0,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    backgroundColor: appTheme.colors.card,
    color: appTheme.colors.text,
  },
  sendButton: {
    backgroundColor: appTheme.colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 10,
    marginBottom: 10,
  },
  loadingText: {
    marginLeft: 8,
    color: appTheme.colors.placeholder,
    fontStyle: 'italic',
  },
  offlineBanner: {
    backgroundColor: appTheme.colors.error,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  offlineText: {
    color: '#FFFFFF',
    marginLeft: 6,
    fontSize: 12,
    flex: 1,
  },
  offlineIcon: {
    backgroundColor: 'transparent',
  },
  offlineActions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  welcomeBubble: {
    backgroundColor: appTheme.colors.surface,
    alignSelf: 'center', 
    width: '95%',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appTheme.colors.accent,
    shadowColor: appTheme.colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default ChatScreen; 