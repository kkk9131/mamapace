/**
 * EMOJI PICKER COMPONENT
 *
 * Avatar emoji selection with:
 * - Curated maternal health themed emojis
 * - Touch-friendly grid layout
 * - Selection feedback
 * - Accessibility support
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/theme';

interface EmojiPickerProps {
  /** Currently selected emoji */
  selectedEmoji?: string | null;
  /** Callback when emoji is selected */
  onEmojiSelect: (emoji: string) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Number of columns in grid */
  columns?: number;
}

// =====================================================
// EMOJI CATEGORIES
// =====================================================

/**
 * Curated emoji categories for maternal health app
 */
const EMOJI_CATEGORIES = {
  '母親・家族': [
    '👶',
    '🤱',
    '👩‍👶‍👶',
    '👨‍👩‍👧‍👦',
    '👪',
    '💕',
    '👩‍⚕️',
    '🤰',
    '👩',
    '👨',
    '👧',
    '👦',
    '👵',
    '👴',
    '👶🏻',
    '👶🏽',
  ],
  動物: [
    '🐱',
    '🐶',
    '🐼',
    '🐰',
    '🦄',
    '🐻',
    '🐸',
    '🐧',
    '🦋',
    '🐝',
    '🦊',
    '🐯',
    '🐨',
    '🐹',
    '🐵',
    '🦁',
  ],
  '自然・花': [
    '🌸',
    '🌺',
    '🌻',
    '🌷',
    '🌹',
    '💐',
    '🌿',
    '🍀',
    '🌙',
    '⭐',
    '☀️',
    '🌈',
    '🦋',
    '🌊',
    '🌳',
    '🌼',
  ],
  'ハート・愛情': [
    '💖',
    '💕',
    '💗',
    '💓',
    '💝',
    '💘',
    '💞',
    '💟',
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🤍',
    '🖤',
  ],
  食べ物: [
    '🍎',
    '🍓',
    '🥕',
    '🥛',
    '🍯',
    '🥗',
    '🫐',
    '🥑',
    '🍌',
    '🍊',
    '🥒',
    '🥦',
    '🧀',
    '🥖',
    '🍳',
    '🥪',
  ],
  'おもちゃ・遊び': [
    '🧸',
    '🎈',
    '🎀',
    '🎁',
    '🎊',
    '🎉',
    '🎨',
    '🎭',
    '⚽',
    '🏀',
    '🧩',
    '🎯',
    '🎪',
    '🎠',
    '🎡',
    '🎢',
  ],
} as const;

/**
 * Emoji picker component for avatar selection
 */
export default function EmojiPicker({
  selectedEmoji,
  onEmojiSelect,
  disabled = false,
  columns = 8,
}: EmojiPickerProps) {
  const theme = useTheme() as any;
  const { colors } = theme;

  const [activeCategory, setActiveCategory] = useState<string>(
    Object.keys(EMOJI_CATEGORIES)[0]
  );
  const [animation] = useState(new Animated.Value(0));

  // =====================================================
  // INTERACTION HANDLERS
  // =====================================================

  /**
   * Handles emoji selection with haptic feedback
   */
  const handleEmojiSelect = async (emoji: string) => {
    if (disabled) {
      return;
    }

    await Haptics.selectionAsync();
    onEmojiSelect(emoji);

    // Brief animation feedback
    Animated.sequence([
      Animated.timing(animation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * Handles category selection
   */
  const handleCategorySelect = async (category: string) => {
    if (disabled) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveCategory(category);
  };

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  /**
   * Renders category tabs
   */
  const renderCategoryTabs = () => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(1),
        }}
        style={{ marginBottom: theme.spacing(1) }}
      >
        {Object.keys(EMOJI_CATEGORIES).map(category => {
          const isActive = category === activeCategory;

          return (
            <Pressable
              key={category}
              onPress={() => handleCategorySelect(category)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: theme.spacing(1),
                  paddingVertical: theme.spacing(0.5),
                  marginHorizontal: 4,
                  borderRadius: theme.radius.sm,
                  backgroundColor: isActive
                    ? colors.pink + '30'
                    : pressed
                      ? colors.surface + '80'
                      : 'transparent',
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              disabled={disabled}
            >
              <Text
                style={{
                  color: isActive ? colors.pink : colors.subtext,
                  fontSize: 12,
                  fontWeight: isActive ? '700' : '500',
                  textAlign: 'center',
                }}
              >
                {category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  /**
   * Renders emoji grid
   */
  const renderEmojiGrid = () => {
    const categoryEmojis =
      EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES];
    const rows: string[][] = [];

    // Split emojis into rows
    for (let i = 0; i < categoryEmojis.length; i += columns) {
      rows.push(categoryEmojis.slice(i, i + columns));
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(1),
        }}
      >
        {rows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              marginBottom: theme.spacing(0.5),
            }}
          >
            {row.map(emoji => {
              const isSelected = emoji === selectedEmoji;

              return (
                <Pressable
                  key={emoji}
                  onPress={() => handleEmojiSelect(emoji)}
                  style={({ pressed }) => [
                    {
                      width: 44,
                      height: 44,
                      borderRadius: theme.radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected
                        ? colors.pink + '30'
                        : pressed
                          ? colors.surface
                          : 'transparent',
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: isSelected ? colors.pink : 'transparent',
                      transform: [{ scale: pressed ? 0.9 : 1 }],
                    },
                  ]}
                  disabled={disabled}
                >
                  <Text
                    style={{
                      fontSize: 24,
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    {emoji}
                  </Text>
                </Pressable>
              );
            })}

            {/* Fill remaining columns with empty spaces */}
            {Array.from({ length: columns - row.length }).map((_, index) => (
              <View key={`empty-${index}`} style={{ width: 44, height: 44 }} />
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <Animated.View
      style={{
        backgroundColor: colors.surface + '80',
        borderRadius: theme.radius.md,
        paddingVertical: theme.spacing(1),
        maxHeight: 300,
        transform: [
          {
            scale: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.02],
            }),
          },
        ],
      }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: theme.spacing(1),
          paddingBottom: theme.spacing(0.5),
          borderBottomWidth: 1,
          borderBottomColor: colors.surface,
          marginBottom: theme.spacing(0.5),
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          アバターを選択
        </Text>
        {selectedEmoji && (
          <Text
            style={{
              color: colors.subtext,
              fontSize: 12,
              textAlign: 'center',
              marginTop: 2,
            }}
          >
            選択中: {selectedEmoji}
          </Text>
        )}
      </View>

      {/* Category tabs */}
      {renderCategoryTabs()}

      {/* Emoji grid */}
      {renderEmojiGrid()}

      {/* Footer hint */}
      <View
        style={{
          paddingHorizontal: theme.spacing(1),
          paddingTop: theme.spacing(0.5),
          borderTopWidth: 1,
          borderTopColor: colors.surface,
          marginTop: theme.spacing(0.5),
        }}
      >
        <Text
          style={{
            color: colors.subtext,
            fontSize: 10,
            textAlign: 'center',
          }}
        >
          タップして選択 • 後で変更可能です
        </Text>
      </View>
    </Animated.View>
  );
}
