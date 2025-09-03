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
import { imagesOnlyMediaTypes, imageOnlyMediaTypeSingle } from '../utils/imagePickerCompat';
import { uploadPostImages } from '../services/storageService';
import { Image } from 'react-native';
import { notifyError } from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { useRef, useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

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
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<{ uri: string }[]>([]);
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
                  {/* 添付ツールバー */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    {/* ギャラリー */}
                    <Pressable
                      disabled={images.length >= 4}
                      onPress={async () => {
                        try {
                          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (!perm.granted) { notifyError('写真ライブラリへのアクセスが必要です'); return; }
                          const res = await ImagePicker.launchImageLibraryAsync({
                            allowsMultipleSelection: true,
                            mediaTypes: imagesOnlyMediaTypes(),
                            selectionLimit: 4,
                            quality: 1,
                          });
                          if (res.canceled) return;
                          const picked = res.assets?.map(a => ({ uri: a.uri })) || [];
                          setImages(prev => [...prev, ...picked].slice(0, 4));
                        } catch (e: any) { notifyError(e?.message || '画像の選択に失敗しました'); }
                      }}
                      style={({ pressed }) => ({
                        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8,
                        backgroundColor: images.length >= 4 ? '#ffffff08' : pressed ? '#ffffff20' : '#ffffff14', borderWidth: 1, borderColor: '#ffffff22',
                      })}
                    >
                      <Ionicons name="images-outline" size={18} color={colors.text} />
                    </Pressable>
                    {/* カメラ */}
                    <Pressable
                      disabled={images.length >= 4}
                      onPress={async () => {
                        try {
                          const perm = await ImagePicker.requestCameraPermissionsAsync();
                          if (!perm.granted) { notifyError('カメラへのアクセスが必要です'); return; }
                          const res = await ImagePicker.launchCameraAsync({ mediaTypes: imageOnlyMediaTypeSingle(), quality: 1 });
                          if (res.canceled) return;
                          const picked = res.assets?.map(a => ({ uri: a.uri })) || [];
                          setImages(prev => [...prev, ...picked].slice(0, 4));
                        } catch (e: any) { notifyError(e?.message || '撮影に失敗しました'); }
                      }}
                      style={({ pressed }) => ({
                        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8,
                        backgroundColor: images.length >= 4 ? '#ffffff08' : pressed ? '#ffffff20' : '#ffffff14', borderWidth: 1, borderColor: '#ffffff22',
                      })}
                    >
                      <Ionicons name="camera-outline" size={18} color={colors.text} />
                    </Pressable>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>{images.length}/4</Text>
                  </View>
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
                  {/* サムネイル */}
                  {images.length > 0 && (
                    <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {images.map((img, idx) => (
                        <Pressable key={idx} onPress={() => setImages(prev => prev.filter((_, i) => i !== idx))} style={{ width: '23%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#ffffff12' }}>
                          <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} />
                        </Pressable>
                      ))}
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
              {handPreference === 'left' ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="コメントを送信"
                    disabled={submitting || (!body.trim() && images.length === 0)}
                    onPress={async () => {
                      if (!body.trim() && images.length === 0) return;
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSubmitting(true);
                      try {
                        if (!user?.id) throw new Error('ログインが必要です');
                        let attachments: { url: string; width?: number; height?: number; mime?: string }[] = [];
                        if (images.length > 0) {
                          attachments = await uploadPostImages(user.id, images.map(i => i.uri));
                        }
                        await createComment(postId, body.trim(), attachments);
                        Keyboard.dismiss();
                        // 入力リセット
                        setBody('');
                        setImages([]);
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
                    {submitting ? (
                      <Text style={{ color: '#23181D', fontWeight: '700' }}>…</Text>
                    ) : (
                      <Ionicons name="send" size={18} color={'#23181D'} />
                    )}
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
                    disabled={submitting || (!body.trim() && images.length === 0)}
                    onPress={async () => {
                      if (!body.trim() && images.length === 0) return;
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSubmitting(true);
                      try {
                        if (!user?.id) throw new Error('ログインが必要です');
                        let attachments: { url: string; width?: number; height?: number; mime?: string }[] = [];
                        if (images.length > 0) {
                          attachments = await uploadPostImages(user.id, images.map(i => i.uri));
                        }
                        await createComment(postId, body.trim(), attachments);
                        Keyboard.dismiss();
                        setBody('');
                        setImages([]);
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
                    {submitting ? (
                      <Text style={{ color: '#23181D', fontWeight: '700' }}>…</Text>
                    ) : (
                      <Ionicons name="send" size={18} color={'#23181D'} />
                    )}
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
