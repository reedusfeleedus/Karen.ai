import React, { useState, useEffect, useRef } from 'react';
import { Text } from 'react-native';

const TypewriterText = ({ 
  text, 
  style, 
  typingSpeed = 10,
  onTypingComplete = () => {}, 
  startDelay = 50,
  minSpeed = 5,
  maxSpeed = 20,
  skipAnimation = false // Option to skip animation for loading old messages
}) => {
  const [displayedText, setDisplayedText] = useState(skipAnimation ? text : '');
  const [isComplete, setIsComplete] = useState(skipAnimation);
  const originalTextRef = useRef('');
  const timeoutRef = useRef(null);
  
  // Reset animation when text changes
  useEffect(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Store the original text
    originalTextRef.current = text;
    
    // If skipAnimation is true, immediately show the full text
    if (skipAnimation) {
      setDisplayedText(text);
      setIsComplete(true);
      onTypingComplete();
      return;
    }
    
    // Reset state
    setDisplayedText('');
    setIsComplete(false);
    
    // Start typing animation after a small delay
    timeoutRef.current = setTimeout(() => {
      animateText(0);
    }, startDelay);
    
    // Clean up on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, typingSpeed, startDelay, skipAnimation]);
  
  // Get a random typing speed with natural variation
  const getRandomSpeed = () => {
    return Math.floor(Math.random() * (maxSpeed - minSpeed) + minSpeed);
  };
  
  // Handle emoji specially - treat as a single character unit
  const getNextCharUnit = (text, position) => {
    // Check if the current position is the start of an emoji sequence
    // Basic emoji regex - this will capture most common emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    
    // If we're at an emoji, return the emoji as a single unit
    if (emojiRegex.test(text.slice(position, position + 2))) {
      // Most emojis are represented as 2 characters in JavaScript strings
      return 2;
    }
    
    // Otherwise just return 1 for a regular character
    return 1;
  };
  
  // Recursive function to animate text typing
  const animateText = (index) => {
    if (index <= originalTextRef.current.length) {
      // Update displayed text with the next character(s)
      setDisplayedText(originalTextRef.current.substring(0, index));
      
      // Continue typing if not complete
      if (index < originalTextRef.current.length) {
        // Determine whether the current character is part of an emoji sequence
        const charStep = getNextCharUnit(originalTextRef.current, index);
        
        // Set speed based on character type
        let typingVariation;
        const currentChar = originalTextRef.current[index];
        
        if (currentChar === ' ') {
          // Pauses at spaces
          typingVariation = typingSpeed * 2;
        } else if (/[.,!?;:]/.test(currentChar)) {
          // Longer pauses at punctuation
          typingVariation = typingSpeed * 4;
        } else if (/[\n\r]/.test(currentChar)) {
          // Even longer pauses at line breaks
          typingVariation = typingSpeed * 6;
        } else {
          // Random variation for normal characters
          typingVariation = getRandomSpeed();
        }
        
        // Schedule the next character
        timeoutRef.current = setTimeout(() => {
          animateText(index + charStep);
        }, typingVariation);
      } else {
        // Animation complete
        setIsComplete(true);
        onTypingComplete();
      }
    }
  };

  return (
    <Text style={style}>
      {displayedText}
    </Text>
  );
};

export default TypewriterText; 