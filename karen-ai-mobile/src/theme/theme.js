import { DefaultTheme } from 'react-native-paper';

export const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1a2b47', // Dark blue
    accent: '#3d5af1', // Accent blue
    background: '#1c1f2e', // Dark background
    surface: '#252a3a', // Dark surface
    text: '#ffffff', // White text
    placeholder: '#9da3b4', // Light grey
    disabled: '#5d6680', // Medium grey
    card: '#2a3248', // Card background
    border: '#2f3a57', // Border color
    notification: '#ff4757', // Notification red
    success: '#2ed573', // Success green
    error: '#ff4757', // Error red
    warning: '#ffa502', // Warning yellow
  },
  dark: true,
};

export const progressColors = {
  contacted: '#a5d8ff', // Light blue
  inProgress: '#a5d8ff', // Light blue
  accepted: '#3d5af1', // Accent blue
  completed: '#acacac', // Grey
}; 