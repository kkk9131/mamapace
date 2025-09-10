import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/theme';

type Props = {
  size?: number;
  withLabel?: boolean;
  labelText?: string;
  accessibilityLabel?: string;
};

export default function VerifiedBadge({
  size = 18,
  withLabel = false,
  labelText = '認証済み',
  accessibilityLabel = '母子手帳認証済み',
}: Props) {
  const theme = useTheme();
  const { colors } = theme;

  // X-like blue
  const badgeColor = '#1D9BF0';

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <Ionicons name="checkmark-circle" size={size} color={badgeColor} />
      {withLabel && (
        <Text
          style={{
            color: colors.text,
            fontSize: Math.max(10, Math.round(size * 0.6)),
            fontWeight: '700',
          }}
        >
          {labelText}
        </Text>
      )}
    </View>
  );
}
