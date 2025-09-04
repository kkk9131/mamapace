/**
 * PASSWORD STRENGTH INDICATOR
 *
 * Visual indicator for password strength with:
 * - Real-time strength assessment
 * - Japanese feedback messages
 * - Visual progress indication
 * - Security requirement checklist
 */

import React from 'react';
import { View, Text, Animated } from 'react-native';
import { useTheme } from '../theme/theme';
import { PasswordValidation } from '../types/auth';
import { ValidationMessages } from '../utils/formValidation';

interface PasswordStrengthIndicatorProps {
  /** Password validation result */
  validation: PasswordValidation;
  /** Whether to show detailed checks */
  showDetails?: boolean;
  /** Whether to show strength bar */
  showStrengthBar?: boolean;
}

/**
 * Password strength indicator with visual feedback
 */
export default function PasswordStrengthIndicator({
  validation,
  showDetails = true,
  showStrengthBar = true,
}: PasswordStrengthIndicatorProps) {
  const theme = useTheme();
  const { colors } = theme;

  // =====================================================
  // STRENGTH CALCULATIONS
  // =====================================================

  /**
   * Gets strength color based on password strength
   */
  const getStrengthColor = (): string => {
    switch (validation.strength) {
      case 'strong':
        return colors.mint;
      case 'medium':
        return colors.pink;
      case 'weak':
      default:
        return colors.danger;
    }
  };

  /**
   * Gets strength percentage for progress bar
   */
  const getStrengthPercentage = (): number => {
    switch (validation.strength) {
      case 'strong':
        return 100;
      case 'medium':
        return 66;
      case 'weak':
      default:
        return 33;
    }
  };

  /**
   * Gets strength label in Japanese
   */
  const getStrengthLabel = (): string => {
    switch (validation.strength) {
      case 'strong':
        return ValidationMessages.password.strong;
      case 'medium':
        return ValidationMessages.password.medium;
      case 'weak':
      default:
        return ValidationMessages.password.weak;
    }
  };

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  /**
   * Renders individual password requirement check
   */
  const renderRequirementCheck = (
    isValid: boolean,
    label: string,
    key: string
  ) => {
    const checkColor = isValid ? colors.mint : colors.subtext;
    const checkIcon = isValid ? '✅' : '⚪';

    return (
      <View
        key={key}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <Text style={{ color: checkColor, fontSize: 12, marginRight: 8 }}>
          {checkIcon}
        </Text>
        <Text
          style={{
            color: checkColor,
            fontSize: 12,
            flex: 1,
          }}
        >
          {label}
        </Text>
      </View>
    );
  };

  /**
   * Renders strength progress bar
   */
  const renderStrengthBar = () => {
    const strengthColor = getStrengthColor();
    const strengthPercentage = getStrengthPercentage();

    return (
      <View style={{ marginBottom: theme.spacing(1) }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <Text
            style={{
              color: colors.subtext,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            パスワード強度
          </Text>
          <Text
            style={{
              color: strengthColor,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            {getStrengthLabel()}
          </Text>
        </View>

        {/* Progress bar background */}
        <View
          style={{
            height: 4,
            backgroundColor: colors.surface,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Progress bar fill */}
          <Animated.View
            style={{
              height: '100%',
              width: `${strengthPercentage}%`,
              backgroundColor: strengthColor,
              borderRadius: 2,
            }}
          />
        </View>
      </View>
    );
  };

  /**
   * Renders detailed requirement checks
   */
  const renderDetailedChecks = () => {
    const requirements = [
      {
        key: 'length',
        isValid: validation.checks.length,
        label: '8文字以上',
      },
      {
        key: 'uppercase',
        isValid: validation.checks.uppercase,
        label: '大文字を含む (A-Z)',
      },
      {
        key: 'lowercase',
        isValid: validation.checks.lowercase,
        label: '小文字を含む (a-z)',
      },
      {
        key: 'numbers',
        isValid: validation.checks.numbers,
        label: '数字を含む (0-9)',
      },
      {
        key: 'symbols',
        isValid: validation.checks.symbols,
        label: '記号を含む (!@#$...)',
      },
    ];

    return (
      <View
        style={{
          backgroundColor: colors.surface + '60',
          borderRadius: theme.radius.sm,
          padding: theme.spacing(1),
          marginTop: theme.spacing(0.5),
        }}
      >
        <Text
          style={{
            color: colors.subtext,
            fontSize: 11,
            fontWeight: '600',
            marginBottom: 6,
          }}
        >
          パスワード要件:
        </Text>

        {requirements.map(req =>
          renderRequirementCheck(req.isValid, req.label, req.key)
        )}
      </View>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  // Don't render if no password validation data
  if (!validation) {
    return null;
  }

  return (
    <View style={{ width: '100%' }}>
      {/* Strength bar */}
      {showStrengthBar && renderStrengthBar()}

      {/* Detailed checks */}
      {showDetails && renderDetailedChecks()}

      {/* Security tips for weak passwords */}
      {validation.strength === 'weak' && (
        <View
          style={{
            backgroundColor: colors.danger + '10',
            borderRadius: theme.radius.sm,
            padding: theme.spacing(0.75),
            marginTop: theme.spacing(0.5),
            borderWidth: 1,
            borderColor: colors.danger + '30',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 12, marginRight: 6 }}>⚠️</Text>
            <Text
              style={{
                color: colors.danger,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              セキュリティを向上させてください
            </Text>
          </View>
          <Text
            style={{
              color: colors.danger,
              fontSize: 11,
              lineHeight: 16,
            }}
          >
            強いパスワードは、大文字・小文字・数字・記号を組み合わせて作成してください。
          </Text>
        </View>
      )}

      {/* Success message for strong passwords */}
      {validation.strength === 'strong' && validation.isValid && (
        <View
          style={{
            backgroundColor: colors.mint + '15',
            borderRadius: theme.radius.sm,
            padding: theme.spacing(0.75),
            marginTop: theme.spacing(0.5),
            borderWidth: 1,
            borderColor: colors.mint + '40',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, marginRight: 6 }}>🛡️</Text>
            <Text
              style={{
                color: colors.mint,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              セキュアなパスワードです
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
