import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { updateMyProfile, getMyProfile } from '../services/profileService';
import { PublicUserProfile } from '../types/auth';

const EMOJI_OPTIONS = ['👩‍🍼', '👶', '🍼', '👨‍👩‍👧', '🌸', '💝', '🌈', '☕', '🎈', '🌟'];

export default function ProfileEditScreen({ navigation }: any) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { user, dispatch } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👩‍🍼');
  
  const fadeAnim = new Animated.Value(0);
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true
    }).start();
    
    loadProfile();
  }, []);
  
  const loadProfile = async () => {
    try {
      setLoading(true);
      const profileData = await getMyProfile();
      setProfile(profileData);
      setDisplayName(profileData.display_name || '');
      setBio(profileData.bio || '');
      setAvatarEmoji(profileData.avatar_emoji || '👩‍🍼');
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('エラー', 'プロフィールの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updatedProfile = await updateMyProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_emoji: avatarEmoji
      });
      
      // Update auth context with new profile data
      if (user) {
        dispatch({
          type: 'SET_USER',
          payload: {
            ...user,
            display_name: updatedProfile.display_name,
            bio: updatedProfile.bio,
            avatar_emoji: updatedProfile.avatar_emoji
          }
        });
      }
      
      Alert.alert('成功', 'プロフィールを更新しました', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      Alert.alert('エラー', error.message || 'プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };
  
  const handleCancel = () => {
    navigation.goBack();
  };
  
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView 
          contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing(3) }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>プロフィール編集</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing(1) }}>
              <Pressable 
                onPress={handleCancel}
                disabled={saving}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: theme.spacing(2),
                    paddingVertical: theme.spacing(1),
                    borderRadius: 999,
                    backgroundColor: colors.surface,
                    transform: [{ scale: pressed ? 0.97 : 1 }]
                  }
                ]}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>キャンセル</Text>
              </Pressable>
              <Pressable 
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: theme.spacing(2),
                    paddingVertical: theme.spacing(1),
                    borderRadius: 999,
                    backgroundColor: colors.pink,
                    opacity: saving ? 0.5 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }]
                  }
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700' }}>保存</Text>
                )}
              </Pressable>
            </View>
          </View>
          
          {/* Avatar Emoji Selector */}
          <View style={{ marginBottom: theme.spacing(2), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
            <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(2), backgroundColor: '#ffffff10' }}>
              <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: theme.spacing(1) }}>アバター絵文字</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1) }}>
                {EMOJI_OPTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => setAvatarEmoji(emoji)}
                    style={({ pressed }) => [
                      {
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: avatarEmoji === emoji ? colors.pink : colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: [{ scale: pressed ? 0.9 : 1 }]
                      }
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </BlurView>
          </View>
          
          {/* Display Name Input */}
          <View style={{ marginBottom: theme.spacing(2), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
            <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(2), backgroundColor: '#ffffff10' }}>
              <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: theme.spacing(0.5) }}>表示名（1〜30文字）</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="ママネーム"
                placeholderTextColor={colors.subtext}
                maxLength={30}
                style={{
                  color: colors.text,
                  fontSize: 16,
                  paddingVertical: theme.spacing(1),
                  paddingHorizontal: theme.spacing(1.5),
                  backgroundColor: colors.surface,
                  borderRadius: theme.radius.md,
                  marginTop: theme.spacing(0.5)
                }}
              />
              <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 4, textAlign: 'right' }}>
                {displayName.length}/30
              </Text>
            </BlurView>
          </View>
          
          {/* Bio Input */}
          <View style={{ marginBottom: theme.spacing(2), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
            <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(2), backgroundColor: '#ffffff10' }}>
              <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: theme.spacing(0.5) }}>自己紹介（500文字まで）</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="趣味や興味のあることなど、自由に書いてください"
                placeholderTextColor={colors.subtext}
                maxLength={500}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  color: colors.text,
                  fontSize: 14,
                  paddingVertical: theme.spacing(1),
                  paddingHorizontal: theme.spacing(1.5),
                  backgroundColor: colors.surface,
                  borderRadius: theme.radius.md,
                  marginTop: theme.spacing(0.5),
                  minHeight: 100,
                  lineHeight: 20
                }}
              />
              <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 4, textAlign: 'right' }}>
                {bio.length}/500
              </Text>
            </BlurView>
          </View>
          
          {/* Username (read-only) */}
          <View style={{ marginBottom: theme.spacing(2), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
            <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(2), backgroundColor: '#ffffff10' }}>
              <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: theme.spacing(0.5) }}>ユーザー名（変更不可）</Text>
              <View style={{
                paddingVertical: theme.spacing(1),
                paddingHorizontal: theme.spacing(1.5),
                backgroundColor: colors.surface,
                borderRadius: theme.radius.md,
                marginTop: theme.spacing(0.5),
                opacity: 0.6
              }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>@{profile?.username || user?.username}</Text>
              </View>
            </BlurView>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}