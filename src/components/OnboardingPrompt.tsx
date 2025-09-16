import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';

import { useTheme } from '../theme/theme';

type Props = {
  visible: boolean;
  onGoProfile: () => void;
  onGoTutorial: () => void;
  onSkip: () => void;
};

export default function OnboardingPrompt({
  visible,
  onGoProfile,
  onGoTutorial,
  onSkip,
}: Props) {
  const { colors } = useTheme();
  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 480,
            borderRadius: 12,
            padding: 20,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 8 }}>
            ようこそ！
          </Text>
          <Text style={{ color: colors.subtext, marginBottom: 16 }}>
            はじめに、プロフィールを整えたり、アプリの使い方を簡単にご案内します。
          </Text>

          <View style={{ gap: 10 }}>
            <Pressable
              onPress={onGoProfile}
              accessibilityRole="button"
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: colors.pink,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                プロフィールを設定する
              </Text>
            </Pressable>

            <Pressable
              onPress={onGoTutorial}
              accessibilityRole="button"
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: colors.cardAlpha,
                borderColor: colors.border,
                borderWidth: 1,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                使い方をみる（チュートリアル）
              </Text>
            </Pressable>

            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              style={{
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.subtext, fontWeight: '600' }}>
                今はスキップする
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
