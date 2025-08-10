import { View, Text, FlatList, Pressable, Animated, RefreshControl } from 'react-native';
import { useTheme } from '../theme/theme';
import { useEffect, useRef, useState } from 'react';
import PostCard from '../components/PostCard';
import { PostWithMeta } from '../types/post';
import { fetchMyPosts, toggleReaction } from '../services/postService';
import { useAuth } from '../contexts/AuthContext';

export default function MyPostsListScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
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
      if (!user?.id) return;
      const res = await fetchMyPosts({ before: opts?.refresh ? null : cursor });
      setItems(prev => opts?.refresh ? res.items : [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load({ refresh: true }); }, []);

  const onEndReached = () => {
    if (endReached.current || loading || !cursor) return;
    endReached.current = true;
    load().finally(() => { endReached.current = false; });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ refresh: true });
    setRefreshing(false);
  };

  const handleToggleLike = async (postId: string, current: boolean) => {
    setItems((prev) => prev.map(p => p.id === postId ? {
      ...p,
      reaction_summary: {
        reactedByMe: !current,
        count: p.reaction_summary.count + (current ? -1 : +1)
      }
    } : p));
    try { await toggleReaction(postId, current); } catch (e) {
      setItems((prev) => prev.map(p => p.id === postId ? {
        ...p,
        reaction_summary: { reactedByMe: current, count: p.reaction_summary.count + (current ? +1 : -1) }
      } : p));
    }
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 40, opacity: fade }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(10) }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.25) }} />}
        renderItem={({ item }) => (
          <PostCard post={item} onOpenComments={() => {}} onToggleLike={handleToggleLike} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pink} />}
        ListEmptyComponent={!loading ? () => (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Text style={{ color: colors.subtext }}>あなたのポストはまだありません</Text>
          </View>
        ) : null}
      />
    </Animated.View>
  );
}
