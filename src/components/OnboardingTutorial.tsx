import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

export default function OnboardingTutorial({ onClose }: { onClose: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;

  const Item = ({ emoji, title, desc }: { emoji: string; title: string; desc: string }) => (
    <View
      style={{
        backgroundColor: colors.cardAlpha,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        padding: theme.spacing(2),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{title}</Text>
      </View>
      <Text style={{ color: colors.subtext, lineHeight: 20 }}>{desc}</Text>
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel="アプリの使い方"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing(2),
      }}
    >
      <BlurView intensity={30} tint="dark" style={{ width: '100%', borderRadius: theme.radius.lg, overflow: 'hidden' }}>
        <View style={{ padding: theme.spacing(2) }}>
          <View style={{ marginBottom: theme.spacing(1.5), alignItems: 'center' }}>
            <Text style={{ color: colors.pink, fontWeight: '800', fontSize: 18 }}>Mamapace へようこそ</Text>
            <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}>安心・安全のためのポイント（1分で読めます）</Text>
          </View>

          <View style={{ gap: theme.spacing(1.5) }}>
            <Item
              emoji="🙊"
              title="愚痴ルームは完全匿名"
              desc="だれでも安心して吐き出せる場所。投稿は1時間で自動削除され、履歴に残りません。"
            />
            <Item
              emoji="🤚"
              title="“空き手”を設定して片手で使いやすく"
              desc="設定 ＞ 空き手 から右/左を選ぶと、ボタンの位置があなたに合わせて移動します。いつでも変更できます。"
            />
            <Item
              emoji="📚"
              title="サイドバーの開き方"
              desc="右利きはホーム、左利きはあなたのタブを長押しでサイドバーが開きます。ルームや設定に素早く移動できます。"
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: theme.spacing(2) }}>
            <Pressable
              onPress={onClose}
              accessibilityLabel="はじめる"
              style={({ pressed }) => [{
                backgroundColor: colors.pink,
                borderRadius: theme.radius.md,
                paddingVertical: 12,
                paddingHorizontal: 18,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              }]}
            >
              <Text style={{ color: '#1C1F25', fontWeight: '800' }}>はじめる</Text>
            </Pressable>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

