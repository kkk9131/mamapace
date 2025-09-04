import { useState } from 'react';
import { View, Text, Pressable, TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../theme/theme';
import { useHandPreference } from '../contexts/HandPreferenceContext';

interface ExpandableTextProps {
  /**
   * The text content to display
   */
  text?: string | null;
  /**
   * Maximum number of lines to show when collapsed (default: 3)
   */
  maxLines?: number;
  /**
   * Minimum text length threshold to show expand button (default: 120)
   */
  minLengthToExpand?: number;
  /**
   * Style for the text component
   */
  textStyle?: TextStyle;
  /**
   * Style for the container view
   */
  containerStyle?: ViewStyle;
  /**
   * Custom text for the expand button (default: 'もっと見る')
   */
  expandText?: string;
  /**
   * Custom text for the collapse button (default: '閉じる')
   */
  collapseText?: string;
  /**
   * Callback when expand/collapse state changes
   */
  onExpandChange?: (expanded: boolean) => void;
  /**
   * Custom accessibility label for expand action
   */
  expandAccessibilityLabel?: string;
  /**
   * Custom accessibility label for collapse action
   */
  collapseAccessibilityLabel?: string;
}

export default function ExpandableText({
  text,
  maxLines = 3,
  minLengthToExpand = 120,
  textStyle,
  containerStyle,
  expandText = 'もっと見る',
  collapseText = '閉じる',
  onExpandChange,
  expandAccessibilityLabel = '本文をもっと見る',
  collapseAccessibilityLabel = '本文を閉じる',
}: ExpandableTextProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { handPreference } = useHandPreference();
  const [expanded, setExpanded] = useState(false);

  // Handle null or undefined text
  const safeText = text || '';
  
  // Determine if text is long enough to show expand button
  const isLongText = safeText.length > minLengthToExpand;

  const handleToggleExpand = (): void => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onExpandChange?.(newExpanded);
  };

  const defaultTextStyle: TextStyle = {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  };

  const buttonStyle = ({ pressed }: { pressed: boolean }) => [
    {
      alignSelf: handPreference === 'right' ? 'flex-end' : 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      marginTop: theme.spacing(1),
      transform: [{ scale: pressed ? 0.96 : 1 }],
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      minHeight: 32,
      justifyContent: 'center' as const,
    },
  ];

  return (
    <View style={containerStyle}>
      <Text
        style={[defaultTextStyle, textStyle]}
        numberOfLines={expanded ? undefined : maxLines}
      >
        {safeText}
      </Text>
      {isLongText && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? collapseAccessibilityLabel : expandAccessibilityLabel
          }
          onPress={handleToggleExpand}
          style={buttonStyle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={{
              color: colors.pink,
              fontWeight: '700',
              fontSize: 14,
            }}
          >
            {expanded ? collapseText : expandText}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
