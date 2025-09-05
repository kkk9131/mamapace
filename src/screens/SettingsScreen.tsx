import {
  View,
  Text,
  Switch,
  Pressable,
  Animated,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import OnboardingTutorial from '../components/OnboardingTutorial';
import { notificationPreferencesService } from '../services/notificationPreferencesService';
import { createBatchUpdater } from '../utils/batchUpdate';

export default function SettingsScreen({
  onLogoutNavigate,
}: {
  onLogoutNavigate?: () => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const fade = useRef(new Animated.Value(1)).current; // 初期値を1に設定してフラッシュを防ぐ
  const { logout, refreshToken, user } = useAuth();
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
          <Section title="通知" collapsible initialOpen>
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
        </View>
      </ScrollView>
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
