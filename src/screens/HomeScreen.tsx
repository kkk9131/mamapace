import { View, Text, FlatList, Pressable, Animated, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../theme/theme';
import PostCard from '../components/PostCard';
import { PostSkeletonCard } from '../components/Skeleton';
import { PostWithMeta } from '../types/post';
import { fetchHomeFeed, toggleReaction, deletePost } from '../services/postService';
import { getSupabaseClient } from '../services/supabaseClient';
import { notifyError } from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen({ refreshKey, commentDeltas, onCompose, onOpenPost }: { refreshKey?: number; commentDeltas?: Record<string, number>; onCompose?: () => void; onOpenPost?: (postId: string) => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [fade]);

  const [items, setItems] = useState<PostWithMeta[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const endReached = useRef(false);
  const { user } = useAuth();

  const load = async (opts?: { refresh?: boolean }) => {
    if (loading) return;
    setLoading(true);
    try {
      const before = opts?.refresh ? null : cursor;
      const res = await fetchHomeFeed({ before });
      setItems((prev) => (opts?.refresh ? res.items : [...prev, ...res.items]));
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load({ refresh: true }); }, [refreshKey]);

  // Realtime updates for reactions and comments counts
  useEffect(() => {
    let channel: any;
    (async () => {
      try {
        const client = getSupabaseClient();
        channel = client
          .channel('home-feed')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, (payload: any) => {
            const postId = payload?.new?.post_id;
            if (!postId) return;
            setItems(prev => prev.map(p => p.id === postId ? ({
              ...p,
              comment_summary: { count: (p.comment_summary.count || 0) + 1 }
            }) : p));
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_comments' }, (payload: any) => {
            const postId = payload?.old?.post_id;
            if (!postId) return;
            setItems(prev => prev.map(p => p.id === postId ? ({
              ...p,
              comment_summary: { count: Math.max(0, (p.comment_summary.count || 0) - 1) }
            }) : p));
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_reactions' }, (payload: any) => {
            const postId = payload?.new?.post_id;
            if (!postId) return;
            setItems(prev => prev.map(p => p.id === postId ? ({
              ...p,
              reaction_summary: { ...p.reaction_summary, count: (p.reaction_summary.count || 0) + 1 }
            }) : p));
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_reactions' }, (payload: any) => {
            const postId = payload?.old?.post_id;
            if (!postId) return;
            setItems(prev => prev.map(p => p.id === postId ? ({
              ...p,
              reaction_summary: { ...p.reaction_summary, count: Math.max(0, (p.reaction_summary.count || 0) - 1) }
            }) : p));
          })
          .subscribe();
      } catch {}
    })();
    return () => {
      try { channel && getSupabaseClient().removeChannel(channel); } catch {}
    };
  }, []);

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
    // optimistic update
    setItems((prev) => prev.map(p => p.id === postId ? {
      ...p,
      reaction_summary: {
        reactedByMe: !current,
        count: p.reaction_summary.count + (current ? -1 : +1)
      }
    } : p));
    try {
      if (!user?.id) throw new Error('not logged in');
      await toggleReaction(postId, current);
    } catch (e) {
      // rollback on error
      setItems((prev) => prev.map(p => p.id === postId ? {
        ...p,
        reaction_summary: {
          reactedByMe: current,
          count: p.reaction_summary.count + (current ? +1 : -1)
        }
      } : p));
      notifyError('操作に失敗しました。時間をおいて再度お試しください');
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      if (!user?.id) return;
      await deletePost(postId);
      setItems(prev => prev.filter(p => p.id !== postId));
    } catch (e: any) {
      notifyError(e?.message || '削除に失敗しました');
    }
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 48, opacity: fade }}>
      <View style={{ paddingHorizontal: theme.spacing(2), marginBottom: 20 }}>
        <View style={{ borderRadius: 999, overflow: 'hidden' }}>
          <BlurView intensity={40} tint="dark" style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#ffffff0E' }}>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
              {['元気','眠い','しんどい','幸せ'].map((m) => (
                <Pressable key={m} style={({ pressed }) => [{ backgroundColor: '#ffffff12', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
                  <Text style={{ color: colors.text, fontSize: 12 }}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </BlurView>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 8, paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(2) }} />}
        renderItem={({ item }) => (
          <PostCard post={item} isOwner={item.user_id===user?.id} onDelete={handleDelete} commentDelta={commentDeltas?.[item.id] || 0} onOpenComments={(id) => onOpenPost && onOpenPost(id)} onToggleLike={handleToggleLike} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pink} />}
        ListEmptyComponent={!loading ? () => (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Text style={{ color: colors.subtext }}>まだポストがありません</Text>
          </View>
        ) : () => (
          <View style={{ paddingHorizontal: theme.spacing(2), gap: theme.spacing(1.5) }}>
            {[1,2,3].map(i => (
              <View key={i} style={{ marginBottom: theme.spacing(1.5) }}>
                <PostSkeletonCard />
              </View>
            ))}
          </View>
        )}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="投稿を作成" onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCompose && onCompose(); }} style={({ pressed }) => [{ position: 'absolute', right: 20, bottom: 88, backgroundColor: colors.pink, borderRadius: 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }], ...theme.shadow.card }]}>
        <Text style={{ color: '#23181D', fontWeight: '700', fontSize: 24 }}>＋</Text>
      </Pressable>
    </Animated.View>
  );
}
