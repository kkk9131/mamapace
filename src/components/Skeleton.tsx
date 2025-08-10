import React from 'react';
import { View } from 'react-native';

export function SkeletonLine({ width = '100%', height = 14, radius = 8, style = {} as any }) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: '#ffffff14',
        ...style,
      }}
    />
  );
}

export function PostSkeletonCard() {
  return (
    <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: '#ffffff0E', padding: 14 }}>
      <SkeletonLine width={140} height={12} style={{ marginBottom: 8 }} />
      <SkeletonLine height={14} style={{ marginBottom: 6 }} />
      <SkeletonLine height={14} width={'90%'} style={{ marginBottom: 6 }} />
      <SkeletonLine height={14} width={'80%'} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonLine width={120} height={10} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonLine width={36} height={24} radius={999} />
          <SkeletonLine width={36} height={24} radius={999} />
        </View>
      </View>
    </View>
  );
}
