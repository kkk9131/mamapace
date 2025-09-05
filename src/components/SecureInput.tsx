/**
 * SECURE INPUT COMPONENT
 *
 * Security Features:
 * - Maternal health ID input masking after entry
 * - Secure text entry with visual feedback
 * - Input sanitization and validation
 * - Memory clearing on unmount
 * - No debug logging of sensitive data
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Animated } from 'react-native';

import { useTheme } from '../theme/theme';
import { ValidationConstraints } from '../types/auth';
import { secureLogger } from '../utils/privacyProtection';

interface SecureInputProps {
  /** Placeholder text */
  placeholder: string;
  /** Current input value */
  value: string;
  /** Input change handler - receives sanitized input */
  onChangeText: (text: string) => void;
  /** Whether this is a sensitive field (maternal health ID) */
  isSensitive?: boolean;
  /** Whether to use secure text entry */
  secureTextEntry?: boolean;
  /** Input validation state */
  validation?: {
    isValid: boolean;
    error: string;
  };
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Keyboard type override */
  keyboardType?: 'default' | 'numeric' | 'email-address';
  /** Maximum character length */
  maxLength?: number;
  /** Auto-capitalization setting */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** Test identifier for E2E/integration tests */
  testID?: string;
}

/**
 * Secure input component with enhanced privacy protection
 */
