import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { appTheme } from '../theme/theme';
import { TICKET_STATUS } from '../services/TicketService';

// Define steps using the constants from TicketService
const steps = [
  { id: TICKET_STATUS.CONTACTED, label: 'Contacted', key: 'contacted', number: '1' },
  { id: TICKET_STATUS.IN_PROGRESS, label: 'In Progress', key: 'inProgress', number: '2' },
  { id: TICKET_STATUS.ACCEPTED, label: 'Accepted', key: 'accepted', number: '3' },
  { id: TICKET_STATUS.COMPLETED, label: 'Completed', key: 'completed', number: '4' },
];

const ProgressStepper = ({ currentStep, ticketStatus }) => {
  // For completed tickets, ensure we show the completed step as active
  const effectiveStep = ticketStatus === 'finished' 
    ? TICKET_STATUS.COMPLETED 
    : currentStep;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress</Text>
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const isCompleted = step.id < effectiveStep;
          const isCurrent = step.id === effectiveStep;
          const isActive = isCompleted || isCurrent;
          
          // Color logic: completed steps are green, current step is blue, inactive steps are gray
          let circleColor = appTheme.colors.disabled; // Default gray for inactive
          if (isCompleted) {
            circleColor = appTheme.colors.success; // Green for completed steps
          } else if (isCurrent) {
            circleColor = appTheme.colors.accent; // Blue for current step
          }
          
          // Draw the connecting line between steps (except the last one)
          const isLastStep = index === steps.length - 1;
          
          return (
            <View key={step.id} style={styles.stepWrapper}>
              {/* The step circle with number */}
              <View 
                style={[
                  styles.stepCircle, 
                  { backgroundColor: circleColor }
                ]}
              >
                <Text style={styles.stepNumber}>{step.number}</Text>
              </View>
              
              {/* Connector line to next step */}
              {!isLastStep && (
                <View style={styles.connectorContainer}>
                  <View 
                    style={[
                      styles.connector,
                      {
                        backgroundColor: step.id < effectiveStep
                          ? appTheme.colors.success  // Green if completed
                          : appTheme.colors.disabled // Gray otherwise
                      }
                    ]} 
                  />
                </View>
              )}
              
              {/* Step label */}
              <Text 
                style={[
                  styles.stepLabel, 
                  { 
                    color: isActive 
                      ? appTheme.colors.text 
                      : appTheme.colors.disabled,
                    fontWeight: isCurrent ? 'bold' : 'normal',
                  }
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: appTheme.colors.text,
    marginBottom: 16,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 16,
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  stepNumber: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  connectorContainer: {
    position: 'absolute',
    top: 20, // Center of the circle
    width: '100%',
    height: 3,
    zIndex: -1,
  },
  connector: {
    position: 'absolute',
    height: 3,
    left: '50%',
    right: -50, // Extend past halfway into the next step
    backgroundColor: appTheme.colors.disabled,
  },
  stepLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  }
});

export default ProgressStepper; 