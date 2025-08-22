import React, { useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';
import { useHandPreference } from '../contexts/HandPreferenceContext';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { setHandPreference } = useHandPreference();
  const [currentStep, setCurrentStep] = useState(0);
  const fade = new Animated.Value(1);

  const handleHandSelection = (hand: 'left' | 'right') => {
    setHandPreference(hand);
    
    // フェードアウト後に完了
    Animated.timing(fade, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onComplete();
    });
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: 'transparent',
        padding: theme.spacing(2),
        paddingTop: 60,
        opacity: fade,
        justifyContent: 'center',
      }}
    >
      {/* アプリタイトル */}
      <View
        style={{
          alignItems: 'center',
          marginBottom: theme.spacing(6),
        }}
      >
        <Text style={{ 
          color: colors.pink, 
          fontSize: 32, 
          fontWeight: '800',
          marginBottom: theme.spacing(1),
        }}>
          Mamapace
        </Text>
        <Text style={{ 
          color: colors.subtext, 
          fontSize: 16,
          textAlign: 'center',
        }}>
          育児中のママのための{'\n'}安心・安全なSNS
        </Text>
      </View>

      {/* 手の設定質問 */}
      <View
        style={{
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          marginBottom: theme.spacing(4),
          ...theme.shadow.card,
        }}
      >
        <BlurView
          intensity={30}
          tint="dark"
          style={{ 
            padding: theme.spacing(3), 
            backgroundColor: '#ffffff10' 
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: '700',
              marginBottom: theme.spacing(2),
              textAlign: 'center',
            }}
          >
            育児中によく空いている手は？
          </Text>
          <Text
            style={{
              color: colors.subtext,
              fontSize: 14,
              marginBottom: theme.spacing(3),
              textAlign: 'center',
            }}
          >
            よく使う手に合わせてボタンの配置を{'\n'}最適化します
          </Text>
          
          <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
            <Pressable
              onPress={() => handleHandSelection('left')}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: colors.surface,
                  paddingVertical: theme.spacing(2),
                  paddingHorizontal: theme.spacing(1.5),
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadow.card,
                },
              ]}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🤚</Text>
              <Text style={{ 
                color: colors.text, 
                fontWeight: '700',
                fontSize: 16,
              }}>
                左手
              </Text>
              <Text style={{ 
                color: colors.subtext, 
                fontSize: 12,
                textAlign: 'center',
                marginTop: 4,
              }}>
                右手で抱っこ
              </Text>
            </Pressable>
            
            <Pressable
              onPress={() => handleHandSelection('right')}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: colors.surface,
                  paddingVertical: theme.spacing(2),
                  paddingHorizontal: theme.spacing(1.5),
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadow.card,
                },
              ]}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>✋</Text>
              <Text style={{ 
                color: colors.text, 
                fontWeight: '700',
                fontSize: 16,
              }}>
                右手
              </Text>
              <Text style={{ 
                color: colors.subtext, 
                fontSize: 12,
                textAlign: 'center',
                marginTop: 4,
              }}>
                左手で抱っこ
              </Text>
            </Pressable>
          </View>
        </BlurView>
      </View>

      {/* 説明 */}
      <Text
        style={{
          color: colors.subtext,
          fontSize: 12,
          textAlign: 'center',
          marginTop: theme.spacing(2),
        }}
      >
        後で設定画面から変更できます
      </Text>
    </Animated.View>
  );
}