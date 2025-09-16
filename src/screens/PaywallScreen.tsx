import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { subscriptionService } from '../services/subscriptionService';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';

export default function PaywallScreen({ onClose }: { onClose?: () => void }) {
  const theme = useTheme();
  const { colors } = theme;
  const { status, plan, purchase, restore } = useSubscription();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const premiumBenefits = useMemo(
    () => [
      'AIチャットの利用制限なし（無料版は1日3通まで）',
      'AIコメントをいつでもリクエスト可能（無料版は1日1回まで）',
      '非公開ルームの作成・参加が可能',
    ],
    [],
  );

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

  useEffect(() => {
    // no-op; plans are loaded by context
  }, []);

  const eligible = user?.maternal_verified;

  const handlePurchase = async () => {
    if (!plan) {
      return;
    }
    if (!eligible) {
      Alert.alert(
        '申込要件を満たしていません',
        '母子手帳認証バッジが必要です。設定またはプロフィールから認証を完了してください。',
      );
      return;
    }
    setLoading(true);
    try {
      const res = await purchase(plan.product_id || 'premium_monthly');
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
            月額で自動更新（いつでも管理から解約可能）。
          </Text>
          <View style={{ marginTop: theme.spacing(1), gap: theme.spacing(0.75) }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              プレミアムで解放される機能
            </Text>
            {premiumBenefits.map(item => (
              <Text key={item} style={{ color: colors.subtext }}>
                • {item}
              </Text>
            ))}
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
