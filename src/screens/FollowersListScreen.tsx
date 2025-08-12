import { View, Text, FlatList, Pressable, Animated, ActivityIndicator, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { getFollowers, followUser, unfollowUser, isFollowing } from '../services/profileService';
import { FollowUser } from '../services/profileService';
import { secureLogger } from '../utils/privacyProtection';

export default function FollowersListScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { user } = useAuth();
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
  
  const loadFollowers = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    
    try {
      if (refresh) {
        setRefreshing(true);
      } else if (!loading) {
        setLoadingMore(true);
      }
      
      const cursor = refresh ? null : nextCursor;
      const result = await getFollowers(user.id, { before: cursor, limit: 20 });
      
      if (refresh) {
        setFollowers(result.items);
      } else {
        setFollowers(prev => [...prev, ...result.items]);
      }
      
      setNextCursor(result.nextCursor);
      
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
  }, [user?.id, nextCursor]);
  
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
    
    return (
      <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.25), backgroundColor: '#ffffff10', flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Text>{item.avatar_emoji || '👩‍🍼'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.display_name || item.username}</Text>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>@{item.username}</Text>
          </View>
          {!isMe && (
            <Pressable 
              onPress={() => handleFollowToggle(item.user_id)}
              style={({ pressed }) => [
                { 
                  backgroundColor: isCurrentlyFollowing ? colors.surface : colors.pink, 
                  borderRadius: theme.radius.md, 
                  paddingHorizontal: theme.spacing(1), 
                  paddingVertical: 6, 
                  transform: [{ scale: pressed ? 0.97 : 1 }] 
                }
              ]}
            > 
              <Text style={{ color: isCurrentlyFollowing ? colors.text : '#23181D', fontWeight: '700' }}>
                {isCurrentlyFollowing ? 'フォロー中' : 'フォロー'}
              </Text>
            </Pressable>
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
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 40, opacity: fade }}>
      <FlatList
        data={followers}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(10) }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
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
