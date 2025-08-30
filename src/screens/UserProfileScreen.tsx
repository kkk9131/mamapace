import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import PostCard from '../components/PostCard';
import { PostWithMeta } from '../types/post';
import {
  getFollowCounts,
  isFollowing,
  followUser,
  unfollowUser,
  getUserProfile,
} from '../services/profileService';
import { PublicUserProfile } from '../types/auth';
import { fetchHomeFeed } from '../services/postService';
import { secureLogger } from '../utils/privacyProtection';
import { chatService } from '../services/chatService';

interface UserProfileScreenProps {
  userId: string;
  onBack?: () => void;
  onNavigateToChat?: (chatId: string, userName: string) => void;
}

export default function UserProfileScreen({
  userId,
  onBack,
  onNavigateToChat,
}: UserProfileScreenProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { user } = useAuth();
  const { handPreference } = useHandPreference();

  const [userData, setUserData] = useState<PublicUserProfile | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const fade = new Animated.Value(1);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);

      // Try to load user profile data first
      try {
        const profile = await getUserProfile(userId);
        setUserData(profile);
      } catch (profileError) {
        secureLogger.warn(
          'Failed to load profile via RPC, falling back to post data:',
          profileError
        );
        // Fallback to extracting from posts if RPC fails
        const feed = await fetchHomeFeed({ before: null });
        const userPosts = feed.items.filter(post => post.user_id === userId);

        if (userPosts.length > 0 && userPosts[0].user) {
          const userInfo = userPosts[0].user;
          setUserData({
            id: userId,
            username: userInfo.username,
            display_name: userInfo.display_name,
            bio: '', // Not available from posts
            avatar_emoji: userInfo.avatar_emoji,
            created_at: '',
            updated_at: '',
            profile_visibility: 'public',
            is_active: true,
          } as PublicUserProfile);
        } else {
          // Ultimate fallback
          setUserData({
            id: userId,
            username: 'user',
            display_name: 'ユーザー',
            bio: '',
            avatar_emoji: '👤',
            created_at: '',
            updated_at: '',
            profile_visibility: 'public',
            is_active: true,
          } as PublicUserProfile);
        }
      }

      // Load follow counts
      const followCounts = await getFollowCounts(userId);
      setCounts(followCounts);

      // Check if current user is following this user
      const isUserFollowing = await isFollowing(userId);
      setFollowing(isUserFollowing);

      // Load user posts (using home feed for now, filtered by userId)
      // TODO: Replace with get_user_posts_v2 when available
      const feed = await fetchHomeFeed({ before: null });
      const userPosts = feed.items.filter(post => post.user_id === userId);
      setPosts(userPosts);
    } catch (error: any) {
      secureLogger.error('Failed to load user data:', error);
      Alert.alert('エラー', 'ユーザー情報の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
        setCounts(prev => ({
          ...prev,
          followers: Math.max(0, prev.followers - 1),
        }));
      } else {
        await followUser(userId);
        setFollowing(true);
        setCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (error: any) {
      secureLogger.error('Failed to toggle follow:', error);
      Alert.alert('エラー', 'フォロー操作に失敗しました');
    }
  };

  const handleStartChat = async (targetUserId: string, userName: string) => {
    // Prevent multiple simultaneous calls
    if (isStartingChat) {
      // Chat start already in progress
      return;
    }

    try {
      setIsStartingChat(true);

      // Check if user is logged in
      if (!user) {
        Alert.alert('エラー', 'チャット機能を使用するにはログインが必要です。');
        return;
      }

      // Starting chat

      // Create or get existing conversation
      const response = await chatService.createOrGetChat({
        participantIds: [targetUserId],
        type: 'direct',
      });

      // Chat created

      if (response.success && response.data) {
        // Navigate to chat screen
        if (onNavigateToChat) {
          onNavigateToChat(response.data.id, userName);
        } else {
          Alert.alert('成功', `${userName}とのチャットが開始されました`);
        }
      } else {
        // Chat creation failed
        const errorMessage = response.error || 'チャットの作成に失敗しました';
        Alert.alert('エラー', errorMessage);
      }
    } catch (error: any) {
      // Failed to start chat
      Alert.alert(
        'エラー',
        `チャット機能でエラーが発生しました:\n${error.message || error}`
      );
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: colors.bg || '#000',
        paddingTop: 48,
        opacity: fade,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: handPreference === 'left' ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '800',
          }}
        >

        </Text>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              {
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: colors.surface,
                borderRadius: 999,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>
              {handPreference === 'left' ? '←' : '→'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Profile Card */}
      <View
        style={{
          paddingHorizontal: theme.spacing(2),
          marginBottom: theme.spacing(1.5),
        }}
      >
        <View
          style={{
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
            ...theme.shadow.card,
          }}
        >
          <BlurView
            intensity={20}
            tint="dark"
            style={{
              padding: theme.spacing(1.75),
              backgroundColor: '#ffffff10',
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                {userData?.avatar_url ? (
                  <Animated.Image
                    source={{ uri: userData.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <Text style={{ fontSize: 24 }}>
                    {userData?.avatar_emoji || '👤'}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 20,
                  fontWeight: '800',
                }}
              >
                {userData?.display_name || 'ユーザー'}
              </Text>
            </View>

            {userData?.bio && userData.bio.trim() && (
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14,
                  marginTop: 8,
                  lineHeight: 20,
                }}
              >
                {userData.bio}
              </Text>
            )}

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Text style={{ color: colors.subtext }}>
                フォロー {counts.following} ・ フォロワー {counts.followers}
              </Text>
              {user?.id !== userId && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {/* Chat Button */}
                  <Pressable
                    onPress={() =>
                      !isStartingChat &&
                      handleStartChat(
                        userId,
                        userData?.display_name || 'ユーザー'
                      )
                    }
                    disabled={isStartingChat}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: isStartingChat
                          ? colors.subtext
                          : colors.surface,
                        borderRadius: 999,
                        transform: [
                          { scale: pressed && !isStartingChat ? 0.97 : 1 },
                        ],
                        opacity: isStartingChat ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {isStartingChat ? '処理中...' : '💬 チャット'}
                    </Text>
                  </Pressable>

                  {/* Follow Button */}
                  <Pressable
                    onPress={toggleFollow}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: following
                          ? colors.surface
                          : colors.pink,
                        borderRadius: 999,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: following ? colors.text : '#000',
                        fontWeight: '700',
                      }}
                    >
                      {following ? 'フォロー中' : 'フォロー'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </BlurView>
        </View>
      </View>

      {/* Posts List */}
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size="large" color={colors.pink} />
          <Text style={{ color: colors.subtext, marginTop: 10 }}>
            投稿を読み込み中...
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          contentContainerStyle={{
            padding: theme.spacing(2),
            paddingBottom: 120,
          }}
          ItemSeparatorComponent={() => (
            <View style={{ height: theme.spacing(1.25) }} />
          )}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onOpenComments={() => {}}
              onOpenUser={() => {}}
              onToggleLike={() => {}}
            />
          )}
          ListEmptyComponent={() => (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingTop: 100,
              }}
            >
              <Text style={{ color: colors.subtext, fontSize: 16 }}>
                まだ投稿がありません
              </Text>
            </View>
          )}
        />
      )}
    </Animated.View>
  );
}
