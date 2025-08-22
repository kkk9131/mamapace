import { View, Text, Switch, Pressable, Animated, Alert, Image } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';

export default function SettingsScreen({
  onLogoutNavigate,
}: {
  onLogoutNavigate?: () => void;
}) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = useRef(new Animated.Value(1)).current; // 初期値を1に設定してフラッシュを防ぐ
  const { logout, refreshToken } = useAuth();
  const { handPreference, setHandPreference } = useHandPreference();

  const Section = ({ title, children }: any) => (
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
        <Text
          style={{
            color: colors.subtext,
            fontSize: 12,
            marginBottom: theme.spacing(1),
          }}
        >
          {title}
        </Text>
        {children}
      </BlurView>
    </View>
  );

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
      {/* Header with Mamapace Icon */}
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
            <Text style={{ 
              color: colors.text, 
              fontSize: 20, 
              fontWeight: '700',
              letterSpacing: 0.5
            }}>
              Mamapace
            </Text>
            <Text style={{ 
              color: colors.subtext, 
              fontSize: 14,
              textAlign: 'center',
              marginTop: 4
            }}>
              設定
            </Text>
          </BlurView>
        </View>
      </View>

      <View
        style={{ gap: theme.spacing(1.25), paddingBottom: theme.spacing(6) }}
      >


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
        <View style={{ height: theme.spacing(4) }} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: theme.spacing(2),
          right: theme.spacing(2),
          bottom: 72,
        }}
      >

        <Pressable
          onPress={() => {
            Alert.alert('確認', '本当にログアウトしますか？', [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: 'ログアウト',
                style: 'destructive',
                onPress: () => {
                  // 実際のログアウト処理（コンテキスト）
                  logout();
                  // 追加のナビゲーションが必要なら呼び出し側で実装
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
      </View>
    </Animated.View>
  );
}

function Toggle({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const theme = useTheme() as any;
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
