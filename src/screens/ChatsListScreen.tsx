import { View, Text, FlatList, Pressable, Animated, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

const items = [
  { id: 'c1', name: 'ママ友A', last: '明日あそぼう！', time: '12:30', unread: 2 },
  { id: 'c2', name: 'ねんね相談', last: '寝かしつけコツ共有しました', time: '9:10', unread: 0 },
  { id: 'c3', name: '保育園', last: '連絡ありがとうございます', time: '昨日', unread: 5 },
];

export default function ChatsListScreen({ onOpen }: { onOpen?: (id: string) => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 48, opacity: fade }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(10) }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.25) }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen && onOpen(item.id)} style={({ pressed }) => [{ borderRadius: theme.radius.lg, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }], ...theme.shadow.card }]}> 
            <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text>💬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>{item.time}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text numberOfLines={1} style={{ color: colors.subtext, flex: 1 }}>{item.last}</Text>
                    {item.unread > 0 && (
                      <View style={{ marginLeft: 8, backgroundColor: colors.pink, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#23181D', fontSize: 12, fontWeight: '700' }}>{item.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </BlurView>
          </Pressable>
        )}
      />
    </Animated.View>
  );
}
