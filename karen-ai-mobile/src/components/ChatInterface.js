import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { appTheme } from '../theme/theme';
import ChatService from '../services/ChatService';
import TicketService from '../services/TicketService';
import TypewriterText from './TypewriterText';

const ChatInterface = ({ ticketId }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastReceivedMessageId, setLastReceivedMessageId] = useState(null);
  const scrollViewRef = useRef(null);
  
  // Load initial chat history for this ticket
  useEffect(() => {
    const loadChatHistory = async () => {
      setLoadingHistory(true);
      
      if (ticketId) {
        console.log(`Loading chat history for ticket ${ticketId}`);
        try {
          // Get chat history from ticket
          const history = await TicketService.getChatHistory(ticketId);
          
          // If we have history, use it
          if (history && history.length > 0) {
            console.log(`Found ${history.length} existing messages for ticket ${ticketId}`);
            setMessages(history);
          } else {
            // If no history, set welcome message
            console.log(`No existing chat history for ticket ${ticketId}, adding welcome message`);
            const welcomeMessage = {
              id: '1',
              text: "Hey! I'm Karen 👋 Your personal customer service fighter. What annoying issue can I help you tackle today?",
              sender: 'ai',
              timestamp: new Date().toISOString()
            };
            setMessages([welcomeMessage]);
            
            // Save this initial message to the ticket
            await TicketService.saveChatHistory(ticketId, [welcomeMessage]);
          }
        } catch (error) {
          console.error('Error loading chat history:', error);
          // Fallback to welcome message on error
          setMessages([{
            id: '1',
            text: "Hey! I'm Karen 👋 Your personal customer service fighter. What annoying issue can I help you tackle today?",
            sender: 'ai',
            timestamp: new Date().toISOString()
          }]);
        }
      } else {
        // No ticket ID, just show welcome message
        setMessages([{
          id: '1',
          text: "Hey! I'm Karen 👋 Your personal customer service fighter. What annoying issue can I help you tackle today?",
          sender: 'ai',
          timestamp: new Date().toISOString()
        }]);
      }
      
      setLoadingHistory(false);
    };
    
    loadChatHistory();
  }, [ticketId]);
  
  useEffect(() => {
    // Set up message handler
    const unsubscribe = ChatService.onMessage((newMessage) => {
      console.log('Received message in ChatInterface:', newMessage);
      
      const messageId = Date.now().toString();
      const aiMessage = {
        id: messageId,
        text: newMessage.text,
        sender: 'ai',
        timestamp: newMessage.timestamp || new Date().toISOString()
      };
      
      // Store this as the last received message ID
      setLastReceivedMessageId(messageId);
      
      // Update local state
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages, aiMessage];
        
        // Save to ticket if we have a ticketId
        if (ticketId) {
          TicketService.saveChatHistory(ticketId, updatedMessages)
            .catch(err => console.error('Error saving chat history:', err));
        }
        
        return updatedMessages;
      });
      
      setLoading(false);
      
      // Scroll to bottom on new message
      scrollToBottom();
    });
    
    return () => {
      unsubscribe();
    };
  }, [ticketId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleSend = () => {
    if (message.trim()) {
      const userMessage = {
        id: Date.now().toString(),
        text: message,
        sender: 'user',
        timestamp: new Date().toISOString()
      };
      
      // Update local state
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages, userMessage];
        
        // Save to ticket if we have a ticketId
        if (ticketId) {
          TicketService.saveChatHistory(ticketId, updatedMessages)
            .catch(err => console.error('Error saving chat history:', err));
        }
        
        return updatedMessages;
      });
      
      setLoading(true);
      setMessage('');
      
      // Send to chat service
      ChatService.sendMessage({
        text: message,
        timestamp: new Date().toISOString()
      });
      
      // Sync conversation with ChatService so it has context
      ChatService.syncConversation(messages.concat(userMessage).map(msg => ({
        text: msg.text,
        isUser: msg.sender === 'user',
        timestamp: msg.timestamp
      })));
      
      // Scroll to bottom
      scrollToBottom();
    }
  };

  // Show loading indicator while fetching chat history
  if (loadingHistory) {
    return (
      <Surface style={styles.loadingContainer}>
        <ActivityIndicator color={appTheme.colors.primary} size="small" />
        <Text style={styles.loadingHistoryText}>Loading conversation...</Text>
      </Surface>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Surface style={styles.chatContainer}>
        <ScrollView 
          style={styles.messagesContainer}
          ref={scrollViewRef}
        >
          {messages.map((item, index) => {
            // Only animate the message if it's the latest received AI message
            const shouldAnimate = item.sender === 'ai' && 
                                 item.id === lastReceivedMessageId;
            
            return (
              <View
                key={item.id}
                style={[
                  styles.messageBubble,
                  item.sender === 'user' ? styles.userMessage : styles.aiMessage
                ]}
              >
                {item.sender === 'user' ? (
                  <Text style={[
                    styles.messageText,
                    styles.userMessageText
                  ]}>
                    {item.text}
                  </Text>
                ) : (
                  <TypewriterText
                    text={item.text}
                    style={[
                      styles.messageText,
                      styles.aiMessageText
                    ]}
                    typingSpeed={10}
                    startDelay={50}
                    skipAnimation={!shouldAnimate}
                  />
                )}
              </View>
            );
          })}
          {loading && (
            <View style={styles.loadingIndicator}>
              <Text style={styles.loadingText}>Karen is typing...</Text>
            </View>
          )}
        </ScrollView>
      </Surface>
      <View style={styles.inputContainer}>
        <TextInput
          mode="outlined"
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          style={styles.input}
          outlineColor={appTheme.colors.border}
          activeOutlineColor={appTheme.colors.primary}
          placeholderTextColor={appTheme.colors.placeholder}
          textColor={appTheme.colors.text}
          onSubmitEditing={handleSend}
        />
        <Button 
          mode="contained" 
          onPress={handleSend} 
          style={styles.sendButton}
          disabled={!message.trim() || loading}
        >
          Send
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: appTheme.colors.card,
    borderRadius: 8,
    marginBottom: 16,
    height: 300, // Fixed height for chat container
  },
  messagesContainer: {
    padding: 16,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6200ee',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 14,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#000',
  },
  loadingIndicator: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  loadingText: {
    color: appTheme.colors.disabled,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: appTheme.colors.surface,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: appTheme.colors.accent,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: appTheme.colors.card,
  },
  loadingHistoryText: {
    marginTop: 12,
    color: appTheme.colors.placeholder,
  },
});

export default ChatInterface; 