import React from 'react';
import { View, Text, Pressable, Alert, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { useSubscription } from '../contexts/SubscriptionContext';

export default function ManageSubscriptionScreen({
  onBack,
}: {
  onBack?: () => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const { status, expiresAt, plan } = useSubscription();
  const insets = useSafeAreaInsets();

  const openAppleManage = async () => {
    const url = 'https://apps.apple.com/account/subscriptions';
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('エラー', 'サブスクリプション管理画面を開けませんでした。');
    }
  };

  const openGoogleManage = async () => {
    const url = 'https://play.google.com/store/account/subscriptions';
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('エラー', 'サブスクリプション管理画面を開けませんでした。');
    }
  };

  return (
    <View
      style={{
        padding: theme.spacing(2),
        paddingTop: (insets.top || 0) + theme.spacing(1),
        gap: theme.spacing(2),
      }}
    >
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
        サブスクリプション管理
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing(2),
          gap: 8,
        }}
      >
        <Text style={{ color: colors.subtext }}>プラン</Text>
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          {plan?.display_name || '未加入'}
        </Text>
        <Text style={{ color: colors.subtext }}>状態: {status || 'なし'}</Text>
        {expiresAt && (
          <Text style={{ color: colors.subtext }}>
            終了予定: {new Date(expiresAt).toLocaleString()}
          </Text>
        )}
      </View>
      {Platform.OS === 'ios' && (
        <Pressable
          accessibilityRole="button"
          onPress={openAppleManage}
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
            Appleで管理を開く
          </Text>
        </Pressable>
      )}
      {Platform.OS === 'android' && (
        <Pressable
          accessibilityRole="button"
          onPress={openGoogleManage}
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
            Googleで管理を開く
          </Text>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" onPress={onBack}>
        <Text style={{ color: colors.subtext, textAlign: 'center' }}>戻る</Text>
      </Pressable>
    </View>
  );
}
