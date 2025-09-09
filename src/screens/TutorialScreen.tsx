import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

export default function TutorialScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ fontWeight: '800', fontSize: 18 }}>使い方ガイド</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: colors.subtext }}>
          Mamapaceへようこそ。以下のポイントから始めるとスムーズです。
        </Text>
        <Text style={{}}>{'• プロフィールを設定して、他のユーザーに知ってもらいましょう。'}</Text>
        <Text style={{}}>{'• ホーム/ルームで投稿やコメントに参加しましょう。'}</Text>
        <Text style={{}}>{'• 通知タブで反応をキャッチ。'}</Text>
        <Text style={{}}>{'• あなたタブから自分の投稿を一覧できます。'}</Text>
        <Text style={{ color: colors.subtext }}>
          いつでも「あなた」タブ右上の設定から各種変更ができます。
        </Text>
      </ScrollView>
      <View style={{ padding: 16 }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={{
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: colors.pink,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>はじめる</Text>
        </Pressable>
      </View>
    </View>
  );
}

