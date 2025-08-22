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
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { updateMyProfile } from '../services/profileService';
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
  const theme = useTheme() as any;
  const { colors } = theme;
  const { user } = useAuth();
  const { handPreference } = useHandPreference();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState(user?.avatar_emoji || '👩‍🍼');
  const [saving, setSaving] = useState(false);

  const handleDisplayNameChange = (text: string) => {
    setDisplayName(text);
  };

  const handleBioChange = (text: string) => {
    setBio(text);
  };

  const handleAvatarEmojiChange = (emoji: string) => {
    setAvatarEmoji(emoji);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

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
                    disabled={saving}
                    style={{
                      paddingHorizontal: theme.spacing(2),
                      paddingVertical: theme.spacing(1),
                      borderRadius: 999,
                      backgroundColor: colors.pink,
                      opacity: saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: 'white', fontWeight: '700' }}>
                        保存
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.goBack()}
                    disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
                    style={{
                      paddingHorizontal: theme.spacing(2),
                      paddingVertical: theme.spacing(1),
                      borderRadius: 999,
                      backgroundColor: colors.pink,
                      opacity: saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? (
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
        </ScrollView>
      </Animated.View>
    </View>
  );
}