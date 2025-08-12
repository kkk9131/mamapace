import { View, TextInput, TouchableOpacity, Text, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/theme';
import { notifyError } from '../utils/notify';

import { useEffect, useRef, useState } from 'react';
import { createPost } from '../services/postService';
import { useAuth } from '../contexts/AuthContext';

export default function ComposeScreen({ onClose, onPosted }: { onClose?: () => void; onPosted?: () => void }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [aiOn, setAiOn] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [fade]);
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
          value={body}
          onChangeText={setBody}
          maxLength={300}
          style={{ minHeight: 140, color: colors.text, fontSize: 16 }}
        />
        <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
          <Text style={{ color: colors.subtext, fontSize: 12 }}>{body.length}/300</Text>
        </View>
        </BlurView>
      </View>
      <Pressable disabled={submitting} onPress={async () => { 
        if (!body.trim()) return; 
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
        setSubmitting(true);
        try {
          if (!user?.id) throw new Error('ログインが必要です');
          await createPost(body.trim());
          if (onPosted) onPosted(); else onClose && onClose();
        } catch (e: any) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const m = e?.message || '投稿に失敗しました';
          setErrorText(m);
          notifyError(m);
        } finally {
          setSubmitting(false);
        }
      }} style={({ pressed }) => [{ marginTop: 16, backgroundColor: colors.pink, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: submitting?0.6:1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
        <Text style={{ color: '#23181D', fontWeight: '700' }}>{submitting?'送信中…':'ポスト'}</Text>
      </Pressable>
      {errorText && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: '#ff8a8a' }}>{errorText}</Text>
        </View>
      )}
    </Animated.View>
  );
}
