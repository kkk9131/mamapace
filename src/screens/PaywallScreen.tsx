import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';

const PREMIUM_BENEFITS = [
  'AIチャットの利用制限なし（無料版は1日3通まで）',
  'AIコメントをいつでもリクエスト可能（無料版は1日1回まで）',
  '非公開ルームの作成・参加が可能',
];

export default function PaywallScreen({ onClose }: { onClose?: () => void }) {
  const theme = useTheme();
  const { colors } = theme;
  const { plan, purchase, restore } = useSubscription();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const priceDisplay = useMemo(() => {
    if (!plan || !plan.price_cents || plan.price_cents <= 0) {
      return '—';
    }
    try {
      // JPY: minor unit is 1 (no decimals)
      return `¥${Number(plan.price_cents).toLocaleString('ja-JP')} / 月`;
    } catch {
      return `¥${plan.price_cents} / 月`;
    }
  }, [plan]);

  const eligible = user?.maternal_verified;

  const handlePurchase = async () => {
    if (!plan) {
      return;
    }
    if (!eligible) {
      Alert.alert(
        '申込要件を満たしていません',
        '母子手帳認証バッジが必要です。設定またはプロフィールから認証を完了してください。'
      );
      return;
    }
    setLoading(true);
    try {
      const res = await purchase(plan?.product_id);
      if (!res.ok) {
        Alert.alert('購入エラー', res.error || '不明なエラー');
      } else {
        Alert.alert('完了', '購入処理を受け付けました');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const res = await restore();
      if (!res.ok) {
        Alert.alert('復元エラー', res.error || '不明なエラー');
      } else {
        Alert.alert('完了', '購入の復元を実行しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: theme.spacing(2),
        paddingTop: (insets.top || 0) + theme.spacing(1),
        paddingBottom: theme.spacing(8),
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: theme.spacing(2) }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
          プレミアム（月額）
        </Text>
        <Text style={{ color: colors.subtext }}>
          月額プラン。いつでもキャンセルできます。
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: theme.radius.lg,
            padding: theme.spacing(2),
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>価格</Text>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
            {priceDisplay}
          </Text>
          <Text style={{ color: colors.subtext }}>
            期間: 1か月（自動更新）。
          </Text>
          <Text style={{ color: colors.subtext }}>
            価格: 表示価格は月額（税込）。
          </Text>
          <Text style={{ color: colors.subtext }}>
            自動更新: 更新日の24時間前までに解約しない限り自動更新されます。
          </Text>
          <Text style={{ color: colors.subtext }}>
            管理/解約: 購入後はデバイスのアカウント設定（App
            Storeの「サブスクリプション」）から いつでも管理・解約できます。
          </Text>
          <View
            style={{
              marginTop: theme.spacing(1),
              gap: theme.spacing(0.75),
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              プレミアムで解放される機能
            </Text>
            {PREMIUM_BENEFITS.map(item => (
              <Text key={item} style={{ color: colors.subtext }}>
                • {item}
              </Text>
            ))}
          </View>
        </View>
        {/* 必須の機能リンク（EULA/プライバシー） */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: theme.radius.md,
            padding: theme.spacing(1.25),
            gap: 8,
          }}
        >
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            お申し込みにより、以下に同意したものとみなされます：
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apple標準EULAを開く"
              onPress={async () => {
                try {
                  await Linking.openURL(
                    'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
                  );
                } catch {
                  Alert.alert('エラー', 'リンクの起動に失敗しました');
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text
                style={{ color: colors.pink, textDecorationLine: 'underline' }}
              >
                利用規約（EULA）
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="プライバシーポリシーを開く"
              onPress={async () => {
                try {
                  await Linking.openURL('https://mama-pace.com/privacy.html');
                } catch {
                  Alert.alert('エラー', 'リンクの起動に失敗しました');
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text
                style={{ color: colors.pink, textDecorationLine: 'underline' }}
              >
                プライバシーポリシー
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handlePurchase}
          disabled={loading || !eligible}
          style={({ pressed }) => [
            {
              backgroundColor: colors.pink,
              borderRadius: theme.radius.md,
              paddingVertical: 14,
              alignItems: 'center',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={{ color: '#23181D', fontWeight: '800' }}>購入する</Text>
        </Pressable>
        {!eligible && (
          <Text style={{ color: colors.subtext, textAlign: 'center' }}>
            母子手帳認証バッジをお持ちの方のみ申し込み可能です。
          </Text>
        )}
        <Text
          style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}
        >
          購入代金はApple IDに請求されます。利用規約（EULA）とプライバシー
          ポリシーに同意のうえお申し込みください。
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={handleRestore}
          disabled={loading}
          style={({ pressed }) => [
            {
              backgroundColor: colors.surface,
              borderRadius: theme.radius.md,
              paddingVertical: 12,
              alignItems: 'center',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            購入を復元
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            {
              alignItems: 'center',
              paddingVertical: 8,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.subtext }}>閉じる</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
