import { View, Text, TextInput, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import * as Haptics from 'expo-haptics';

export default function CommentComposeScreen({ onClose }: { onClose?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 40, opacity: fade }}>
      <View style={{ paddingHorizontal: theme.spacing(2), marginBottom: theme.spacing(1.5) }}>
        <View style={{ borderRadius: 999, overflow: 'hidden' }}>
          <BlurView intensity={30} tint="dark" style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#ffffff10' }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>コメントを書く</Text>
          </BlurView>
        </View>
      </View>
      <View style={{ flex: 1, paddingHorizontal: theme.spacing(2) }}>
        <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
          <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
            <TextInput
              placeholder="気持ちをそっと届けよう…"
              placeholderTextColor={colors.subtext}
              multiline
              style={{ minHeight: 160, color: colors.text, fontSize: 16 }}
            />
          </BlurView>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 56, padding: theme.spacing(1.5), backgroundColor: colors.card, borderTopColor: '#22252B', borderTopWidth: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable onPress={async () => { await Haptics.selectionAsync(); onClose && onClose(); }} style={({ pressed }) => [{ backgroundColor: colors.surface, borderRadius: theme.radius.md, paddingVertical: 10, paddingHorizontal: theme.spacing(2), transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Text style={{ color: colors.text }}>キャンセル</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [{ backgroundColor: colors.pink, borderRadius: theme.radius.md, paddingVertical: 10, paddingHorizontal: theme.spacing(2), transform: [{ scale: pressed ? 0.97 : 1 }], ...theme.shadow.card }]}>
            <Text style={{ color: '#23181D', fontWeight: '700' }}>送信</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
