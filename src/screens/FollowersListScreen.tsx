import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  getFollowers,
  followUser,
  unfollowUser,
  isFollowing,
  FollowUser,
} from '../services/profileService';
import { secureLogger } from '../utils/privacyProtection';
import { getSupabaseClient } from '../services/supabaseClient';
import { chatService } from '../services/chatService';

interface FollowersListScreenProps {
  onNavigateToChat?: (chatId: string, userName: string) => void;
  onOpenUser?: (userId: string) => void;
}

export default function FollowersListScreen({
  onNavigateToChat,
  onOpenUser,
}: FollowersListScreenProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { user } = useAuth();
  const fade = new Animated.Value(0);
  Animated.timing(fade, {
    toValue: 1,
    duration: 200,
    useNativeDriver: true,
  }).start();

  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>(
    {}
  );

  const loadFollowers = useCallback(
    async (refresh = false) => {
      if (!user?.id) {
        return;
      }

      try {
        if (refresh) {
          setRefreshing(true);
        } else if (!loading) {
          setLoadingMore(true);
        }

        const cursor = refresh ? null : nextCursor;
        const result = await getFollowers(user.id, {
          before: cursor,
          limit: 20,
        });

        if (refresh) {
          setFollowers(result.items);
        } else {
          setFollowers(prev => [...prev, ...result.items]);
        }

        setNextCursor(result.nextCursor);

        // 補完: avatar_url をまとめて取得
        const ids = Array.from(new Set(result.items.map(i => i.user_id)));
        if (ids.length) {
          const { data: profiles } = await getSupabaseClient()
            .from('user_profiles')
            .select('id, avatar_url')
            .in('id', ids);
          const map: Record<string, string | null> = {};
          (profiles || []).forEach((p: any) => (map[p.id] = p.avatar_url));
          setAvatarMap(prev => ({ ...prev, ...map }));
        }

        // Check follow status for each follower
        const statusMap: { [key: string]: boolean } = {};
        for (const follower of result.items) {
          if (follower.user_id !== user.id) {
            statusMap[follower.user_id] = await isFollowing(follower.user_id);
          }
        }
        setFollowStatus(prev => ({ ...prev, ...statusMap }));
      } catch (error) {
        secureLogger.error('Failed to load followers:', error);
        Alert.alert('エラー', 'フォロワーの取得に失敗しました');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [user?.id, nextCursor]
  );

  useEffect(() => {
    loadFollowers(true);
  }, []);

  const handleFollowToggle = async (targetUserId: string) => {
    try {
      const isCurrentlyFollowing = followStatus[targetUserId];

      if (isCurrentlyFollowing) {
        await unfollowUser(targetUserId);
        setFollowStatus(prev => ({ ...prev, [targetUserId]: false }));
      } else {
        await followUser(targetUserId);
        setFollowStatus(prev => ({ ...prev, [targetUserId]: true }));
      }
    } catch (error: any) {
      secureLogger.error('Failed to toggle follow:', error);
      Alert.alert('エラー', error.message || 'フォロー操作に失敗しました');
    }
  };

  const renderFollower = ({ item }: { item: FollowUser }) => {
    const isMe = item.user_id === user?.id;
    const isCurrentlyFollowing = followStatus[item.user_id] || false;
    const displayName = item.display_name || item.username;

    return (
      <View
        style={{
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          ...theme.shadow.card,
        }}
      >
        <BlurView
          intensity={30}
          tint="dark"
          style={{
            padding: theme.spacing(1.25),
            backgroundColor: '#ffffff10',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {avatarMap[item.user_id] ? (
            <Image
              source={{ uri: avatarMap[item.user_id]! }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                marginRight: 10,
              }}
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text>{item.avatar_emoji || '👩‍🍼'}</Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${displayName}のプロフィールを開く`}
            onPress={() => {
              onOpenUser && onOpenUser(item.user_id);
            }}
            style={{ flex: 1 }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {displayName}
            </Text>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>
              @{item.username}
            </Text>
          </Pressable>
          {!isMe && (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Pressable
                accessibilityLabel={`${displayName}とチャット`}
                onPress={async () => {
                  try {
                    const res = await chatService.createOrGetChat({
                      participantIds: [item.user_id],
                      type: 'direct',
                    });
                    if (res.success && res.data?.id) {
                      onNavigateToChat &&
                        onNavigateToChat(res.data.id, displayName);
                    } else {
                      Alert.alert(
                        'エラー',
                        res.error || 'チャットの作成に失敗しました',
                      );
                    }
                  } catch (e: any) {
                    Alert.alert(
                      'エラー',
                      e?.message || 'チャットの作成に失敗しました',
                    );
                  }
                }}
                style={({ pressed }) => [
                  {
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color={colors.text}
                />
              </Pressable>
              <Pressable
                onPress={() => handleFollowToggle(item.user_id)}
                style={({ pressed }) => [
                  {
                    backgroundColor: isCurrentlyFollowing
                      ? colors.surface
                      : colors.pink,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing(1),
                    paddingVertical: 6,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text
                  style={{
                    color: isCurrentlyFollowing ? colors.text : '#23181D',
                    fontWeight: '700',
                  }}
                >
                  {isCurrentlyFollowing ? 'フォロー中' : 'フォロー'}
                </Text>
              </Pressable>
            </View>
          )}
        </BlurView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: 'transparent',
        paddingTop: 40,
        opacity: fade,
      }}
    >
      <FlatList
        data={followers}
        keyExtractor={item => item.user_id}
        contentContainerStyle={{
          padding: theme.spacing(2),
          paddingBottom: theme.spacing(10),
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(1) }} />
        )}
        renderItem={renderFollower}
        refreshing={refreshing}
        onRefresh={() => loadFollowers(true)}
        onEndReached={() => {
          if (!loadingMore && nextCursor) {
            loadFollowers(false);
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={{ padding: theme.spacing(4), alignItems: 'center' }}>
            <Text style={{ color: colors.subtext }}>フォロワーはいません</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: theme.spacing(2) }}>
              <ActivityIndicator size="small" color={colors.pink} />
            </View>
          ) : null
        }
      />
    </Animated.View>
  );
}
