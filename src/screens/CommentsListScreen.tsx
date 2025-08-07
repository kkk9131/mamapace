import { View, Text, FlatList, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

const comments = [
  { id: 'ai', user: 'ママの味方', body: '小さな一歩、えらい！', time: 'AI' },
  { id: 'c1', user: '匿名', body: 'わかります…無理しないで…', time: '5m' },
];

export default function CommentsListScreen({ onCompose }: { onCompose?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 40, opacity: fade }}>
      <View style={{ paddingHorizontal: theme.spacing(2), marginBottom: theme.spacing(1.25) }}>
        <View style={{ borderRadius: 999, overflow: 'hidden' }}>
          <BlurView intensity={30} tint="dark" style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#ffffff10' }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>コメント</Text>
          </BlurView>
        </View>
      </View>
      <FlatList
        data={comments}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(10) }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
        renderItem={({ item }) => (
          <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
            <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.25), backgroundColor: item.user==='ママの味方' ? '#F6C6D022' : '#ffffff10' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: item.user==='ママの味方' ? colors.pink : colors.subtext, fontSize: 12 }}>{item.user} ・ {item.time}</Text>

              </View>
              <Text style={{ color: colors.text }}>{item.body}</Text>
            </BlurView>
          </View>
        )}
      />
      {onCompose && (
        <Pressable onPress={onCompose} style={({ pressed }) => [{ position: 'absolute', right: 20, bottom: 88, backgroundColor: colors.pink, borderRadius: 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }], ...theme.shadow.card }]}> 
          <Text style={{ color: '#23181D', fontWeight: '700', fontSize: 24 }}>＋</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
