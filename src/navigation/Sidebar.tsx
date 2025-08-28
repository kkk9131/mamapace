import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Dimensions, Image } from 'react-native';
import { useTheme } from '../theme/theme';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { BlurView } from 'expo-blur';

const W = Math.floor(Dimensions.get('window').width * 0.65);

export default function Sidebar({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (key: string) => void;
}) {
  const { colors, radius } = useTheme();
  const { handPreference } = useHandPreference();
  const theme = { radius } as any;
  const isLeft = handPreference === 'left';
  // 左手モード時は左端に表示、右手モード時は右端に表示
  const translate = useRef(new Animated.Value(isLeft ? -W : W)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState<string | null>(null);
  
  // handPreferenceが変更された時にアニメーション値をリセット
  useEffect(() => {
    translate.setValue(isLeft ? -W : W);
  }, [handPreference, isLeft]);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, {
        toValue: open ? 0 : (isLeft ? -W : W),
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: open ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open]);

  const dock = [
    { key: 'rooms', label: 'ルーム' },
    { key: 'chats', label: 'メッセージ' },
    { key: 'settings', label: '設定' },
  ];
  const channels: { key: string; label: string }[] = [];

  return (
    <>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          inset: 0 as any,
          backgroundColor: '#00000066',
          opacity: fade,
          zIndex: 10,
        }}
      >
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          ...(isLeft ? { left: 0 } : { right: 0 }),
          top: 0,
          bottom: 0,
          width: W,
          transform: [{ translateX: translate }],
          zIndex: 20,
        }}
      >
        <BlurView
          intensity={30}
          tint="dark"
          style={{
            flex: 1,
            paddingTop: 60,
            paddingHorizontal: 20,
            backgroundColor: '#101217AA',
            ...(isLeft ? {
              borderRightColor: '#22252B',
              borderRightWidth: 1,
            } : {
              borderLeftColor: '#22252B',
              borderLeftWidth: 1,
            }),
          }}
        >
          {/* App Icon Header - Clickable to go home */}
          <Pressable
            onPress={() => {
              setActive('home');
              onNavigate('home');
            }}
            style={({ pressed }) => ({
              alignItems: 'center', 
              marginBottom: 32,
              paddingBottom: 20,
              borderBottomWidth: 1,
              borderBottomColor: '#22252B',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Image 
              source={require('../../assets/mamapace-logo.png')}
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                marginBottom: 12,
              }}
              resizeMode="contain"
            />
            <Text style={{ 
              color: colors.text, 
              fontSize: 18, 
              fontWeight: '700',
              letterSpacing: 0.5
            }}>
              Mamapace
            </Text>
          </Pressable>

          {/* Navigation Items */}
          <View style={{ flex: 1 }}>
            {dock.map(it => (
              <Pressable
                key={it.key}
                accessibilityRole="button"
                accessibilityLabel={it.label}
                onPress={() => {
                  setActive(it.key);
                  onNavigate(it.key);
                }}
                style={({ pressed }) => [
                  {
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor:
                      active === it.key
                        ? '#ffffff20'
                        : pressed
                          ? '#ffffff10'
                          : 'transparent',
                    marginBottom: 8,
                  },
                ]}
              >
                <Text style={{ 
                  color: active === it.key ? colors.text : colors.subtext, 
                  fontSize: 15,
                  fontWeight: active === it.key ? '600' : '400'
                }}>
                  {it.label}
                </Text>
              </Pressable>
            ))}

            {/* Channels Section */}
            {channels.length > 0 && (
              <>
                <Text
                  style={{ 
                    color: colors.subtext, 
                    fontSize: 12, 
                    marginTop: 24,
                    marginBottom: 12,
                    paddingHorizontal: 16,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                  }}
                >
                  チャンネル
                </Text>
                {channels.map(ch => (
                  <Pressable
                    key={ch.key}
                    onPress={() => onNavigate(ch.key)}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 10,
                        backgroundColor: pressed ? '#ffffff10' : 'transparent',
                        marginBottom: 4,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>{ch.label}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>

          {/* Close Button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              {
                height: 48,
                justifyContent: 'center',
                backgroundColor: colors.surface,
                alignItems: 'center',
                borderRadius: theme.radius.md,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                marginBottom: 20,
              },
            ]}
          >
            <Text style={{ color: colors.pink, fontWeight: '700', fontSize: 15 }}>
              閉じる
            </Text>
          </Pressable>
        </BlurView>
      </Animated.View>
    </>
  );
}
