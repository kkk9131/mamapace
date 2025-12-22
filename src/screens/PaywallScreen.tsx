import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
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
  const { plan, purchase, restore, isPremium } = useSubscription();
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
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing(2),
        }}
      >
        <Text style={{ fontSize: 48, marginBottom: spacing(2) }}>✨</Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: '700',
            marginBottom: spacing(1),
          }}
        >
          プレミアム会員です
        </Text>
        <Text style={{ color: colors.subtext, textAlign: 'center' }}>
          すべての特典をご利用いただけます
        </Text>
        {onClose && (
          <Pressable
            onPress={onClose}
            style={{
              marginTop: spacing(3),
              paddingHorizontal: spacing(3),
              paddingVertical: spacing(1.5),
              backgroundColor: colors.surface,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>閉じる</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing(2),
        paddingTop: insets.top + spacing(1),
        paddingBottom: insets.bottom + spacing(4),
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

      {/* Terms */}
      <Text
        style={{
          color: colors.subtext,
          fontSize: 10,
          textAlign: 'center',
          marginTop: spacing(2),
          lineHeight: 16,
        }}
      >
        登録すると、利用規約とプライバシーポリシーに同意したことになります。
        サブスクリプションは自動更新されます。更新の24時間前までにキャンセルしない限り、
        同じ価格で自動的に更新されます。
      </Text>
    </ScrollView>
  );
}
