import { View, Text, TextInput, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

export default function SignUpScreen({ onLogin }: { onLogin?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', padding: theme.spacing(2), paddingTop: 60, opacity: fade }}>
      <View style={{ alignItems: 'center', marginBottom: theme.spacing(2) }}>
        <Text style={{ color: colors.pink, fontSize: 28, fontWeight: '800' }}>Mamapace</Text>
      </View>
      <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.75), backgroundColor: '#ffffff10' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: theme.spacing(1) }}>新規登録</Text>
          <View style={{ gap: theme.spacing(1) }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing(1) }}>
              <TextInput placeholder="ユーザー名" placeholderTextColor={colors.subtext} style={{ color: colors.text, height: 44, fontSize: 16 }} />
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing(1) }}>
              <TextInput placeholder="母子手帳番号" placeholderTextColor={colors.subtext} style={{ color: colors.text, height: 44, fontSize: 16 }} />
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing(1) }}>
              <TextInput placeholder="パスワード" placeholderTextColor={colors.subtext} secureTextEntry style={{ color: colors.text, height: 44, fontSize: 16 }} />
            </View>
          </View>
          <Pressable style={({ pressed }) => [{ marginTop: theme.spacing(1.5), backgroundColor: colors.pink, borderRadius: theme.radius.md, paddingVertical: 12, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }], ...theme.shadow.card }]}>
            <Text style={{ color: '#23181D', fontWeight: '700' }}>登録</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing(1) }}>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>アカウントをお持ちですか？ </Text>
            <Pressable onPress={onLogin}>
              <Text style={{ color: colors.pink, fontSize: 12, fontWeight: '700' }}>ログイン</Text>
            </Pressable>
          </View>
        </BlurView>
      </View>
    </Animated.View>
  );
}
