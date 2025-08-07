import { View, Text, Switch, Pressable, Animated, Alert } from 'react-native';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';

export default function SettingsScreen({ onLogoutNavigate }: { onLogoutNavigate?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  const Section = ({ title, children }: any) => (
    <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
      <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
        <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: theme.spacing(1) }}>{title}</Text>
        {children}
      </BlurView>
    </View>
  );

  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', padding: theme.spacing(2), paddingTop: 40, opacity: fade }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing(2) }}>
        <Text style={{ color: colors.pink, fontSize: 24, fontWeight: '800' }}>Mamapace</Text>
      </View>

      <View style={{ gap: theme.spacing(1.25), paddingBottom: theme.spacing(6) }}>
        <Section title="プロフィール">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 24 }}>👩‍🍼</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>ママネーム</Text>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>安心・安全の設定</Text>
            </View>
            <Pressable style={({ pressed }) => [{ backgroundColor: colors.pink, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing(1.25), paddingVertical: 8, transform: [{ scale: pressed ? 0.97 : 1 }], ...theme.shadow.card }]}>
              <Text style={{ color: '#23181D', fontWeight: '700' }}>編集</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="表示">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text }}>ダークモード</Text>
            <Switch value={true} onValueChange={() => {}} />
          </View>
        </Section>

        <Section title="空き手">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Toggle label="左" active />
            <Toggle label="右" />
          </View>
        </Section>
        <View style={{ height: theme.spacing(4) }} />
      </View>
      <View style={{ position: 'absolute', left: theme.spacing(2), right: theme.spacing(2), bottom: 72 }}>
        <Pressable onPress={() => { Alert.alert('確認','本当にログアウトしますか？',[{ text:'キャンセル', style:'cancel' },{ text:'ログアウト', style:'destructive', onPress: () => onLogoutNavigate && onLogoutNavigate() }]); }} style={({ pressed }) => [{ backgroundColor: colors.surface, borderRadius: theme.radius.md, paddingVertical: 12, alignItems: 'center', transform: [{ scale: pressed ? 0.98 : 1 }], ...theme.shadow.card }]}> 
          <Text style={{ color: colors.danger, fontWeight: '700' }}>ログアウト</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function Toggle({ label, active }: { label: string; active?: boolean }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  return (
    <Pressable style={({ pressed }) => [{ backgroundColor: active ? colors.pink : colors.surface, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
      <Text style={{ color: active ? '#23181D' : colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
