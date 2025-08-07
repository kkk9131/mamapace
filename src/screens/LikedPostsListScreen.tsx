import { View, Text, FlatList, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

const liked = [
  { id: 'p1', user: '匿名', body: '寝かしつけ、今日はうまくいった！', time: '1h' },
  { id: 'p2', user: 'ママの味方', body: '小さな一歩でも前進だよ', time: '2h' },
];

export default function LikedPostsListScreen({ onOpen }: { onOpen?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 40, opacity: fade }}>
      <FlatList
        data={liked}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(10) }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.25) }} />}
        renderItem={({ item }) => (
          <Pressable onPress={onOpen} style={({ pressed }) => [{ borderRadius: theme.radius.lg, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }], ...theme.shadow.card }]}> 
            <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
              <Text style={{ color: colors.text, fontSize: 16, marginBottom: 6 }}>{item.body}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>{item.user} ・ {item.time}</Text>
                <Text style={{ color: colors.pink }}>💗</Text>
              </View>
            </BlurView>
          </Pressable>
        )}
      />
    </Animated.View>
  );
}
