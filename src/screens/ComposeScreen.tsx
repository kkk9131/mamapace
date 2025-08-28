import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Pressable,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/theme';
import { notifyError } from '../utils/notify';

import { useEffect, useRef, useState } from 'react';
import { createPost } from '../services/postService';
import * as ImagePicker from 'expo-image-picker';
import { uploadPostImage } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';

export default function ComposeScreen({
  onClose,
  onPosted,
}: {
  onClose?: () => void;
  onPosted?: () => void;
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [aiOn, setAiOn] = useState(true);
  const [body, setBody] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fade]);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 20 })}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'transparent',
          opacity: fade,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingTop: 40,
            paddingBottom: 100,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                {
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#ffffff14',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>◀️</Text>
            </Pressable>
          </View>
          <View style={{ borderRadius: 16, overflow: 'hidden' }}>
            <BlurView
              intensity={30}
              tint="dark"
              style={{ padding: 12, backgroundColor: '#ffffff10' }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Pressable
                  onPress={async () => {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (perm.status !== 'granted' && (perm as any).status !== 'limited') return;
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: [ImagePicker.MediaType.Images],
                      allowsMultipleSelection: true as any,
                      selectionLimit: 4 as any,
                      quality: 0.9,
                    });
                    if (!(result as any).canceled && (result as any).assets?.length) {
                      const uris = (result as any).assets.map((a: any) => a.uri).slice(0, 4);
                      setImageUris(prev => Array.from(new Set([...
                        prev,
                        ...uris
                      ])).slice(0, 4));
                    }
                  }}
                  style={({ pressed }) => [{
                    backgroundColor: '#ffffff14',
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  }]}
                >
                  <Text style={{ color: colors.text, fontSize: 12 }}>画像</Text>
                </Pressable>
                <Pressable
                  onPress={() => setAiOn(v => !v)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: aiOn ? colors.pink : '#ffffff14',
                      borderRadius: 999,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: aiOn ? '#23181D' : colors.subtext,
                      fontSize: 12,
                    }}
                  >
                    ママの味方のコメント: {aiOn ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                placeholder="いまの気持ちをシェア"
                placeholderTextColor={colors.subtext}
                multiline
                value={body}
                onChangeText={setBody}
                maxLength={300}
                style={{
                  minHeight: 140,
                  maxHeight: 200,
                  color: colors.text,
                  fontSize: 16,
                  textAlignVertical: 'top',
                }}
                scrollEnabled={true}
              />
              {imageUris.length > 0 && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  {imageUris.length === 1 ? (
                    <View style={{ borderRadius: 12, overflow: 'hidden' }}>
                      <Animated.Image source={{ uri: imageUris[0] }} style={{ width: '100%', height: 240 }} />
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {imageUris.map((uri, idx) => (
                        <View key={uri} style={{ width: '48%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                          <Animated.Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                          <Pressable
                            onPress={() => setImageUris(prev => prev.filter(u => u !== uri))}
                            style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#00000080', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}
                          >
                            <Text style={{ color: 'white', fontWeight: '700' }}>×</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
              <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  {body.length}/300
                </Text>
              </View>
            </BlurView>
          </View>

          <Pressable
            disabled={submitting}
            onPress={async () => {
              if (!body.trim() && imageUris.length === 0) return;
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSubmitting(true);
              try {
                if (!user?.id) throw new Error('ログインが必要です');
                // Upload images and send attachments array
                const uploaded: string[] = [];
                for (const uri of imageUris) {
                  const url = await uploadPostImage(user.id, uri);
                  uploaded.push(url);
                }
                await createPost(body.trim(), uploaded);
                if (onPosted) onPosted();
                else onClose && onClose();
              } catch (e: any) {
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error
                );
                const m = e?.message || '投稿に失敗しました';
                setErrorText(m);
                notifyError(m);
              } finally {
                setSubmitting(false);
              }
            }}
            style={({ pressed }) => [
              {
                marginTop: 16,
                backgroundColor: colors.pink,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: submitting || !body.trim() ? 0.6 : 1,
                transform: [
                  { scale: pressed && body.trim() && !submitting ? 0.97 : 1 },
                ],
              },
            ]}
          >
            <Text style={{ color: '#23181D', fontWeight: '700' }}>
              {submitting ? '送信中…' : 'ポスト'}
            </Text>
          </Pressable>

          {errorText && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: '#ff8a8a' }}>{errorText}</Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
