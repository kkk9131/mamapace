import { View, Text, FlatList, TextInput, Pressable, Animated } from 'react-native';
import { useTheme } from '../theme/theme';

const msgs = [
  { id: 'm1', me: false, text: 'こんばんは！' },
  { id: 'm2', me: true, text: '夜間授乳おつかれさまです' },
];

export default function ChatScreen() {
  const { colors } = useTheme();
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 32, paddingBottom: 72, opacity: fade }}>
      <FlatList
        data={msgs}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <View style={{ alignItems: item.me ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <View style={{ backgroundColor: item.me ? colors.pink : '#ffffff10', padding: 10, borderRadius: 14 }}>
              <Text style={{ color: item.me ? '#23181D' : colors.text }}>{item.text}</Text>
            </View>
          </View>
        )}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 56, padding: 12, backgroundColor: colors.card + 'EE', borderTopColor: '#22252B', borderTopWidth: 1 }}>
        <View style={{ backgroundColor: '#ffffff10', borderRadius: 14, paddingHorizontal: 12 }}>
          <TextInput placeholder="メッセージを入力" placeholderTextColor={colors.subtext} style={{ color: colors.text, height: 44 }} />
        </View>
      </View>
    </Animated.View>
  );
}
