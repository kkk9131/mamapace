import { View, Text, Pressable, Animated, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

export default function ProfileScreen({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  const rooms = [
    { id: 'r1', name: 'ねんね相談', members: 124 },
    { id: 'r2', name: 'ごはん/離乳食', members: 88 },
    { id: 'r3', name: '0-6ヶ月', members: 203 },
  ];
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', padding: theme.spacing(2), paddingTop: 40, opacity: fade }}>
      <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.75), backgroundColor: '#ffffff10' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 30 }}>👩‍🍼</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>ママネーム</Text>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>ママの一言プロフィール</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pill label={`フォロー 32`} onPress={() => onNavigate && onNavigate('following')} />
                <Pill label={`フォロワー 128`} onPress={() => onNavigate && onNavigate('followers')} />
              </View>
            </View>
          </View>
        </BlurView>
      </View>

      <View style={{ marginTop: theme.spacing(1.5), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
          <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 6 }}>プロフィール</Text>
          <Text style={{ color: colors.text, lineHeight: 20 }}>はじめまして。夜間授乳がんばり中。コーヒーと昼寝がご褒美。よろしくお願いします。</Text>
        </BlurView>
      </View>

      <View style={{ marginTop: theme.spacing(1.5), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(1), backgroundColor: '#ffffff10' }}>
          <View style={{ flexDirection: 'row' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing(1), gap: theme.spacing(1) }}>
              <Pill label="共感したポスト" onPress={() => onNavigate && onNavigate('liked')} />
              <Pill label="参加ルーム" onPress={() => onNavigate && onNavigate('roomsList')} />
            </ScrollView>
          </View>
        </BlurView>
      </View>

      <View style={{ marginTop: theme.spacing(1.5), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
          <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 8 }}>あなたのポスト</Text>
          {[{id:'m1', text:'今日は抱っこマン…腰が…'},{id:'m2', text:'ねんねトレーニング、少し成果でたかも'}].map(p => (
            <View key={p.id} style={{ paddingVertical: 10 }}>
              <Text style={{ color: colors.text }}>{p.text}</Text>
            </View>
          ))}
        </BlurView>
      </View>
    </Animated.View>
  );
}

function Pill({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: theme.spacing(1.25), borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
      <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.subtext, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
