import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { useSubscription } from '../contexts/SubscriptionContext';

const PREMIUM_BENEFITS = [
  { icon: '🤖', text: 'AIチャット無制限（無料: 1日5回まで）' },
  { icon: '💬', text: 'AIコメント無制限（無料: 1日3回まで）' },
  { icon: '🚫', text: '広告を完全非表示' },
  { icon: '🔒', text: '非公開ルームを作成可能' },
];

interface PaywallScreenProps {
  onClose?: () => void;
}

export default function PaywallScreen({ onClose }: PaywallScreenProps) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  const insets = useSafeAreaInsets();
  const { plan, subscription, purchase, restore, isPremium } = useSubscription();
  const [loading, setLoading] = useState(false);

  const priceDisplay = plan?.price_jpy
    ? `¥${plan.price_jpy.toLocaleString('ja-JP')}`
    : '¥500';

  const handlePurchase = async () => {
    if (!plan?.product_id_ios) {
      Alert.alert('エラー', 'プランが見つかりません');
      return;
    }

    setLoading(true);
    try {
      const result = await purchase(plan.product_id_ios);
      if (result.ok) {
        Alert.alert('完了', 'プレミアム会員になりました！', [
          { text: 'OK', onPress: onClose },
        ]);
      } else {
        Alert.alert('エラー', result.error || '購入に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const result = await restore();
      if (result.ok) {
        Alert.alert('完了', '購入を復元しました', [
          { text: 'OK', onPress: onClose },
        ]);
      } else {
        Alert.alert('エラー', result.error || '復元に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isPremium) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: spacing(2),
          paddingTop: insets.top + spacing(1),
          paddingBottom: insets.bottom + spacing(12),
        }}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: spacing(3) }}>
          <Text style={{ fontSize: 48, marginBottom: spacing(1) }}>👑</Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: '800',
            }}
          >
            プレミアム会員
          </Text>
          <Text style={{ color: colors.subtext, marginTop: spacing(0.5) }}>
            すべての特典をご利用中です
          </Text>
        </View>

        {/* Status Card */}
        <View
          style={{
            backgroundColor: colors.pink + '20',
            borderRadius: radius.lg,
            padding: spacing(2),
            marginBottom: spacing(3),
            borderWidth: 2,
            borderColor: colors.pink,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing(1) }}>
            <Text style={{ fontSize: 24, marginRight: spacing(1) }}>✨</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              有効なサブスクリプション
            </Text>
          </View>
          <Text style={{ color: colors.subtext }}>
            {subscription?.current_period_end
              ? `次回更新日: ${new Date(subscription.current_period_end).toLocaleDateString('ja-JP')}`
              : `プラン: ${plan?.display_name || 'ママプレミアム'}`}
          </Text>
        </View>

        {/* Benefits */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing(2),
            marginBottom: spacing(3),
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: '700',
              marginBottom: spacing(1.5),
            }}
          >
            ご利用中の特典
          </Text>
          {PREMIUM_BENEFITS.map((benefit, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing(1),
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.bg,
              }}
            >
              <Text style={{ fontSize: 20, marginRight: spacing(1) }}>
                {benefit.icon}
              </Text>
              <Text style={{ color: colors.text, flex: 1 }}>{benefit.text}</Text>
              <Text style={{ color: colors.pink, fontSize: 16 }}>✓</Text>
            </View>
          ))}
        </View>

        {/* Manage Subscription Button */}
        <Pressable
          onPress={async () => {
            try {
              await Linking.openURL('https://apps.apple.com/account/subscriptions');
            } catch (e) {
              Alert.alert('エラー', 'App Storeを開けませんでした');
            }
          }}
          style={({ pressed }) => ({
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            paddingVertical: spacing(1.5),
            alignItems: 'center',
            marginBottom: spacing(1.5),
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            サブスクリプションを管理
          </Text>
        </Pressable>

        {/* Close Button */}
        {onClose && (
          <Pressable
            onPress={onClose}
            style={{ alignItems: 'center', paddingVertical: spacing(1) }}
          >
            <Text style={{ color: colors.subtext }}>閉じる</Text>
          </Pressable>
        )}

        {/* Info */}
        <Text
          style={{
            color: colors.subtext,
            fontSize: 10,
            textAlign: 'center',
            marginTop: spacing(2),
            lineHeight: 16,
          }}
        >
          サブスクリプションの解約・変更はApp Storeの設定から行えます。
          更新の24時間前までにキャンセルしない限り、自動的に更新されます。
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing(2),
        paddingTop: insets.top + spacing(1),
        paddingBottom: insets.bottom + spacing(12),
      }}
    >
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: spacing(3) }}>
        <Text style={{ fontSize: 48, marginBottom: spacing(1) }}>👑</Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: '800',
          }}
        >
          ママプレミアム
        </Text>
        <Text style={{ color: colors.subtext, marginTop: spacing(0.5) }}>
          もっと便利に、もっと快適に
        </Text>
      </View>

      {/* Benefits */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing(2),
          marginBottom: spacing(3),
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 16,
            fontWeight: '700',
            marginBottom: spacing(1.5),
          }}
        >
          プレミアム特典
        </Text>
        {PREMIUM_BENEFITS.map((benefit, index) => (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing(1),
              borderTopWidth: index > 0 ? 1 : 0,
              borderTopColor: colors.bg,
            }}
          >
            <Text style={{ fontSize: 20, marginRight: spacing(1) }}>
              {benefit.icon}
            </Text>
            <Text style={{ color: colors.text, flex: 1 }}>{benefit.text}</Text>
          </View>
        ))}
      </View>

      {/* Price */}
      <View
        style={{
          backgroundColor: colors.pink + '20',
          borderRadius: radius.lg,
          padding: spacing(2),
          alignItems: 'center',
          marginBottom: spacing(3),
          borderWidth: 2,
          borderColor: colors.pink,
        }}
      >
        <Text style={{ color: colors.subtext, marginBottom: spacing(0.5) }}>
          月額
        </Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 36,
            fontWeight: '800',
          }}
        >
          {priceDisplay}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: spacing(0.5) }}>
          いつでもキャンセル可能
        </Text>
      </View>

      {/* Purchase Button */}
      <Pressable
        onPress={handlePurchase}
        disabled={loading}
        style={({ pressed }) => ({
          backgroundColor: loading ? colors.pink + '80' : colors.pink,
          borderRadius: radius.md,
          paddingVertical: spacing(2),
          alignItems: 'center',
          marginBottom: spacing(1.5),
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        {loading ? (
          <ActivityIndicator color="#23181D" />
        ) : (
          <Text style={{ color: '#23181D', fontSize: 18, fontWeight: '800' }}>
            プレミアムに登録する
          </Text>
        )}
      </Pressable>

      {/* Restore Button */}
      <Pressable
        onPress={handleRestore}
        disabled={loading}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingVertical: spacing(1.5),
          alignItems: 'center',
          marginBottom: spacing(2),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: colors.text, fontWeight: '600' }}>
          購入を復元する
        </Text>
      </Pressable>

      {/* Close Button */}
      {onClose && (
        <Pressable
          onPress={onClose}
          style={{ alignItems: 'center', paddingVertical: spacing(1) }}
        >
          <Text style={{ color: colors.subtext }}>あとで</Text>
        </Pressable>
      )}

      {/* Terms and Legal Links */}
      <View style={{ marginTop: spacing(2), alignItems: 'center' }}>
        <Text
          style={{
            color: colors.subtext,
            fontSize: 10,
            textAlign: 'center',
            lineHeight: 16,
          }}
        >
          登録すると、
          <Text
            style={{ color: colors.pink, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
          >
            利用規約
          </Text>
          と
          <Text
            style={{ color: colors.pink, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://mama-pace.com/privacy.html')}
          >
            プライバシーポリシー
          </Text>
          に同意したことになります。
        </Text>
        <Text
          style={{
            color: colors.subtext,
            fontSize: 10,
            textAlign: 'center',
            lineHeight: 16,
            marginTop: spacing(0.5),
          }}
        >
          サブスクリプションは自動更新されます。更新の24時間前までにキャンセルしない限り、
          同じ価格で自動的に更新されます。
        </Text>
      </View>
    </ScrollView>
  );
}
