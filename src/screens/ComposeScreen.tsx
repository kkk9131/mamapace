import { View, TextInput, TouchableOpacity, Text, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useTheme } from '../theme/theme';

import { useState } from 'react';

export default function ComposeScreen({ onClose }: { onClose?: () => void }) {
  const { colors } = useTheme();
  const [aiOn, setAiOn] = useState(true);
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', padding: 16, paddingTop: 40, opacity: fade }}>
      <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onClose} style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff14', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
          <Text style={{ color: colors.text, fontSize: 16 }}>◀️</Text>
        </Pressable>
      </View>
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>
        <BlurView intensity={30} tint="dark" style={{ padding: 12, backgroundColor: '#ffffff10' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Pressable onPress={() => setAiOn(v => !v)} style={({ pressed }) => [{ backgroundColor: aiOn ? colors.pink : '#ffffff14', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
            <Text style={{ color: aiOn ? '#23181D' : colors.subtext, fontSize: 12 }}>ママの味方のコメント: {aiOn ? 'ON' : 'OFF'}</Text>
          </Pressable>
        </View>
        <TextInput
          placeholder="いまの気持ちをシェア"
          placeholderTextColor={colors.subtext}
          multiline
          style={{ minHeight: 140, color: colors.text, fontSize: 16 }}
        />
        </BlurView>
      </View>
      <Pressable onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); const { sound } = await Audio.Sound.createAsync({ uri: 'https://assets.mixkit.co/active_storage/sfx/3414/3414-preview.mp3' }); await sound.playAsync(); setTimeout(() => sound.unloadAsync(), 2000); }} style={({ pressed }) => [{ marginTop: 16, backgroundColor: colors.pink, borderRadius: 14, paddingVertical: 14, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        <Text style={{ color: '#23181D', fontWeight: '700' }}>ポスト</Text>
      </Pressable>
    </Animated.View>
  );
}
