import { View, Text, FlatList, TouchableOpacity, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';

const mockPosts = [
  { id: '1', user: 'ゆい', body: '夜間授乳でねむねむ…でも抱っこの温もりが幸せ', time: '3m', photo: undefined },
  { id: '2', user: '匿名', body: '愚痴もたまには、、、もう洗濯たまってる…', time: '10m', photo: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop' },
];

export default function HomeScreen({ onCompose, onComment }: { onCompose?: () => void; onComment?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 48, opacity: fade }}>
      <View style={{ paddingHorizontal: theme.spacing(2), marginBottom: 20 }}>
        <View style={{ borderRadius: 999, overflow: 'hidden' }}>
          <BlurView intensity={40} tint="dark" style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#ffffff0E' }}>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
              {['元気','眠い','しんどい','幸せ'].map((m) => (
                <Pressable key={m} style={({ pressed }) => [{ backgroundColor: '#ffffff12', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                  <Text style={{ color: colors.text, fontSize: 12 }}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </BlurView>
        </View>
      </View>
      <>
      <FlatList
        data={mockPosts}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 8, paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(2) }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => onComment && onComment()} style={({ pressed }) => [{ borderRadius: 24, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }], ...theme.shadow.card }]}> 
            <BlurView intensity={40} tint="dark" style={{ padding: theme.spacing(2), backgroundColor: '#ffffff0E' }}>
              {item.photo ? (
                <View style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 12 }}>
                  <View style={{ height: 180, backgroundColor: '#ffffff10' }} />
                </View>
              ) : null}
              <Text style={{ color: colors.text, fontSize: 18, marginBottom: 8 }}>{item.body}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.subtext }}>{item.user} ・ {item.time}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['💗','💬'].map((icon) => {
                    const scale = new Animated.Value(1);
                    const float = new Animated.Value(0);
                    const onPress = () => {
                      if (icon==='💬' && onComment) onComment();
                      Animated.sequence([
                        Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 16, bounciness: 8 }),
                        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
                      ]).start();
                      float.setValue(0);
                      Animated.timing(float, { toValue: -14, duration: 450, useNativeDriver: true }).start();
                    };
                    return (
                      <Pressable key={icon} onPress={onPress} style={({ pressed }) => [{ backgroundColor: colors.surface, paddingHorizontal: theme.spacing(1.25), paddingVertical: 6, borderRadius: 999, overflow: 'visible', transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
                        <Animated.Text style={{ transform: [{ scale }], color: colors.pink, fontWeight: '700' }}>{icon}</Animated.Text>
                        <Animated.Text style={{ position: 'absolute', top: -6, right: -6, color: colors.pink, opacity: 0.9, transform: [{ translateY: float }] }}>+1</Animated.Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </BlurView>
          </Pressable>
        )}
      />
      <Pressable onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCompose && onCompose(); }} style={({ pressed }) => [{ position: 'absolute', right: 20, bottom: 88, backgroundColor: colors.pink, borderRadius: 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }], ...theme.shadow.card }]}>
        <Text style={{ color: '#23181D', fontWeight: '700', fontSize: 24 }}>＋</Text>
      </Pressable>
      </>
    </Animated.View>
  );
}
