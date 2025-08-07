import { View, Text, FlatList, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

const rooms = [
  { id: 'r1', name: 'ねんね相談', members: 124, desc: '寝かしつけ・夜泣き' },
  { id: 'r2', name: 'ごはん/離乳食', members: 88, desc: 'メニュー・進め方' },
  { id: 'r3', name: '0-6ヶ月', members: 203, desc: 'はじめての育児シェア' },
];

export default function RoomsListScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 40, opacity: fade }}>
      <FlatList
        data={rooms}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(10) }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [{ borderRadius: theme.radius.lg, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }], ...theme.shadow.card }]}> 
            <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.subtext, fontSize: 12 }}>{item.desc}</Text>
                </View>
                <View style={{ backgroundColor: colors.pink, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing(1), paddingVertical: 6 }}>
                  <Text style={{ color: '#23181D', fontWeight: '700' }}>{item.members}人</Text>
                </View>
              </View>
            </BlurView>
          </Pressable>
        )}
      />
    </Animated.View>
  );
}
