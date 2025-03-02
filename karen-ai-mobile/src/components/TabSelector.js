import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { appTheme } from '../theme/theme';

const TabSelector = ({ tabs, activeTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && styles.activeTab
          ]}
          onPress={() => onTabChange(tab.key)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab.key && styles.activeTabText
            ]}
          >
            {tab.label}
          </Text>
          {activeTab === tab.key && <View style={styles.indicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: appTheme.colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: 'rgba(61, 90, 241, 0.1)',
  },
  tabText: {
    fontSize: 14,
    color: appTheme.colors.placeholder,
    fontWeight: '500',
  },
  activeTabText: {
    color: appTheme.colors.accent,
    fontWeight: 'bold',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: 24,
    backgroundColor: appTheme.colors.accent,
    borderRadius: 3,
    alignSelf: 'center',
    bottom: 4,
  },
});

export default TabSelector; 