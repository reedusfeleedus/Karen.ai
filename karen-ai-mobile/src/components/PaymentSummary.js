import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Checkbox } from 'react-native-paper';
import { appTheme } from '../theme/theme';

const PaymentCard = ({ last4, isSelected, onSelect }) => {
  return (
    <Surface style={[styles.cardContainer, isSelected && styles.selectedCard]}>
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardLabel}>Credit Card</Text>
          <Text style={styles.cardNumber}>xxxx xxxx xxxx {last4}</Text>
        </View>
        <Checkbox
          status={isSelected ? 'checked' : 'unchecked'}
          color={appTheme.colors.accent}
          onPress={onSelect}
        />
      </View>
    </Surface>
  );
};

const PaymentSummary = () => {
  const [selectedCard, setSelectedCard] = React.useState('1234');
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Summary</Text>
      <View style={styles.paymentContainer}>
        <PaymentCard 
          last4="1234" 
          isSelected={selectedCard === '1234'} 
          onSelect={() => setSelectedCard('1234')}
        />
        <PaymentCard 
          last4="9876" 
          isSelected={selectedCard === '9876'} 
          onSelect={() => setSelectedCard('9876')}
        />
        
        <View style={styles.detailsToggle}>
          <Checkbox
            status={'checked'}
            color={appTheme.colors.accent}
          />
          <Text style={styles.detailsText}>Summary Detials</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: appTheme.colors.text,
    marginBottom: 16,
  },
  paymentContainer: {
    gap: 12,
  },
  cardContainer: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: appTheme.colors.card,
    marginBottom: 12,
  },
  selectedCard: {
    borderColor: appTheme.colors.accent,
    borderWidth: 1,
    backgroundColor: `${appTheme.colors.accent}20`, // 20% opacity
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: appTheme.colors.text,
    marginBottom: 4,
  },
  cardNumber: {
    fontSize: 14,
    color: appTheme.colors.placeholder,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  detailsText: {
    marginLeft: 8,
    color: appTheme.colors.text,
  },
});

export default PaymentSummary; 