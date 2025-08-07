import { View, Text, FlatList, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

const users = [
  { id: 'u1', name: 'ママ友A', bio: 'ねんね修行中' },
  { id: 'u2', name: 'ママ友B', bio: '離乳食がんばる' },
];

export default function FollowersListScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 40, opacity: fade }}>
      <FlatList
        data={users}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(10) }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
        renderItem={({ item }) => (
          <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
            <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.25), backgroundColor: '#ffffff10', flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Text>👩‍🍼</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>{item.bio}</Text>
              </View>
              <Pressable style={({ pressed }) => [{ backgroundColor: colors.pink, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing(1), paddingVertical: 6, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
                <Text style={{ color: '#23181D', fontWeight: '700' }}>フォロー</Text>
              </Pressable>
            </BlurView>
          </View>
        )}
      />
    </Animated.View>
  );
}
