import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { FAB, Text, Divider, Card, Surface, Avatar, ProgressBar, Button } from 'react-native-paper';
import TabSelector from '../components/TabSelector';
import { appTheme } from '../theme/theme';
import ChatService from '../services/ChatService';
import TicketService, { TICKET_STATUS } from '../services/TicketService';
import { LinearGradient } from 'expo-linear-gradient';
import LogTest from '../services/LogTest';

const tabs = [
  { key: 'inProgress', label: 'In progress' },
  { key: 'finished', label: 'Finished' },
  { key: 'all', label: 'All' }
];

// Helper function to get a color based on progress
const getProgressColor = (progress) => {
  if (progress < 30) return appTheme.colors.warning;
  if (progress < 70) return appTheme.colors.accent;
  return appTheme.colors.success;
};

const HomeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('inProgress');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  // Test logging on component mount
  useEffect(() => {
    console.log('HomeScreen mounted - TESTING LOGS');
    // Test console logs
    LogTest.test();
    // Test alerts
    LogTest.testAlert(Alert);
  }, []);
  
  // Load tickets and set up listeners
  useEffect(() => {
    let ticketsListener = null;
    
    const loadTickets = async () => {
      setLoading(true);
      try {
        console.log('Reloading all tickets in HomeScreen');
        const allTickets = await TicketService.forceReload();
        console.log(`Loaded ${allTickets.length} tickets after reload`);
        setTickets(allTickets);
      } catch (error) {
        console.error('Error loading tickets:', error);
        Alert.alert('Error', 'Failed to load tickets. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    // Set up listener for ticket changes
    ticketsListener = TicketService.addListener((updatedTickets) => {
      setTickets(updatedTickets);
    });
    
    // Initial load
    loadTickets();
    
    // Add a focus listener to reload tickets when the screen is focused
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('HomeScreen focused, reloading tickets');
      loadTickets();
    });
    
    return () => {
      if (ticketsListener) ticketsListener();
      unsubscribeFocus();
    };
  }, [navigation]);
  
  // Initialize connection - only attempt once when the component mounts
  useEffect(() => {
    let connectionListener = null;
    let errorListener = null;
    
    // Setup connection status listener
    connectionListener = ChatService.onConnectionChange((status) => {
      console.log('Connection status changed:', status);
      setConnected(status);
      
      // Clear any error message when connected
      if (status) {
        setConnectionError(null);
      }
    });
    
    // Setup error handler
    errorListener = ChatService.onError((error) => {
      console.log('Connection error:', error);
      // Update UI with readable error message
      if (error.includes('Failed to connect')) {
        setConnectionError('Server unavailable');
      } else {
        setConnectionError(error);
      }
    });
    
    // Try to connect - but don't worry if it fails
    if (!ChatService.isConnected()) {
      console.log('Initializing chat service connection');
      try {
        ChatService.connect();
      } catch (err) {
        console.error('Error connecting to ChatService:', err);
      }
    }
    
    // Clean up listeners when component unmounts
    return () => {
      if (connectionListener) connectionListener();
      if (errorListener) errorListener();
    };
  }, []);

  const getFilteredTickets = () => {
    if (activeTab === 'all') {
      return tickets;
    }
    return tickets.filter(ticket => ticket.status === activeTab);
  };

  const filteredTickets = getFilteredTickets();
  const currentTicket = activeTab === 'inProgress' && filteredTickets.length > 0 
    ? filteredTickets[0] 
    : null;
  
  const handleNewTicket = () => {
    // Navigate to chat screen to create a new ticket
    navigation.navigate('Chat');
  };

  const handleTicketPress = (ticket) => {
    navigation.navigate('TicketDetail', { 
      ticketId: ticket.id,
      ticketName: ticket.title 
    });
  };

  const renderActionItem = (text, index) => (
    <View style={styles.actionItem} key={index}>
      <View style={styles.actionDot} />
      <Text style={styles.actionText}>{text}</Text>
    </View>
  );

  // Render actions from the ticket
  const renderTicketActions = (ticket) => {
    if (!ticket || !ticket.actions || ticket.actions.length === 0) {
      return (
        <View style={styles.noActionsContainer}>
          <Text style={styles.noActionsText}>No recent actions recorded yet</Text>
        </View>
      );
    }

    // Get the most recent 2 actions
    const recentActions = [...ticket.actions]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 2);

    return recentActions.map((action, index) => renderActionItem(action.text, index));
  };

  // Attempt to reconnect if disconnected
  const handleReconnect = () => {
    setConnectionError(null);
    if (!ChatService.isConnected()) {
      ChatService.disconnect(); // Ensure clean state
      setTimeout(() => {
        ChatService.connect();
      }, 500);
    }
  };
  
  // Add function to reset tickets to demo state
  const handleResetToDemo = () => {
    Alert.alert(
      'Reset Tickets',
      'This will reset all tickets to the demo state. Any created tickets will be lost. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Reset',
          onPress: async () => {
            setLoading(true);
            try {
              await TicketService.resetAllData();
              console.log('Tickets reset to demo state');
              // Reload all tickets after reset
              const allTickets = await TicketService.forceReload();
              console.log(`Loaded ${allTickets.length} tickets after reset`);
              setTickets(allTickets);
            } catch (error) {
              console.error('Error resetting tickets:', error);
              Alert.alert('Error', 'Failed to reset tickets');
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="transparent" translucent barStyle="dark-content" />
      
      <View style={styles.screenContent}>
        <View style={styles.titleContainer}>
          <LinearGradient
            colors={[appTheme.colors.primary, appTheme.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleGradient}
          >
            <View style={styles.titleRow}>
              <Text style={styles.titleText}>Tickets</Text>
              <TouchableOpacity 
                onPress={handleResetToDemo}
                style={styles.resetButton}
              >
                <Text style={styles.resetButtonText}>Reset Demo</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
        
        <View style={styles.tabContainer}>
          <TabSelector 
            tabs={tabs} 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
          />
        </View>
        
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color={appTheme.colors.primary} />
              <Text style={styles.loadingText}>Updating tickets...</Text>
            </View>
          )}
          
          {currentTicket && (
            <View style={styles.currentTaskSection}>
              <Text style={styles.sectionTitle}>Currently Processing Task</Text>
              <Card style={styles.taskCard} elevation={4}>
                <View style={styles.taskContent}>
                  <View style={styles.taskHeader}>
                    <View style={styles.taskTitleContainer}>
                      <Text style={styles.taskTitle}>
                        {currentTicket.title}
                      </Text>
                      <Text style={styles.taskSubtitle}>
                        {currentTicket.subtitle}
                      </Text>
                    </View>
                    <Avatar.Icon 
                      size={40} 
                      icon={currentTicket.icon || 'format-list-bulleted'} 
                      style={styles.taskIcon}
                      color="#FFF"
                    />
                  </View>
                  
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelContainer}>
                      <Text style={styles.progressLabel}>In Progress</Text>
                      <Text style={styles.progressPercentage}>{currentTicket.progress}%</Text>
                    </View>
                    <ProgressBar 
                      progress={currentTicket.progress / 100} 
                      color={getProgressColor(currentTicket.progress)}
                      style={styles.progressBar} 
                    />
                  </View>
                  
                  <View style={styles.recentActionsSection}>
                    <Text style={styles.recentActionsLabel}>Recent Actions</Text>
                    <View style={styles.actionsContainer}>
                      {renderTicketActions(currentTicket)}
                    </View>
                  </View>
                </View>
              </Card>
            </View>
          )}
          
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'inProgress' ? 'Recent tickets' : activeTab === 'finished' ? 'Completed tickets' : 'All tickets'}
            </Text>
            
            {filteredTickets.map((ticket) => (
              <TouchableOpacity 
                key={ticket.id}
                onPress={() => handleTicketPress(ticket)}
                activeOpacity={0.7}
              >
                <Card style={styles.ticketCard} elevation={2}>
                  <View style={styles.ticketContent}>
                    <View style={styles.ticketIconContainer}>
                      <Avatar.Icon 
                        size={40} 
                        icon={ticket.icon || 'format-list-bulleted'} 
                        style={[styles.ticketIcon, { backgroundColor: getProgressColor(ticket.progress) }]}
                        color="#FFF"
                      />
                    </View>
                    <View style={styles.ticketDetails}>
                      <Text style={styles.ticketTitle}>{ticket.title}</Text>
                      <Text style={styles.ticketSubtitle}>{ticket.subtitle}</Text>
                    </View>
                    {activeTab === 'inProgress' && (
                      <View style={styles.ticketProgress}>
                        <Text style={styles.ticketProgressText}>{ticket.progress}%</Text>
                      </View>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
            
            {filteredTickets.length === 0 && (
              <Card style={styles.emptyState}>
                <Card.Content style={styles.emptyStateContent}>
                  <Avatar.Icon 
                    size={64} 
                    icon="ticket-outline" 
                    style={styles.emptyStateIcon}
                    color={appTheme.colors.disabled}
                  />
                  <Text style={styles.emptyText}>
                    No {activeTab === 'inProgress' ? 'active' : activeTab === 'finished' ? 'completed' : 'tickets'}
                  </Text>
                </Card.Content>
              </Card>
            )}
          </View>
        </ScrollView>
      </View>
      
      {connectionError && (
        <TouchableOpacity 
          style={styles.errorBanner}
          onPress={handleReconnect}
          activeOpacity={0.8}
        >
          <View style={styles.errorContent}>
            <Avatar.Icon 
              size={24} 
              icon="alert-circle" 
              color="#FFFFFF" 
              style={styles.errorIcon} 
            />
            <Text style={styles.errorText}>Connection error: {connectionError}</Text>
          </View>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      )}
      
      <FAB
        style={styles.fab}
        icon="plus"
        color="#ffffff"
        onPress={handleNewTicket}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
  },
  screenContent: {
    flex: 1,
    paddingTop: 50, // Account for status bar
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'flex-start',
  },
  titleGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  titleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  currentTaskSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: appTheme.colors.text,
  },
  taskCard: {
    borderRadius: 12,
    backgroundColor: appTheme.colors.surface,
    overflow: 'hidden',
  },
  taskContent: {
    padding: 16,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  taskTitleContainer: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: appTheme.colors.text,
  },
  taskSubtitle: {
    fontSize: 14,
    color: appTheme.colors.placeholder,
    marginTop: 2,
  },
  taskIcon: {
    backgroundColor: appTheme.colors.accent,
  },
  progressSection: {
    marginVertical: 12,
  },
  progressLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: appTheme.colors.text,
    fontWeight: '500',
  },
  progressPercentage: {
    color: appTheme.colors.placeholder,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  recentActionsSection: {
    marginTop: 16,
  },
  recentActionsLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: appTheme.colors.text,
  },
  actionsContainer: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: appTheme.colors.accent,
    marginRight: 8,
  },
  actionText: {
    fontSize: 14,
    color: appTheme.colors.text,
    flex: 1,
  },
  noActionsContainer: {
    padding: 8,
    alignItems: 'center',
  },
  noActionsText: {
    color: appTheme.colors.placeholder,
    fontStyle: 'italic',
    fontSize: 12,
  },
  recentSection: {
    marginBottom: 80, // Add extra bottom padding for FAB
  },
  ticketCard: {
    backgroundColor: appTheme.colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  ticketContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  ticketIconContainer: {
    marginRight: 16,
  },
  ticketIcon: {
    backgroundColor: appTheme.colors.accent,
  },
  ticketDetails: {
    flex: 1,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: appTheme.colors.text,
  },
  ticketSubtitle: {
    fontSize: 14,
    color: appTheme.colors.placeholder,
    marginTop: 2,
  },
  ticketProgress: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ticketProgressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: appTheme.colors.text,
  },
  emptyState: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: appTheme.colors.surface,
    marginTop: 8,
  },
  emptyStateContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateIcon: {
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  emptyText: {
    color: appTheme.colors.placeholder,
    fontSize: 16,
    textAlign: 'center',
  },
  errorBanner: {
    position: 'absolute', 
    bottom: 80,
    left: 10,
    right: 10,
    backgroundColor: appTheme.colors.error,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  errorIcon: {
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: appTheme.colors.accent,
    borderRadius: 28,
  },
  loadingIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: appTheme.colors.placeholder,
    fontStyle: 'italic',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  resetButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resetButtonText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HomeScreen; 