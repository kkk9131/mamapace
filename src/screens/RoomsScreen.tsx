import { View, Text, FlatList, TouchableOpacity, Pressable, Animated, ScrollView } from 'react-native';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';

const rooms = [
  { id: 'all', name: '愚痴もたまには、、、', desc: '完全匿名・1時間でポストが消えます', badge: '匿名' },
  { id: 'baby', name: '0-6ヶ月', desc: 'はじめての育児シェア', badge: '月齢' },
  { id: 'sleep', name: 'ねんね', desc: '夜泣き・寝かしつけ', badge: '相談' },
];

import AnonRoomScreen from './AnonRoomScreen';
import { useState } from 'react';

export default function RoomsScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('愚痴');
  if (open === 'all') return <AnonRoomScreen />;

  const base = rooms.filter(r => selected === '愚痴' ? true : r.name.includes(selected));
  const special = rooms.find(r => r.id === 'all');
  const filtered = special ? [special, ...base.filter(r => r.id !== 'all')] : base;

  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 48, opacity: fade }}>
      <View style={{ paddingHorizontal: theme.spacing(2), marginBottom: 28 }}>
        <View style={{ borderRadius: 999, overflow: 'hidden' }}>
          <BlurView intensity={30} tint="dark" style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#ffffff10' }}>
            <View style={{ flexDirection: 'row' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['愚痴','0-6ヶ月','ねんね','ごはん','遊び','体調'].map((m) => (
                  <View key={m} style={{ marginRight: 8 }}>
                    <Pressable onPress={() => setSelected(m)} style={({ pressed }) => [{ backgroundColor: selected===m ? '#ffffff24' : '#ffffff12', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                      <Text style={{ color: colors.text, fontSize: 12 }}>{m}</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          </BlurView>
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => setOpen(item.id)} style={({ pressed }) => [{ borderRadius: theme.radius.lg, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }], ...theme.shadow.card }]}>
            <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.75), backgroundColor: item.id==='all' ? '#F6C6D040' : '#ffffff10' }}>
            <Text style={{ color: colors.text, fontSize: 16, marginBottom: 6 }}>{item.name}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.subtext }}>{item.desc}</Text>
              <View style={{ backgroundColor: colors.pinkSoft, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing(1.25), paddingVertical: 4 }}>
                <Text style={{ color: '#302126', fontSize: 12 }}>{item.badge}</Text>
              </View>
            </View>
            </BlurView>
          </Pressable>
        )}
      />
    </Animated.View>
  );
}
