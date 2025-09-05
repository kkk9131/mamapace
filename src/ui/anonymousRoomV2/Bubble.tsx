import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../theme/theme';

type BubbleProps = {
  x: Animated.Value;
  y: Animated.Value;
  size: number;
  color?: string;
  onPress?: () => void;
  label?: string;
  active?: boolean;
  postId?: string;
  celebratePostId?: string | null;
  celebrateTick?: number;
  bubbleKey?: string;
  celebrateBubbleKey?: string | null;
  expirePostId?: string | null;
  expireTick?: number;
};

export default function Bubble({
  x,
  y,
  size,
  color,
  onPress,
  label,
  active,
  postId,
  celebratePostId,
  celebrateTick,
  bubbleKey,
  celebrateBubbleKey,
  expirePostId,
  expireTick,
}: BubbleProps) {
  const { colors } = useTheme();
  const bgColor = color || colors.surfaceAlpha;
  const borderColor = colors.border;
  const popScale = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const [removed, setRemoved] = useState(false);
  const shardsRef = useRef(
    Array.from({ length: 6 }).map(() => ({
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      rot: new Animated.Value(0),
      op: new Animated.Value(0),
    }))
  );

  useEffect(() => {
    const matched =
      celebratePostId &&
      postId &&
      celebratePostId === postId &&
      (!celebrateBubbleKey || (bubbleKey && celebrateBubbleKey === bubbleKey));
    if (matched) {
      // ring burst
      ringScale.setValue(0.6);
      ringOpacity.setValue(0.9);
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2.2,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(popScale, {
            toValue: 1.18,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.spring(popScale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 16,
            bounciness: 8,
          }),
        ]),
      ]).start();

      // shatter: fade content and emit shards, then remove
      contentOpacity.setValue(1);
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
      shardsRef.current.forEach((s, idx) => {
        s.tx.setValue(0);
        s.ty.setValue(0);
        s.rot.setValue(0);
        s.op.setValue(1);
        const angle =
          (Math.PI * 2 * idx) / shardsRef.current.length +
          (Math.random() - 0.5) * 0.6;
        const dist = size * (0.6 + Math.random() * 0.8);
        Animated.parallel([
          Animated.timing(s.tx, {
            toValue: Math.cos(angle) * dist,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(s.ty, {
            toValue: Math.sin(angle) * dist,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(s.rot, {
            toValue: (Math.random() - 0.5) * 3.5,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(s.op, {
            toValue: 0,
            duration: 520,
            useNativeDriver: true,
          }),
        ]).start();
      });
      // remove after shards animation
      setTimeout(() => setRemoved(true), 560);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateTick, celebratePostId, postId, celebrateBubbleKey, bubbleKey]);

  // Expire animation: use the same burst+shatter sequence as celebrate(10)
  useEffect(() => {
    const matched = expirePostId && postId && expirePostId === postId;
    if (matched) {
      // ring burst
      ringScale.setValue(0.6);
      ringOpacity.setValue(0.9);
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2.2,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(popScale, {
            toValue: 1.18,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.spring(popScale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 16,
            bounciness: 8,
          }),
        ]),
      ]).start();

      // shatter: fade content and emit shards, then remove
      contentOpacity.setValue(1);
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
      shardsRef.current.forEach((s, idx) => {
        s.tx.setValue(0);
        s.ty.setValue(0);
        s.rot.setValue(0);
        s.op.setValue(1);
        const angle =
          (Math.PI * 2 * idx) / shardsRef.current.length +
          (Math.random() - 0.5) * 0.6;
        const dist = size * (0.6 + Math.random() * 0.8);
        Animated.parallel([
          Animated.timing(s.tx, {
            toValue: Math.cos(angle) * dist,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(s.ty, {
            toValue: Math.sin(angle) * dist,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(s.rot, {
            toValue: (Math.random() - 0.5) * 3.5,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(s.op, {
            toValue: 0,
            duration: 520,
            useNativeDriver: true,
          }),
        ]).start();
      });
      // remove after shards animation
      setTimeout(() => setRemoved(true), 560);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expireTick, expirePostId, postId]);

  if (removed) {
    return null;
  }

  return (
    <Animated.View
      style={{
        position: 'absolute',
        transform: [
          { translateX: x },
          { translateY: y },
          { scale: popScale },
          { scale: active ? 1.04 : 1 },
        ],
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor,
        backgroundColor: bgColor,
      }}
    >
      {/* burst ring overlay */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: colors.pink,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />
      {/* shards */}
      {shardsRef.current.map((s, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: size / 2 - size * 0.12,
            top: size / 2 - size * 0.12,
            width: size * 0.24,
            height: size * 0.24,
            borderRadius: 6,
            backgroundColor: bgColor,
            opacity: s.op,
            transform: [
              { translateX: s.tx },
              { translateY: s.ty },
              {
                rotate: s.rot.interpolate({
                  inputRange: [-Math.PI, Math.PI],
                  outputRange: ['-180deg', '180deg'],
                }),
              },
            ],
            borderWidth: 1,
            borderColor,
          }}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} を開く` : '投稿を開く'}
        onPress={onPress}
        style={{ flex: 1, borderRadius: size / 2 }}
      >
        <BlurView intensity={30} tint="dark" style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
            {/* テーマ色の薄い被せで色味を明確化 */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: bgColor,
              }}
            />
            <LinearGradient
              colors={['#ffffff55', '#ffffff10', '#00000000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: size,
                height: size,
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: size * 0.12,
                top: size * 0.12,
                width: size * 0.22,
                height: size * 0.22,
                borderRadius: (size * 0.22) / 2,
                backgroundColor: '#ffffff55',
                opacity: 0.6,
              }}
            />
            {!!label && (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{
                    color: colors.text,
                    fontWeight: '700',
                    textAlign: 'center',
                  }}
                >
                  {label}
                </Text>
              </View>
            )}
          </Animated.View>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}
