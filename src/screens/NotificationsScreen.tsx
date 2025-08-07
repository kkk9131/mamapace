import { View, Text, FlatList, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

const items = [
  { id: 'n1', type: 'like', text: 'ママの味方があなたの投稿に共感を送りました', time: '3m', read: false },
  { id: 'n2', type: 'comment', text: '愚痴ルームで新しい反応がありました', time: '10m', read: true },
  { id: 'n3', type: 'system', text: '安心・安全のための新機能を追加しました', time: '昨日', read: true },
];

const iconOf = (t: string) => (t==='like'?'💗':t==='comment'?'💬':'⭐️');

export default function NotificationsScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 40, opacity: fade }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [{ borderRadius: theme.radius.lg, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }], opacity: item.read ? 0.7 : 1, ...theme.shadow.card }]}> 
            <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 4, backgroundColor: item.read ? '#ffffff20' : colors.pink, borderRadius: 2, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>
                      <Text style={{ marginRight: 6 }}>{iconOf(item.type as string)}</Text> {item.text}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginBottom: 6 }}>
                    <Text style={{ color: colors.subtext, fontSize: 13, opacity: 0.9, backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>{item.time}</Text>
                  </View>
                  {!item.read && (
                    <View style={{ alignSelf: 'flex-start', backgroundColor: colors.pink, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#23181D', fontSize: 12, fontWeight: '700' }}>新着</Text>
                    </View>
                  )}
                </View>
              </View>
            </BlurView>
          </Pressable>
        )}
      />
    </Animated.View>
  );
}
