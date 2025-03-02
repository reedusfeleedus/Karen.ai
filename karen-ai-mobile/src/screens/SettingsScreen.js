import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { List, Switch, Surface, Divider, Text } from 'react-native-paper';
import ChatService from '../services/ChatService';

const SettingsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState(true);
  
  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <List.Section>
          <List.Subheader>Preferences</List.Subheader>
          <List.Item
            title="Push Notifications"
            right={() => (
              <Switch
                value={notifications}
                onValueChange={() => setNotifications(!notifications)}
              />
            )}
          />
          <List.Item
            title="App Version"
            description="1.0.0"
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>About</List.Subheader>
          <List.Item
            title="OpenAI Integration"
            description="Powered by OpenAI GPT-4"
          />
        </List.Section>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  surface: {
    elevation: 4,
    borderRadius: 8,
  },
});

export default SettingsScreen; 