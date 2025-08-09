import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Dimensions } from 'react-native';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';

const W = Math.floor(Dimensions.get('window').width * 0.25);

export default function Sidebar({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (key: string) => void; }) {
  const { colors, radius } = useTheme();
  const theme = { radius } as any;
  const translate = useRef(new Animated.Value(-W)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: open ? 0 : -W, duration: 260, useNativeDriver: true }),
      Animated.timing(fade, { toValue: open ? 1 : 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [open]);

  const dock = [
    { key: 'home', label: 'ホーム', icon: '🏠' },
    { key: 'search', label: '検索', icon: '🔎' },
    { key: 'chats', label: 'チャット', icon: '💬' },
    { key: 'anon', label: '愚痴もたまには、、、', icon: '💭' },
    { key: 'createRoom', label: '作成', icon: '🆕' },
    { key: 'settings', label: '設定', icon: '⚙️' },
  ];
  const channels: { key: string; label: string }[] = [];

  return (
    <>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={{ position: 'absolute', inset: 0 as any, backgroundColor: '#00000066', opacity: fade, zIndex: 10 }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: W, transform: [{ translateX: translate }], zIndex: 20 }}>
        <BlurView intensity={30} tint="dark" style={{ flex: 1, paddingTop: 16, paddingHorizontal: 0, backgroundColor: '#101217AA', borderRightColor: '#22252B', borderRightWidth: 1, flexDirection: 'row' }}>
          <View style={{ width: 72, alignItems: 'center', paddingTop: 24 }}>
            {dock.map(it => (
              <Pressable key={it.key} accessibilityRole="button" accessibilityLabel={it.label} onPress={() => { setActive(it.key); onNavigate(it.key); }} style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 24, backgroundColor: active===it.key ? '#ffffff24' : pressed ? '#ffffff12' : '#ffffff10', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }]}>
                <Text style={{ fontSize: 20 }}>{it.icon}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1, paddingTop: 24, paddingHorizontal: 12 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 8 }}>チャンネル</Text>
            {channels.map(ch => (
              <Pressable key={ch.key} onPress={() => onNavigate(ch.key)} style={({ pressed }) => [{ paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, backgroundColor: pressed ? '#ffffff10' : 'transparent', marginBottom: 6 }]}>
                <Text style={{ color: colors.text }}>{ch.label}</Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} style={({ pressed }) => [{ height: 44, justifyContent: 'center', backgroundColor: colors.surface, alignItems: 'center', borderRadius: theme.radius.md, transform: [{ scale: pressed ? 0.98 : 1 }], marginHorizontal: 12, marginBottom: 12 }]}>
              <Text style={{ color: colors.pink, fontWeight: '700' }}>閉じる</Text>
            </Pressable>
          </View>
        </BlurView>
      </Animated.View>
    </>
  );
}
