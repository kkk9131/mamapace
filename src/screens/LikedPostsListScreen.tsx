import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useEffect, useRef, useState } from 'react';
import PostCard from '../components/PostCard';
import { PostWithMeta } from '../types/post';
import { fetchLikedPosts, toggleReaction } from '../services/postService';
import { notifyError } from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';

export default function LikedPostsListScreen({
  commentDeltas,
  onOpen,
}: {
  commentDeltas?: Record<string, number>;
  onOpen?: (postId: string) => void;
}) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fade]);
  const [items, setItems] = useState<PostWithMeta[]>([]);
  const { user } = useAuth();
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const endReached = useRef(false);

  const load = async (opts?: { refresh?: boolean }) => {
    if (loading) return;
    setLoading(true);
    try {
      const before = opts?.refresh ? null : cursor;
      if (!user?.id) return;
      const res = await fetchLikedPosts({ before });
      setItems(prev => (opts?.refresh ? res.items : [...prev, ...res.items]));
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ refresh: true });
  }, []);

  const onEndReached = () => {
    if (endReached.current || loading || !cursor) return;
    endReached.current = true;
    load().finally(() => {
      endReached.current = false;
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ refresh: true });
    setRefreshing(false);
  };

  const handleToggleLike = async (postId: string, current: boolean) => {
    // optimistic update + if un-like, remove from list
    if (current) {
      setItems(prev => prev.filter(p => p.id !== postId));
    } else {
      setItems(prev =>
        prev.map(p =>
          p.id === postId
            ? {
                ...p,
                reaction_summary: {
                  reactedByMe: true,
                  count: p.reaction_summary.count + 1,
                },
              }
            : p
        )
      );
    }
    try {
      if (user?.id) await toggleReaction(postId, current);
    } catch (e) {
      notifyError('操作に失敗しました。時間をおいて再度お試しください');
    }
  };
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
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{
          padding: theme.spacing(2),
          paddingBottom: theme.spacing(10),
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(1.25) }} />
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ポストを開く"
            onPress={() => onOpen && onOpen(item.id)}
            style={({ pressed }) => [
              {
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.shadow.card,
              },
            ]}
          >
            <PostCard
              post={item}
              commentDelta={commentDeltas?.[item.id] || 0}
              onOpenComments={id => onOpen && onOpen(id)}
              onToggleLike={handleToggleLike}
            />
          </Pressable>
        )}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.pink}
          />
        }
        ListEmptyComponent={
          !loading
            ? () => (
                <View style={{ alignItems: 'center', paddingTop: 80 }}>
                  <Text style={{ color: colors.subtext }}>
                    共感したポストはまだありません
                  </Text>
                </View>
              )
            : null
        }
      />
    </Animated.View>
  );
}
