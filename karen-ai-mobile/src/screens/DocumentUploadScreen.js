import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';

const DocumentUploadScreen = () => {
  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <Text style={styles.title}>Upload Documents</Text>
        <Button mode="contained" onPress={() => {}} style={styles.button}>
          Select Document
        </Button>
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
    padding: 16,
    elevation: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
  button: {
    marginTop: 10,
  },
});

export default DocumentUploadScreen; 