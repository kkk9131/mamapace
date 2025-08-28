import React from 'react';
import { View, Text, Image, ViewStyle } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  emoji?: string | null;
  size?: number; // px
  backgroundColor?: string;
  style?: ViewStyle;
}

export default function Avatar({
  uri,
  emoji,
  size = 32,
  backgroundColor = '#2a2a2a',
  style,
}: AvatarProps) {
  const radius = size / 2;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
        },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text style={{ fontSize: Math.max(12, radius) }}>{emoji || '👤'}</Text>
      )}
    </View>
  );
}

