import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { getSupabaseClient } from '../services/supabaseClient';
import { imagesOnlyMediaTypes } from '../utils/imagePickerCompat';
import {
  updateMyProfile,
  updateMyAvatarUrl,
  setMaternalId,
} from '../services/profileService';
import validationService from '../services/validationService';
import { uploadAvatarImage } from '../services/storageService';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { secureLogger } from '../utils/privacyProtection';

const EMOJI_OPTIONS = [
  '👩‍🍼',
  '👶',
  '🍼',
  '👨‍👩‍👧',
  '🌸',
  '💝',
  '🌈',
  '☕',
  '🎈',
  '🌟',
];

export default function ProfileEditScreen({ navigation }: any) {
  const theme = useTheme();
  const { colors } = theme;
  const { user, dispatch } = useAuth();
  const { handPreference } = useHandPreference();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState(user?.avatar_emoji || '👩‍🍼');
  const [avatarImageUri, setAvatarImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maternalId, setMaternalIdInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleDisplayNameChange = (text: string) => {
    setDisplayName(text);
  };

  const handleBioChange = (text: string) => {
    setBio(text);
  };

  const handleAvatarEmojiChange = (emoji: string) => {
    setAvatarEmoji(emoji);
  };

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('権限', '写真ライブラリへのアクセスが必要です');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: imagesOnlyMediaTypes(),
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!(result as any).canceled && (result as any).assets?.length) {
        setAvatarImageUri((result as any).assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('エラー', e?.message || '画像の選択に失敗しました');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // If image selected, upload and update avatar_url first
      if (avatarImageUri && user?.id) {
        try {
          setUploading(true);
          const url = await uploadAvatarImage(user.id, avatarImageUri);
          await updateMyAvatarUrl(url);
        } finally {
          setUploading(false);
        }
      }

      const updatedProfile = await updateMyProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_emoji: avatarEmoji,
      });

      Alert.alert('成功', 'プロフィールを更新しました', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      secureLogger.error('Failed to save profile:', error);
      Alert.alert(
        'エラー',
        error.message || 'プロフィールの更新に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyMaternal = async () => {
    try {
      setVerifying(true);
      // Optional client-side validation for UX (non-authoritative)
      const v = validationService.validateMaternalHealthIdClient(maternalId);
      if (!v.isValid) {
        Alert.alert('確認', v.error || '母子手帳番号の形式が正しくありません');
        return;
      }
      await setMaternalId(maternalId);
      // Reflect in auth context immediately
      try {
        const supabase = getSupabaseClient();
        const { data: pub } = await supabase
          .from('user_profiles_public')
          .select('maternal_verified')
          .eq('id', user?.id || '')
          .maybeSingle();
        if (user && typeof pub?.maternal_verified !== 'undefined') {
          dispatch({
            type: 'SET_USER',
            payload: {
              ...user,
              maternal_verified: pub.maternal_verified,
            } as any,
          });
        }
      } catch {}
      Alert.alert('認証済み', '母子手帳の認証が完了しました');
    } catch (e: any) {
      secureLogger.error('Maternal verify failed', e);
      Alert.alert('エラー', e?.message || '認証に失敗しました');
    } finally {
      setVerifying(false);
    }
  };

  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg || '#000' }}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View
            style={{
              flexDirection: handPreference === 'left' ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing(3),
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 24,
                fontWeight: '800',
              }}
            >
              プロフィール編集
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing(1) }}>
              {handPreference === 'left' ? (
                <>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving || uploading}
                    style={{
                      paddingHorizontal: theme.spacing(2),
                      paddingVertical: theme.spacing(1),
                      borderRadius: 999,
                      backgroundColor: colors.pink,
                      opacity: saving || uploading ? 0.5 : 1,
                    }}
                  >
                    {saving || uploading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: 'white', fontWeight: '700' }}>
                        保存
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.goBack()}
                    disabled={saving || uploading}
                    style={{
                      paddingHorizontal: theme.spacing(2),
                      paddingVertical: theme.spacing(1),
                      borderRadius: 999,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      キャンセル
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => navigation.goBack()}
                    disabled={saving || uploading}
                    style={{
                      paddingHorizontal: theme.spacing(2),
                      paddingVertical: theme.spacing(1),
                      borderRadius: 999,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      キャンセル
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving || uploading}
                    style={{
                      paddingHorizontal: theme.spacing(2),
                      paddingVertical: theme.spacing(1),
                      borderRadius: 999,
                      backgroundColor: colors.pink,
                      opacity: saving || uploading ? 0.5 : 1,
                    }}
                  >
                    {saving || uploading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: 'white', fontWeight: '700' }}>
                        保存
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* Avatar Image Selector */}
          <View
            style={{
              marginBottom: theme.spacing(2),
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              ...theme.shadow.card,
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                padding: theme.spacing(2),
                backgroundColor: '#ffffff10',
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: theme.spacing(1.5),
                }}
              >
                アイコン画像（任意）
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    overflow: 'hidden',
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {avatarImageUri ? (
                    <Animated.Image
                      source={{ uri: avatarImageUri }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <Text style={{ fontSize: 28 }}>{avatarEmoji || '👩‍🍼'}</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={handlePickImage}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: theme.spacing(2),
                        paddingVertical: theme.spacing(1),
                        borderRadius: 999,
                        backgroundColor: colors.pink,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <Text style={{ color: 'white', fontWeight: '700' }}>
                      画像を選択
                    </Text>
                  </Pressable>
                  {avatarImageUri && (
                    <Pressable
                      onPress={() => setAvatarImageUri(null)}
                      style={({ pressed }) => [
                        {
                          paddingHorizontal: theme.spacing(2),
                          paddingVertical: theme.spacing(1),
                          borderRadius: 999,
                          backgroundColor: 'transparent',
                          borderWidth: 1,
                          borderColor: colors.subtext + '40',
                          transform: [{ scale: pressed ? 0.97 : 1 }],
                        },
                      ]}
                    >
                      <Text style={{ color: colors.text, fontWeight: '700' }}>
                        画像を削除
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <Text
                style={{ color: colors.subtext, fontSize: 12, marginTop: 8 }}
              >
                円形にトリミングされて表示されます。未設定時は絵文字を使用します。
              </Text>
            </BlurView>
          </View>

          {/* Avatar Emoji Selector */}
          <View
            style={{
              marginBottom: theme.spacing(2),
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              ...theme.shadow.card,
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                padding: theme.spacing(2),
                backgroundColor: '#ffffff10',
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: theme.spacing(1.5),
                }}
              >
                アバター絵文字
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing(1),
                }}
              >
                {EMOJI_OPTIONS.map((emoji, index) => (
                  <Pressable
                    key={index}
                    onPress={() => handleAvatarEmojiChange(emoji)}
                    style={({ pressed }) => [
                      {
                        padding: theme.spacing(1),
                        borderRadius: theme.radius.md,
                        backgroundColor:
                          avatarEmoji === emoji
                            ? colors.pink + '40'
                            : colors.surface,
                        borderWidth: avatarEmoji === emoji ? 2 : 0,
                        borderColor: colors.pink,
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </BlurView>
          </View>

          {/* Display Name Input */}
          <View
            style={{
              marginBottom: theme.spacing(2),
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              ...theme.shadow.card,
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                padding: theme.spacing(2),
                backgroundColor: '#ffffff10',
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: theme.spacing(1),
                }}
              >
                表示名
              </Text>
              <TextInput
                value={displayName}
                onChangeText={handleDisplayNameChange}
                placeholder="表示名を入力"
                placeholderTextColor={colors.subtext}
                maxLength={50}
                style={{
                  color: colors.text,
                  fontSize: 16,
                  padding: theme.spacing(1.5),
                  borderRadius: theme.radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.surface,
                }}
                editable={!saving}
              />
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 12,
                  marginTop: theme.spacing(0.5),
                }}
              >
                {displayName.length}/50文字
              </Text>
            </BlurView>
          </View>

          {/* Bio Input */}
          <View
            style={{
              marginBottom: theme.spacing(4),
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              ...theme.shadow.card,
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                padding: theme.spacing(2),
                backgroundColor: '#ffffff10',
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: theme.spacing(1),
                }}
              >
                自己紹介
              </Text>
              <TextInput
                value={bio}
                onChangeText={handleBioChange}
                placeholder="自己紹介を入力"
                placeholderTextColor={colors.subtext}
                multiline
                numberOfLines={4}
                maxLength={200}
                textAlignVertical="top"
                style={{
                  color: colors.text,
                  fontSize: 16,
                  padding: theme.spacing(1.5),
                  borderRadius: theme.radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.surface,
                  minHeight: 100,
                }}
                editable={!saving}
              />
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 12,
                  marginTop: theme.spacing(0.5),
                }}
              >
                {bio.length}/200文字
              </Text>
            </BlurView>
          </View>

          {/* Maternal Health ID (Badge) */}
          <View
            style={{
              marginBottom: theme.spacing(6),
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              ...theme.shadow.card,
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                padding: theme.spacing(2),
                backgroundColor: '#ffffff10',
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: theme.spacing(1),
                }}
                accessibilityLabel="母子手帳番号入力"
              >
                母子手帳番号（認証）
              </Text>
              <TextInput
                value={maternalId}
                onChangeText={t => setMaternalIdInput(t.replace(/\D/g, ''))}
                placeholder="数字のみ（例: 1234567890）"
                placeholderTextColor={colors.subtext}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={16}
                style={{
                  color: colors.text,
                  fontSize: 16,
                  padding: theme.spacing(1.5),
                  borderRadius: theme.radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.surface,
                }}
                editable={!verifying}
              />
              <Text
                style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}
              >
                入力内容はサーバーで安全にハッシュ化され保存されます。
              </Text>
              <View style={{ height: theme.spacing(1.5) }} />
              <Pressable
                onPress={handleVerifyMaternal}
                disabled={verifying || maternalId.length === 0}
                style={({ pressed }) => [
                  {
                    alignSelf: 'flex-start',
                    paddingHorizontal: theme.spacing(2),
                    paddingVertical: theme.spacing(1),
                    borderRadius: 999,
                    backgroundColor: colors.pink,
                    opacity: verifying || maternalId.length === 0 ? 0.5 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                accessibilityLabel="母子手帳の認証を実行"
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    認証する
                  </Text>
                )}
              </Pressable>
            </BlurView>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
