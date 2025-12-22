import {
  View,
  Text,
  Switch,
  Pressable,
  Animated,
  Alert,
  Image,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import OnboardingTutorial from '../components/OnboardingTutorial';
import { notificationPreferencesService } from '../services/notificationPreferencesService';
import { createBatchUpdater } from '../utils/batchUpdate';
import { accountDeletionService } from '../services/accountDeletionService';

export default function SettingsScreen({
  onLogoutNavigate,
  onOpenBlockedUsers,
  onOpenPaywall,
}: {
  onLogoutNavigate?: () => void;
  onOpenBlockedUsers?: () => void;
  onOpenPaywall?: () => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const fade = useRef(new Animated.Value(1)).current; // 初期値を1に設定してフラッシュを防ぐ
  const { logout, refreshToken, user } = useAuth();
  const { isPremium, plan, subscription, restore } = useSubscription();
  const [restoring, setRestoring] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [prefs, setPrefs] = useState({
    allow_message: true,
    allow_room: true,
    allow_like: true,
    allow_comment: true,
    allow_follow: true,
    allow_system: true,
  });
  const updaterRef = useRef(
    createBatchUpdater<typeof prefs>(
      patch =>
        user?.id
          ? notificationPreferencesService.update(user.id, patch as any)
          : Promise.resolve(false),
      300
    ),
  );

  useEffect(() => {
    (async () => {
      if (!user?.id) {
        return;
      }
      const p = await notificationPreferencesService.get(user.id);
      setPrefs(p as any);
    })();
  }, [user?.id]);

  useEffect(() => {
    return () => {
      // Best-effort flush on unmount
      updaterRef.current.flushNow();
    };
  }, []);

  const setPref = async (key: keyof typeof prefs, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    updaterRef.current.set(key, value);
  };
  const { handPreference, setHandPreference } = useHandPreference();
  const insets = useSafeAreaInsets();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const Section = ({
    title,
    children,
    collapsible = false,
    initialOpen = true,
  }: any) => {
    const [open, setOpen] = useState(initialOpen);
    return (
      <View
        style={{
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          ...theme.shadow.card,
        }}
      >
        <BlurView
          intensity={30}
          tint="dark"
          style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}
        >
          <Pressable
            onPress={() => collapsible && setOpen(o => !o)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing(1),
            }}
          >
            <Text
              style={{
                color: colors.subtext,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.3,
              }}
            >
              {title}
            </Text>
            {collapsible && (
              <Text style={{ color: colors.subtext, fontSize: 16 }}>
                {open ? '▾' : '▸'}
              </Text>
            )}
          </Pressable>
          {(!collapsible || open) && children}
        </BlurView>
      </View>
    );
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: 'transparent',
        padding: theme.spacing(2),
        paddingTop: 40,
        opacity: fade,
      }}
    >
      {showHelp && <OnboardingTutorial onClose={() => setShowHelp(false)} />}
      {/* Header with Mamapace Icon */}
      <ScrollView
        contentContainerStyle={{
          paddingBottom: (insets.bottom || 0) + 56 + theme.spacing(6),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            alignItems: 'center',
            marginBottom: theme.spacing(4),
            paddingVertical: theme.spacing(2),
          }}
        >
          <View
            style={{
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              ...theme.shadow.card,
              marginBottom: theme.spacing(2),
            }}
          >
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                backgroundColor: '#ffffff10',
                padding: theme.spacing(3),
                alignItems: 'center',
              }}
            >
              <Image
                source={require('../../assets/mamapace-logo.png')}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  marginBottom: theme.spacing(1.5),
                }}
                resizeMode="contain"
              />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 20,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                }}
              >
                Mamapace
              </Text>
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 14,
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                設定
              </Text>
            </BlurView>
          </View>
        </View>

        <View style={{ gap: theme.spacing(1.25) }}>
          {/* Premium Section */}
          <Section title="プレミアム">
            {isPremium ? (
              <View style={{ gap: theme.spacing(1) }}>
                <View
                  style={{
                    backgroundColor: colors.pink + '20',
                    borderRadius: theme.radius.md,
                    padding: theme.spacing(1.5),
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.pink,
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: theme.spacing(1) }}>👑</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      プレミアム会員
                    </Text>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      {subscription?.current_period_end
                        ? `次回更新: ${new Date(subscription.current_period_end).toLocaleDateString('ja-JP')}`
                        : 'すべての特典をご利用中'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    try {
                      // App Storeのサブスクリプション管理ページを開く
                      await Linking.openURL('https://apps.apple.com/account/subscriptions');
                    } catch (e) {
                      Alert.alert('エラー', 'App Storeを開けませんでした');
                    }
                  }}
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
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    サブスクリプションを管理
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: theme.spacing(1) }}>
                <Pressable
                  onPress={() => onOpenPaywall && onOpenPaywall()}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.pink,
                      borderRadius: theme.radius.md,
                      paddingVertical: 14,
                      paddingHorizontal: theme.spacing(1.5),
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      ...theme.shadow.card,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20, marginRight: 8 }}>👑</Text>
                  <View>
                    <Text style={{ color: '#23181D', fontWeight: '800', fontSize: 16 }}>
                      ママプレミアムに登録
                    </Text>
                    <Text style={{ color: '#23181D', fontSize: 12, opacity: 0.8 }}>
                      ¥{plan?.price_jpy?.toLocaleString() || '500'}/月 • AI無制限 • 広告なし
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    if (restoring) return;
                    setRestoring(true);
                    try {
                      const result = await restore();
                      if (result.ok) {
                        Alert.alert('復元完了', '購入が復元されました');
                      } else {
                        Alert.alert('復元できませんでした', result.error || '購入履歴が見つかりません');
                      }
                    } catch (e: any) {
                      Alert.alert('エラー', e?.message || '復元に失敗しました');
                    } finally {
                      setRestoring(false);
                    }
                  }}
                  disabled={restoring}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      borderRadius: theme.radius.md,
                      paddingVertical: 12,
                      alignItems: 'center',
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      opacity: restoring ? 0.6 : 1,
                    },
                  ]}
                >
                  {restoring ? (
                    <ActivityIndicator color={colors.text} size="small" />
                  ) : (
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      購入を復元
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </Section>
          <View style={{ height: theme.spacing(2) }} />

          <Section title="通知" collapsible initialOpen={false}>
            <View style={{ gap: 8 }}>
              <ToggleRow
                label="メッセージ"
                value={prefs.allow_message}
                onValueChange={(v: boolean) => setPref('allow_message', v)}
              />
              <ToggleRow
                label="ルーム投稿"
                value={prefs.allow_room}
                onValueChange={(v: boolean) => setPref('allow_room', v)}
              />
              <ToggleRow
                label="コメント"
                value={prefs.allow_comment}
                onValueChange={(v: boolean) => setPref('allow_comment', v)}
              />
              <ToggleRow
                label="共感"
                value={prefs.allow_like}
                onValueChange={(v: boolean) => setPref('allow_like', v)}
              />
              <ToggleRow
                label="フォロー"
                value={prefs.allow_follow}
                onValueChange={(v: boolean) => setPref('allow_follow', v)}
              />
              <ToggleRow
                label="システム"
                value={prefs.allow_system}
                onValueChange={(v: boolean) => setPref('allow_system', v)}
              />
            </View>
          </Section>
          <View style={{ height: theme.spacing(2) }} />

          <Section title="空き手">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Toggle
                label="左"
                active={handPreference === 'left'}
                onPress={() => setHandPreference('left')}
              />
              <Toggle
                label="右"
                active={handPreference === 'right'}
                onPress={() => setHandPreference('right')}
              />
            </View>
          </Section>
          <View style={{ height: theme.spacing(2) }} />

          <Section title="ヘルプ">
            <Pressable
              onPress={() => setShowHelp(true)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: theme.radius.md,
                  paddingVertical: 12,
                  alignItems: 'center',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadow.card,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                使い方を見る（チュートリアル）
              </Text>
            </Pressable>
          </Section>
          <View style={{ height: theme.spacing(4) }} />

          <Section title="プライバシー">
            <Pressable
              onPress={() => onOpenBlockedUsers && onOpenBlockedUsers()}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: theme.radius.md,
                  paddingVertical: 12,
                  alignItems: 'center',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadow.card,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                ブロックしたユーザーを管理
              </Text>
            </Pressable>

            <View style={{ height: theme.spacing(1) }} />

            <Pressable
              onPress={async () => {
                try {
                  const url =
                    'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
                  await Linking.openURL(url);
                } catch (e) {
                  Alert.alert('エラー', 'リンクの起動に失敗しました');
                }
              }}
              accessibilityLabel="利用規約を開く"
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: theme.radius.md,
                  paddingVertical: 12,
                  alignItems: 'center',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadow.card,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                利用規約
              </Text>
            </Pressable>

            <View style={{ height: theme.spacing(1) }} />

            <Pressable
              onPress={async () => {
                try {
                  const url = 'https://mama-pace.com/privacy.html';
                  await Linking.openURL(url);
                } catch (e) {
                  Alert.alert('エラー', 'リンクの起動に失敗しました');
                }
              }}
              accessibilityLabel="プライバシーポリシーを開く"
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: theme.radius.md,
                  paddingVertical: 12,
                  alignItems: 'center',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadow.card,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                プライバシーポリシー
              </Text>
            </Pressable>
          </Section>
          <View style={{ height: theme.spacing(4) }} />

          {/* Logout button (scrolls with content) */}
          <Pressable
            onPress={() => {
              Alert.alert('確認', '本当にログアウトしますか？', [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: 'ログアウト',
                  style: 'destructive',
                  onPress: () => {
                    logout();
                    onLogoutNavigate && onLogoutNavigate();
                  },
                },
              ]);
            }}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: theme.radius.md,
                paddingVertical: 12,
                alignItems: 'center',
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.shadow.card,
              },
            ]}
          >
            <Text style={{ color: colors.danger, fontWeight: '700' }}>
              ログアウト
            </Text>
          </Pressable>
          <View style={{ height: theme.spacing(2) }} />
          {/* Danger zone: Delete account */}
          <Pressable
            onPress={() => setDeleteOpen(true)}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: theme.radius.md,
                paddingVertical: 12,
                alignItems: 'center',
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.shadow.card,
              },
            ]}
          >
            <Text style={{ color: colors.danger, fontWeight: '700' }}>
              アカウントを削除
            </Text>
          </Pressable>
          <View style={{ height: theme.spacing(2) }} />
        </View>
      </ScrollView>
      {/* Delete Account Modal */}
      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !deleteLoading && setDeleteOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#00000088',
            justifyContent: 'center',
            padding: theme.spacing(2),
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing(2),
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}
            >
              アカウント削除
            </Text>
            <Text
              style={{
                color: colors.subtext,
                marginTop: 8,
                lineHeight: 18,
              }}
            >
              この操作は取り消せません。投稿、メッセージ、フォローなど全てのデータが完全に削除されます。続行するにはパスワードを入力してください。
            </Text>

            <View style={{ height: theme.spacing(1.5) }} />
            <Text
              style={{ color: colors.text, fontWeight: '600', marginBottom: 6 }}
            >
              パスワード
            </Text>
            <TextInput
              value={deletePassword}
              onChangeText={t => {
                setDeletePassword(t);
                if (deleteError) {
                  setDeleteError(null);
                }
              }}
              secureTextEntry
              placeholder="現在のパスワード"
              placeholderTextColor="#999"
              editable={!deleteLoading}
              style={{
                backgroundColor: '#00000010',
                color: colors.text,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: theme.radius.md,
              }}
            />

            {deleteError ? (
              <Text style={{ color: colors.danger, marginTop: 8 }}>
                {deleteError}
              </Text>
            ) : null}

            <View style={{ height: theme.spacing(2) }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => !deleteLoading && setDeleteOpen(false)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: '#00000020',
                    borderRadius: theme.radius.md,
                    paddingVertical: 12,
                    alignItems: 'center',
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                disabled={deleteLoading}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  キャンセル
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  if (!deletePassword.trim()) {
                    setDeleteError('パスワードを入力してください');
                    return;
                  }
                  setDeleteLoading(true);
                  setDeleteError(null);
                  try {
                    await accountDeletionService.deleteMyAccount(
                      deletePassword,
                    );
                    await logout();
                    setDeleteOpen(false);
                    onLogoutNavigate && onLogoutNavigate();
                  } catch (e: any) {
                    setDeleteError(e?.message || '削除に失敗しました');
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: '#ff5a5f',
                    borderRadius: theme.radius.md,
                    paddingVertical: 12,
                    alignItems: 'center',
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                    opacity: deleteLoading ? 0.8 : 1,
                  },
                ]}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    完全に削除する
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

function Toggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: active ? colors.pink : colors.surface,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text
        style={{ color: active ? '#23181D' : colors.text, fontWeight: '700' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: theme.radius.md,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? colors.pink : '#888'}
      />
    </View>
  );
}
