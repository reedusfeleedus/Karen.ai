import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { appTheme } from '../theme/theme';

const TicketCard = ({ title, subtitle, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container}>
      <Surface style={styles.surface}>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </Surface>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  surface: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: appTheme.colors.card,
  },
  content: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: appTheme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: appTheme.colors.placeholder,
  },
});

export default TicketCard; 