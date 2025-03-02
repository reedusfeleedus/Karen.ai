import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { appTheme } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import DocumentUploadScreen from '../screens/DocumentUploadScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TicketDetailScreen from '../screens/TicketDetailScreen';

const Stack = createNativeStackNavigator();

// Custom header background component with gradient
const HeaderBackground = () => {
  return (
    <LinearGradient
      colors={[appTheme.colors.primary, appTheme.colors.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    />
  );
};

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: appTheme.colors.primary, // Dark blue from theme
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ 
            headerShown: false // Hide header for Home screen
          }}
        />
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen}
          options={{ 
            title: 'Karen.ai',
            headerBackground: HeaderBackground
          }}
        />
        <Stack.Screen 
          name="TicketDetail" 
          component={TicketDetailScreen}
          options={({ route }) => ({ 
            title: route.params?.ticketName || 'Ticket Name',
            headerBackground: HeaderBackground,
            headerStyle: {
              backgroundColor: 'transparent', // Transparent so gradient shows through
            }
          })}
        />
        <Stack.Screen 
          name="DocumentUpload" 
          component={DocumentUploadScreen}
          options={{ 
            title: 'Upload Documents',
            headerBackground: HeaderBackground
          }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{ 
            title: 'Settings',
            headerBackground: HeaderBackground
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 