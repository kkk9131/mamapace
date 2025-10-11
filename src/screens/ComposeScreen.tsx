import {
  View,
  TextInput,
  Text,
  Pressable,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/theme';
import { notifyError } from '../utils/notify';
import { createPost } from '../services/postService';
import { triggerCompassionateAiComment } from '../services/aiCommentService';
import {
  imagesOnlyMediaTypes,
  imageOnlyMediaTypeSingle,
} from '../utils/imagePickerCompat';
import { uploadPostImages } from '../services/storageService';
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
  const [aiOn, setAiOn] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [images, setImages] = useState<{ uri: string }[]>([]);
  const [aiCommentLimitReached, setAiCommentLimitReached] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const handleToggleAi = () => {
    if (aiCommentLimitReached) {
      Alert.alert(
        'AIコメントの上限',
        '今日はこれ以上AIコメントをリクエストできません。明日またお試しください。'
      );
      return;
    }
    setAiOn(v => !v);
  };

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
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={{ borderRadius: 16, overflow: 'hidden' }}>
            <BlurView
              intensity={30}
              tint="dark"
              style={{ padding: 12, backgroundColor: '#ffffff10' }}
            >
              {/* 添付ツールバー */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Pressable
                  disabled={images.length >= 4}
                  onPress={async () => {
                    try {
                      const perm =
                        await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!perm.granted) {
                        notifyError('写真ライブラリへのアクセスが必要です');
                        return;
                      }
                      const res = await ImagePicker.launchImageLibraryAsync({
                        allowsMultipleSelection: true,
                        mediaTypes: imagesOnlyMediaTypes(),
                        selectionLimit: 4,
                        quality: 1,
                      });
                      if (res.canceled) {
                        return;
                      }
                      const picked =
                        res.assets?.map(a => ({ uri: a.uri })) || [];
                      setImages(prev => {
                        const combined = [...prev, ...picked];
                        return combined.slice(0, 4);
                      });
                    } catch (e: any) {
                      notifyError(e?.message || '画像の選択に失敗しました');
                    }
                  }}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                    backgroundColor:
                      images.length >= 4
                        ? '#ffffff08'
                        : pressed
                          ? '#ffffff20'
                          : '#ffffff14',
                    borderWidth: 1,
                    borderColor: '#ffffff22',
                    transform: [
                      { scale: pressed && images.length < 4 ? 0.96 : 1 },
                    ],
                    opacity: images.length >= 4 ? 0.6 : 1,
                  })}
                >
                  <Ionicons
                    name="images-outline"
                    size={18}
                    color={colors.text}
                  />
                </Pressable>
                {/* カメラボタン */}
                <Pressable
                  disabled={images.length >= 4}
                  onPress={async () => {
                    try {
                      const perm =
                        await ImagePicker.requestCameraPermissionsAsync();
                      if (!perm.granted) {
                        notifyError('カメラへのアクセスが必要です');
                        return;
                      }
                      const res = await ImagePicker.launchCameraAsync({
                        mediaTypes: imageOnlyMediaTypeSingle(),
                        quality: 1,
                      });
                      if (res.canceled) {
                        return;
                      }
                      const picked =
                        res.assets?.map(a => ({ uri: a.uri })) || [];
                      setImages(prev => {
                        const combined = [...prev, ...picked];
                        return combined.slice(0, 4);
                      });
                    } catch (e: any) {
                      notifyError(e?.message || '撮影に失敗しました');
                    }
                  }}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                    backgroundColor:
                      images.length >= 4
                        ? '#ffffff08'
                        : pressed
                          ? '#ffffff20'
                          : '#ffffff14',
                    borderWidth: 1,
                    borderColor: '#ffffff22',
                    transform: [
                      { scale: pressed && images.length < 4 ? 0.96 : 1 },
                    ],
                    opacity: images.length >= 4 ? 0.6 : 1,
                  })}
                >
                  <Ionicons
                    name="camera-outline"
                    size={18}
                    color={colors.text}
                  />
                </Pressable>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: '#ffffff10',
                    borderWidth: 1,
                    borderColor: '#ffffff18',
                  }}
                >
                  <Text style={{ color: colors.subtext, fontSize: 11 }}>
                    {images.length}/4
                  </Text>
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  marginBottom: 8,
                }}
              >
                <Pressable
                  onPress={handleToggleAi}
                  disabled={aiCommentLimitReached}
                  style={({ pressed }) => [
                    {
                      backgroundColor: aiOn ? colors.pink : '#ffffff14',
                      borderRadius: 999,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      opacity: aiCommentLimitReached ? 0.4 : 1,
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
              {aiCommentLimitReached && (
                <Text
                  style={{
                    color: colors.subtext,
                    fontSize: 11,
                    textAlign: 'right',
                    marginBottom: 4,
                  }}
                >
                  1日のリクエスト上限に達しました。明日再度お試しください。
                </Text>
              )}
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
              {/* サムネイルプレビュー */}
              {images.length > 0 && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                  >
                    {images.map((img, idx) => (
                      <View
                        key={idx}
                        style={{
                          width: '23%',
                          aspectRatio: 1,
                          borderRadius: 8,
                          overflow: 'hidden',
                          backgroundColor: '#ffffff12',
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            setImages(prev => prev.filter((_, i) => i !== idx))
                          }
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Image
                            source={{ uri: img.uri }}
                            style={{ width: '100%', height: '100%' }}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: colors.subtext, fontSize: 11 }}>
                    タップで削除
                  </Text>
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
              if (!body.trim() && images.length === 0) {
                return;
              }
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSubmitting(true);
              try {
                if (!user?.id) {
                  throw new Error('ログインが必要です');
                }
                let attachments: {
                  url: string;
                  width?: number;
                  height?: number;
                  mime?: string;
                }[] = [];
                if (images.length > 0) {
                  attachments = await uploadPostImages(
                    user.id,
                    images.map(i => i.uri)
                  );
                }
                const created = await createPost(body.trim(), attachments);
                if (aiOn && created?.id) {
                  // Fire-and-forget; do not block UX
                  const bodyForAi =
                    (created as any)?.body || body.trim() || '[image]';
                  triggerCompassionateAiComment({
                    postId: created.id,
                    body: bodyForAi,
                  })
                    .then(res => {
                      if (res && !res.ok && res.error === 'free_daily_limit') {
                        setAiCommentLimitReached(true);
                        setAiOn(false);
                        Alert.alert(
                          'AIコメントの上限',
                          '本日のAIコメント利用上限に達しました。明日またお試しください。'
                        );
                      }
                    })
                    .catch(() => {});
                }
                if (onPosted) {
                  onPosted();
                } else if (onClose) {
                  onClose();
                }
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
