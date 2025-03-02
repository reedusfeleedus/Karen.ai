import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Text, Surface, Card, Divider, Button, IconButton, Avatar } from 'react-native-paper';
import ProgressStepper from '../components/ProgressStepper';
import ChatInterface from '../components/ChatInterface';
import { appTheme } from '../theme/theme';
import ChatService from '../services/ChatService';
import TicketService from '../services/TicketService';
import { LinearGradient } from 'expo-linear-gradient';

const TicketDetailScreen = ({ route, navigation }) => {
  const { ticketId, ticketName } = route.params || {};
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  
  // Fetch ticket data when screen loads
  useEffect(() => {
    const loadTicket = async () => {
      setLoading(true);
      try {
        const ticketData = await TicketService.getById(ticketId);
        if (ticketData) {
          setTicket(ticketData);
          navigation.setOptions({ title: ticketData.title });
        } else {
          Alert.alert('Error', 'Ticket not found');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Error loading ticket:', error);
        Alert.alert('Error', 'Failed to load ticket details');
      } finally {
        setLoading(false);
      }
    };
    
    loadTicket();
  }, [ticketId, navigation]);
  
  // Connect to chat service when screen loads
  useEffect(() => {
    ChatService.connect();
    
    return () => {
      // No need to disconnect as the service is shared
    };
  }, []);
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={styles.loadingText}>Loading ticket details...</Text>
      </View>
    );
  }
  
  if (!ticket) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Ticket not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const toggleSummaryExpanded = () => {
    setSummaryExpanded(!summaryExpanded);
  };
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.headerCard}>
          <LinearGradient
            colors={[appTheme.colors.primary, appTheme.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerTitleRow}>
                <View style={styles.titleContainer}>
                  <Text style={styles.ticketTitle}>{ticket.title}</Text>
                  <Text style={styles.ticketSubtitle}>{ticket.subtitle}</Text>
                </View>
                <Avatar.Icon 
                  size={48} 
                  icon={ticket.icon || 'ticket-outline'} 
                  style={styles.headerIcon}
                  color="#FFF"
                />
              </View>
              
              <Divider style={styles.divider} />
              
              <View style={styles.ticketMetadata}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>Created</Text>
                  <Text style={styles.metadataValue}>{formatDate(ticket.dateCreated)}</Text>
                </View>
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>Status</Text>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: ticket.status === 'finished' ? appTheme.colors.success : appTheme.colors.accent }
                  ]}>
                    <Text style={styles.statusText}>
                      {ticket.status === 'finished' ? 'Completed' : 'In Progress'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Card>

        <ProgressStepper 
          currentStep={ticket.currentStep} 
          ticketStatus={ticket.status}
        />
        
        <View style={styles.summarySection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <IconButton
              icon={summaryExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              onPress={toggleSummaryExpanded}
              color={appTheme.colors.text}
            />
          </View>
          
          {summaryExpanded && (
            <Card style={styles.summaryCard}>
              {ticket.summary && ticket.summary.length > 0 ? (
                ticket.summary.map((item) => (
                  <View key={item.id} style={styles.summaryItem}>
                    <Text style={[
                      styles.summaryText,
                      item.isActive ? styles.activeSummary : styles.inactiveSummary
                    ]}>
                      {item.text}
                    </Text>
                    {item.isActive && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptySummary}>
                  <Text style={styles.emptySummaryText}>No summary details available yet</Text>
                </View>
              )}
            </Card>
          )}
        </View>
        
        <View style={styles.actionsSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Recent Actions</Text>
          </View>
          
          <Card style={styles.actionsCard}>
            {ticket.actions && ticket.actions.length > 0 ? (
              ticket.actions.map((action, index) => (
                <View key={action.id || index}>
                  <View style={styles.actionItem}>
                    <View style={styles.actionDot} />
                    <View style={styles.actionContent}>
                      <Text style={styles.actionText}>{action.text}</Text>
                      <Text style={styles.actionTime}>{formatDate(action.timestamp)}</Text>
                    </View>
                  </View>
                  {index < ticket.actions.length - 1 && <Divider style={styles.actionDivider} />}
                </View>
              ))
            ) : (
              <View style={styles.emptyActions}>
                <Text style={styles.emptyActionsText}>No actions recorded yet</Text>
              </View>
            )}
          </Card>
        </View>
        
        <Text style={styles.sectionTitle}>Chat</Text>
        <ChatInterface ticketId={ticketId} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appTheme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    color: appTheme.colors.text,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: appTheme.colors.background,
  },
  errorText: {
    color: appTheme.colors.error,
    fontSize: 16,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    elevation: 0,
  },
  headerGradient: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerContent: {
    padding: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  ticketTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  ticketSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  divider: {
    marginVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  ticketMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metadataItem: {
    flexDirection: 'column',
  },
  metadataLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: appTheme.colors.text,
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: appTheme.colors.surface,
  },
  summaryItem: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    color: appTheme.colors.text,
    lineHeight: 20,
  },
  activeSummary: {
    fontWeight: '500',
    color: appTheme.colors.text,
  },
  inactiveSummary: {
    color: appTheme.colors.placeholder,
  },
  checkmark: {
    color: appTheme.colors.success,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptySummary: {
    padding: 20,
    alignItems: 'center',
  },
  emptySummaryText: {
    color: appTheme.colors.placeholder,
    fontStyle: 'italic',
  },
  actionsSection: {
    marginBottom: 24,
  },
  actionsCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: appTheme.colors.surface,
  },
  actionItem: {
    flexDirection: 'row',
    padding: 12,
  },
  actionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: appTheme.colors.accent,
    marginRight: 12,
    marginTop: 5,
  },
  actionContent: {
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    color: appTheme.colors.text,
    marginBottom: 4,
  },
  actionTime: {
    fontSize: 12,
    color: appTheme.colors.placeholder,
  },
  actionDivider: {
    marginHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  emptyActions: {
    padding: 20,
    alignItems: 'center',
  },
  emptyActionsText: {
    color: appTheme.colors.placeholder,
    fontStyle: 'italic',
  }
});

export default TicketDetailScreen; 