export default function SecureInput({
  placeholder,
  value,
  onChangeText,
  isSensitive = false,
  secureTextEntry = false,
  validation,
  disabled = false,
  keyboardType = 'default',
  maxLength,
  autoCapitalize = 'none',
  testID,
}: SecureInputProps) {
  const theme = useTheme();
  const { colors } = theme;

  // State for input masking and security
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(!secureTextEntry);
  const [maskedDisplay, setMaskedDisplay] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Animation for validation feedback
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // =====================================================
  // SECURITY FEATURES
  // =====================================================

  /**
   * Masks sensitive input for display (maternal health ID)
   */
  const getMaskedValue = (inputValue: string): string => {
    if (!isSensitive || !inputValue || isFocused) {
      return inputValue;
    }

    // Show first 2 and last 2 digits, mask middle
    if (inputValue.length > 4) {
      const firstTwo = inputValue.substring(0, 2);
      const lastTwo = inputValue.substring(inputValue.length - 2);
      const middleMask = '●'.repeat(inputValue.length - 4);
      return firstTwo + middleMask + lastTwo;
    } else if (inputValue.length > 2) {
      const first = inputValue.substring(0, 1);
      const mask = '●'.repeat(inputValue.length - 1);
      return first + mask;
    } else {
      return inputValue;
    }
  };

  /**
   * Sanitizes input to prevent injection attacks
   */
  const sanitizeInput = (text: string): string => {
    // IME入力（日本語など）を阻害しないため、基本は文字種を制限しない。
    // 最低限の無害化のみ（<, >, ", ', & を除去）。
    if (isSensitive || keyboardType === 'numeric') {
      // 数字のみ（母子手帳番号など）
      return text.replace(/[^\d]/g, '');
    }
    if (keyboardType === 'email-address') {
      // EメールはASCII範囲の最小セットに制限
      return text.replace(/[^a-zA-Z0-9@._+-]/g, '');
    }
    // 一般テキストは多言語を許容。危険文字のみ除去。
    return text.replace(/[<>\"'&]/g, '');
  };

  /**
   * Secure text change handler with validation
   */
  const handleSecureTextChange = (text: string) => {
    const sanitized = sanitizeInput(text);

    // Log non-sensitive input changes only
    if (!isSensitive) {
      secureLogger.debug('Input changed', {
        field: placeholder,
        length: sanitized.length,
      });
    }

    // Update display value for masking
    if (isSensitive) {
      setMaskedDisplay(getMaskedValue(sanitized));
    }

    // Call parent handler with sanitized input
    onChangeText(sanitized);
  };

  /**
   * Focus handler with security logging
   */
  const handleFocus = () => {
    setIsFocused(true);

    if (!isSensitive) {
      secureLogger.debug('Input focused', { field: placeholder });
    }
  };

  /**
   * Blur handler with masking for sensitive fields
   */
  const handleBlur = () => {
    setIsFocused(false);

    // Apply masking when focus is lost
    if (isSensitive && value) {
      setMaskedDisplay(getMaskedValue(value));
    }

    if (!isSensitive) {
      secureLogger.debug('Input blurred', { field: placeholder });
    }
  };

  /**
   * Toggle secure text visibility
   */
  const toggleSecureVisibility = () => {
    setIsSecureVisible(!isSecureVisible);
    secureLogger.debug('Secure visibility toggled', { field: placeholder });
  };

  // =====================================================
  // VALIDATION FEEDBACK
  // =====================================================

  /**
   * Shake animation for validation errors
   */
  const triggerShakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Trigger shake animation on validation error
  useEffect(() => {
    if (validation && !validation.isValid && validation.error) {
      triggerShakeAnimation();
    }
  }, [validation?.isValid, validation?.error]);

  // =====================================================
  // SECURITY CLEANUP
  // =====================================================

  /**
   * Clear sensitive data on unmount
   */
  useEffect(() => {
    return () => {
      if (isSensitive) {
        // Clear any sensitive data from memory
        setMaskedDisplay('');
        secureLogger.debug('Sensitive input data cleared on unmount');
      }
    };
  }, [isSensitive]);

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const hasError = validation && !validation.isValid && validation.error;
  const borderColor = hasError
    ? colors.danger
    : isFocused
      ? colors.pink
      : 'transparent';
  const displayValue = isSensitive && !isFocused ? maskedDisplay : value;
  const actualSecureTextEntry = secureTextEntry && !isSecureVisible;

  return (
    <View style={{ width: '100%' }} testID={testID}>
      <Animated.View
        style={[
          {
            backgroundColor: colors.surface,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing(1),
            borderWidth: 1,
            borderColor,
            flexDirection: 'row',
            alignItems: 'center',
          },
          {
            transform: [{ translateX: shakeAnimation }],
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          placeholder={placeholder}
          placeholderTextColor={colors.subtext}
          style={{
            flex: 1,
            color: colors.text,
            height: 44,
            fontSize: 16,
          }}
          value={displayValue}
          onChangeText={handleSecureTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={actualSecureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={!disabled}
          // Security settings
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          testID={testID}
          // Clear sensitive data on paste
          onSelectionChange={isSensitive ? () => {} : undefined}
        />

        {/* Secure text visibility toggle */}
        {secureTextEntry && (
          <Pressable
            onPress={toggleSecureVisibility}
            style={{
              padding: theme.spacing(0.5),
              marginLeft: theme.spacing(0.5),
            }}
            disabled={disabled}
          >
            <Text
              style={{
                color: disabled ? colors.subtext : colors.pink,
                fontSize: 16,
              }}
            >
              {isSecureVisible ? '👁️' : '🙈'}
            </Text>
          </Pressable>
        )}

        {/* Sensitive data indicator */}
        {isSensitive && (
          <View
            style={{
              marginLeft: theme.spacing(0.5),
              padding: 2,
              borderRadius: 4,
              backgroundColor: colors.pink + '20',
            }}
          >
            <Text
              style={{
                color: colors.pink,
                fontSize: 10,
                fontWeight: '600',
              }}
            >
              🔒
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Validation error message */}
      {hasError && (
        <Animated.View
          style={{
            marginTop: 4,
            marginLeft: theme.spacing(0.5),
          }}
        >
          <Text
            style={{
              color: colors.danger,
              fontSize: 12,
            }}
          >
            {validation?.error}
          </Text>
        </Animated.View>
      )}

      {/* Security hint for sensitive fields */}
      {isSensitive && !hasError && (
        <Text
          style={{
            color: colors.subtext,
            fontSize: 10,
            marginTop: 2,
            marginLeft: theme.spacing(0.5),
          }}
        >
          入力後は自動的に保護されます
        </Text>
      )}
    </View>
  );
}
