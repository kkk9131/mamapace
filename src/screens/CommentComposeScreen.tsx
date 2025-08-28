import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { createComment } from '../services/postService';
import * as ImagePicker from 'expo-image-picker';
import { uploadCommentImage } from '../services/storageService';
import { notifyError } from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { useRef, useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';

export default function CommentComposeScreen({
  postId,
  onClose,
  onPosted,
}: {
  postId: string;
  onClose?: () => void;
  onPosted?: () => void;
}) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { user } = useAuth();
  const { handPreference } = useHandPreference();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fade]);
  const [body, setBody] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 20 })}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
              paddingTop: 40,
              paddingBottom: 120,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                paddingHorizontal: theme.spacing(2),
                marginBottom: theme.spacing(1.5),
              }}
            >
              <View style={{ borderRadius: 999, overflow: 'hidden' }}>
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: '#ffffff10',
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '700',
                    }}
                  >
                    コメントを書く
                  </Text>
                </BlurView>
              </View>
            </View>
            <View style={{ paddingHorizontal: theme.spacing(2) }}>
              <View
                style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}
              >
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{
                    padding: theme.spacing(1.5),
                    backgroundColor: '#ffffff10',
                  }}
                >
                  <TextInput
                    placeholder="気持ちをそっと届けよう…"
                    placeholderTextColor={colors.subtext}
                    multiline
                    value={body}
                    onChangeText={setBody}
                    maxLength={300}
                    style={{
                      minHeight: 160,
                      maxHeight: 250,
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
                          <Animated.Image source={{ uri: imageUris[0] }} style={{ width: '100%', height: 200 }} />
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {imageUris.slice(0, 4).map(uri => (
                            <View key={uri} style={{ width: '48%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' }}>
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
            </View>
          </ScrollView>

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: theme.spacing(1.5),
              paddingBottom: theme.spacing(2) + 56,
              backgroundColor: colors.card,
              borderTopColor: '#22252B',
              borderTopWidth: 1,
            }}
          >
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="画像を選択"
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
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderRadius: theme.radius.md,
                    paddingVertical: 10,
                    paddingHorizontal: theme.spacing(2),
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text style={{ color: colors.text }}>画像</Text>
              </Pressable>
              {handPreference === 'left' ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="コメントを送信"
                    disabled={submitting || (!body.trim() && imageUris.length === 0)}
                    onPress={async () => {
                      if (!body.trim() && imageUris.length === 0) return;
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSubmitting(true);
                      try {
                        if (!user?.id) throw new Error('ログインが必要です');
                        const uploaded: string[] = [];
                        for (const uri of imageUris) {
                          const url = await uploadCommentImage(user.id, uri);
                          uploaded.push(url);
                        }
                        await createComment(postId, body.trim(), uploaded);
                        Keyboard.dismiss();
                        if (onPosted) onPosted();
                        else onClose && onClose();
                      } catch (e: any) {
                        notifyError(e?.message || 'コメントの送信に失敗しました');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.pink,
                        borderRadius: theme.radius.md,
                        paddingVertical: 10,
                        paddingHorizontal: theme.spacing(2),
                        opacity: submitting || !body.trim() ? 0.6 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                        ...theme.shadow.card,
                      },
                    ]}
                  >
                    <Text style={{ color: '#23181D', fontWeight: '700' }}>
                      {submitting ? '送信中…' : '送信'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="閉じる"
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      Keyboard.dismiss();
                      onClose && onClose();
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.surface,
                        borderRadius: theme.radius.md,
                        paddingVertical: 10,
                        paddingHorizontal: theme.spacing(2),
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text }}>キャンセル</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="閉じる"
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      Keyboard.dismiss();
                      onClose && onClose();
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.surface,
                        borderRadius: theme.radius.md,
                        paddingVertical: 10,
                        paddingHorizontal: theme.spacing(2),
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text }}>キャンセル</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="コメントを送信"
                    disabled={submitting || (!body.trim() && imageUris.length === 0)}
                    onPress={async () => {
                      if (!body.trim() && imageUris.length === 0) return;
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSubmitting(true);
                      try {
                        if (!user?.id) throw new Error('ログインが必要です');
                        const uploaded: string[] = [];
                        for (const uri of imageUris) {
                          const url = await uploadCommentImage(user.id, uri);
                          uploaded.push(url);
                        }
                        await createComment(postId, body.trim(), uploaded);
                        Keyboard.dismiss();
                        if (onPosted) onPosted();
                        else onClose && onClose();
                      } catch (e: any) {
                        notifyError(e?.message || 'コメントの送信に失敗しました');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.pink,
                        borderRadius: theme.radius.md,
                        paddingVertical: 10,
                        paddingHorizontal: theme.spacing(2),
                        opacity: submitting || !body.trim() ? 0.6 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                        ...theme.shadow.card,
                      },
                    ]}
                  >
                    <Text style={{ color: '#23181D', fontWeight: '700' }}>
                      {submitting ? '送信中…' : '送信'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
