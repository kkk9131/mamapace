import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { getFollowing, unfollowUser } from '../services/profileService';
import Avatar from '../components/Avatar';
import { FollowUser } from '../services/profileService';
import { secureLogger } from '../utils/privacyProtection';

export default function FollowingListScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { user } = useAuth();
  const fade = new Animated.Value(0);
  Animated.timing(fade, {
    toValue: 1,
    duration: 200,
    useNativeDriver: true,
  }).start();

  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadFollowing = useCallback(
    async (refresh = false) => {
      if (!user?.id) return;

      try {
        if (refresh) {
          setRefreshing(true);
        } else if (!loading) {
          setLoadingMore(true);
        }

        const cursor = refresh ? null : nextCursor;
        const result = await getFollowing(user.id, {
          before: cursor,
          limit: 20,
        });

        if (refresh) {
          setFollowing(result.items);
        } else {
          setFollowing(prev => [...prev, ...result.items]);
        }

        setNextCursor(result.nextCursor);
      } catch (error) {
        secureLogger.error('Failed to load following:', error);
        Alert.alert('エラー', 'フォロー中の取得に失敗しました');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [user?.id, nextCursor]
  );

  useEffect(() => {
    loadFollowing(true);
  }, []);

  const handleUnfollow = async (targetUserId: string) => {
    Alert.alert('フォロー解除', 'フォローを解除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '解除',
        style: 'destructive',
        onPress: async () => {
          try {
            await unfollowUser(targetUserId);
            setFollowing(prev => prev.filter(f => f.user_id !== targetUserId));
          } catch (error: any) {
            secureLogger.error('Failed to unfollow:', error);
            Alert.alert(
              'エラー',
              error.message || 'フォロー解除に失敗しました'
            );
          }
        },
      },
    ]);
  };

  const renderFollowing = ({ item }: { item: FollowUser }) => {
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
          <Avatar uri={(item as any).avatar_url} emoji={item.avatar_emoji || '👩‍🍼'} size={44} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {item.display_name || item.username}
            </Text>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>
              @{item.username}
            </Text>
          </View>
          <Pressable
            onPress={() => handleUnfollow(item.user_id)}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing(1),
                paddingVertical: 6,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              フォロー中
            </Text>
          </Pressable>
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
        data={following}
        keyExtractor={item => item.user_id}
        contentContainerStyle={{
          padding: theme.spacing(2),
          paddingBottom: theme.spacing(10),
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(1) }} />
        )}
        renderItem={renderFollowing}
        refreshing={refreshing}
        onRefresh={() => loadFollowing(true)}
        onEndReached={() => {
          if (!loadingMore && nextCursor) {
            loadFollowing(false);
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={{ padding: theme.spacing(4), alignItems: 'center' }}>
            <Text style={{ color: colors.subtext }}>
              フォロー中のユーザーはいません
            </Text>
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
