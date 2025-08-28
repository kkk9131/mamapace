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
  const [imageUri, setImageUri] = useState<string | null>(null);
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
                  {imageUri && (
                    <View style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden' }}>
                      <Animated.Image source={{ uri: imageUri }} style={{ width: '100%', height: 200 }} />
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
                    mediaTypes: (ImagePicker as any).MediaType ? [((ImagePicker as any).MediaType as any).Images] : (ImagePicker as any).MediaTypeOptions?.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.9,
                  });
                  if (!(result as any).canceled && (result as any).assets?.length) {
                    setImageUri((result as any).assets[0].uri);
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
                    disabled={submitting || (!body.trim() && !imageUri)}
                    onPress={async () => {
                      if (!body.trim() && !imageUri) return;
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSubmitting(true);
                      try {
                        if (!user?.id) throw new Error('ログインが必要です');
                        let content = body.trim();
                        if (imageUri) {
                          const url = await uploadCommentImage(user.id, imageUri);
                          content = content ? content + "\n" + url : url;
                        }
                        await createComment(postId, content);
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
                    disabled={submitting || (!body.trim() && !imageUri)}
                    onPress={async () => {
                      if (!body.trim() && !imageUri) return;
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSubmitting(true);
                      try {
                        if (!user?.id) throw new Error('ログインが必要です');
                        let content = body.trim();
                        if (imageUri) {
                          const url = await uploadCommentImage(user.id, imageUri);
                          content = content ? content + "\n" + url : url;
                        }
                        await createComment(postId, content);
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
