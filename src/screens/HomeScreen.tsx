import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import PostCard from '../components/PostCard';
import { PostSkeletonCard } from '../components/Skeleton';
import { PostWithMeta } from '../types/post';
import { fetchHomeFeed, toggleReaction } from '../services/postService';
import { getSupabaseClient } from '../services/supabaseClient';
import { notifyError } from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';

export default function HomeScreen({
  refreshKey,
  commentDeltas,
  onCompose,
  onOpenPost,
  onOpenProfileEdit,
  onOpenUser,
}: {
  refreshKey?: number;
  commentDeltas?: Record<string, number>;
  onCompose?: () => void;
  onOpenPost?: (postId: string) => void;
  onOpenProfileEdit?: () => void;
  onOpenUser?: (userId: string) => void;
}) {
  const theme = useTheme();
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
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const endReached = useRef(false);
  const { user } = useAuth();
  const { handPreference } = useHandPreference();
  const insets = useSafeAreaInsets();

  const load = async (opts?: { refresh?: boolean }) => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      const before = opts?.refresh ? null : cursor;
      const res = await fetchHomeFeed({ before });
      setItems(prev => (opts?.refresh ? res.items : [...prev, ...res.items]));
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ refresh: true });
  }, [refreshKey]);

  // Realtime updates for reactions and comments counts
  useEffect(() => {
    let channel: any;
    (async () => {
      try {
        const client = getSupabaseClient();
        channel = client
          .channel('home-feed')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'post_comments' },
            (payload: any) => {
              const postId = payload?.new?.post_id;
              if (!postId) {
                return;
              }
              setItems(prev =>
                prev.map(p =>
                  p.id === postId
                    ? {
                        ...p,
                        comment_summary: {
                          count: (p.comment_summary.count || 0) + 1,
                        },
                      }
                    : p
                )
              );
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'post_comments' },
            (payload: any) => {
              const postId = payload?.old?.post_id;
              if (!postId) {
                return;
              }
              setItems(prev =>
                prev.map(p =>
                  p.id === postId
                    ? {
                        ...p,
                        comment_summary: {
                          count: Math.max(
                            0,
                            (p.comment_summary.count || 0) - 1
                          ),
                        },
                      }
                    : p
                )
              );
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'post_reactions' },
            (payload: any) => {
              const postId = payload?.new?.post_id;
              if (!postId) {
                return;
              }
              setItems(prev =>
                prev.map(p =>
                  p.id === postId
                    ? {
                        ...p,
                        reaction_summary: (() => {
                          const base = p.reaction_summary || {
                            reactedByMe: false,
                            count: 0,
                          };
                          return { ...base, count: (base.count || 0) + 1 };
                        })(),
                      }
                    : p
                )
              );
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'post_reactions' },
            (payload: any) => {
              const postId = payload?.old?.post_id;
              if (!postId) {
                return;
              }
              setItems(prev =>
                prev.map(p =>
                  p.id === postId
                    ? {
                        ...p,
                        reaction_summary: (() => {
                          const base = p.reaction_summary || {
                            reactedByMe: false,
                            count: 0,
                          };
                          return {
                            ...base,
                            count: Math.max(0, (base.count || 0) - 1),
                          };
                        })(),
                      }
                    : p
                )
              );
            }
          )
          .subscribe();
      } catch {}
    })();
    return () => {
      try {
        channel && getSupabaseClient().removeChannel(channel);
      } catch {}
    };
  }, []);

  const onEndReached = () => {
    if (endReached.current || loading || !cursor) {
      return;
    }
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
    // optimistic update
    setItems(prev =>
      prev.map(p => {
        if (p.id !== postId) {
          return p;
        }
        const base = p.reaction_summary || { reactedByMe: false, count: 0 };
        return {
          ...p,
          reaction_summary: {
            reactedByMe: !current,
            count: (base.count || 0) + (current ? -1 : +1),
          },
        };
      })
    );
    try {
      if (!user?.id) {
        throw new Error('not logged in');
      }
      await toggleReaction(postId, current);
    } catch (e) {
      // rollback on error
      setItems(prev =>
        prev.map(p => {
          if (p.id !== postId) {
            return p;
          }
          const base = p.reaction_summary || { reactedByMe: false, count: 0 };
          return {
            ...p,
            reaction_summary: {
              reactedByMe: current,
              count: (base.count || 0) + (current ? +1 : -1),
            },
          };
        })
      );
      notifyError('操作に失敗しました。時間をおいて再度お試しください');
    }
  };

  // Deletion is restricted to "あなた"画面（MyPostsListScreen）

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: 'transparent',
        paddingTop: 48,
        opacity: fade,
      }}
    >
      {/* Removed top quick tabs (元気/眠い/しんどい/幸せ) */}
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{
          padding: theme.spacing(2),
          paddingTop: 8,
          paddingBottom: 120,
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(2) }} />
        )}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isOwner={item.user_id === user?.id}
            // No deletion on Home; only on "あなた" screen
            commentDelta={commentDeltas?.[item.id] || 0}
            onOpenComments={id => onOpenPost && onOpenPost(id)}
            onToggleLike={handleToggleLike}
            onOpenUser={uid => onOpenUser && onOpenUser(uid)}
          />
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
                    まだポストがありません
                  </Text>
                </View>
              )
            : () => (
                <View
                  style={{
                    paddingHorizontal: theme.spacing(2),
                    gap: theme.spacing(1.5),
                  }}
                >
                  {[1, 2, 3].map(i => (
                    <View key={i} style={{ marginBottom: theme.spacing(1.5) }}>
                      <PostSkeletonCard />
                    </View>
                  ))}
                </View>
              )
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="投稿を作成"
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onCompose && onCompose();
        }}
        style={({ pressed }) => [
          {
            position: 'absolute',
            ...(handPreference === 'left' ? { left: 20 } : { right: 20 }),
            // Keep FAB above the tab bar (56) + bottom inset with a small gap
            bottom: (insets.bottom || 0) + 56 + 16,
            backgroundColor: colors.pink,
            borderRadius: 28,
            width: 56,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.97 : 1 }],
            ...theme.shadow.card,
          },
        ]}
      >
        <Text style={{ color: '#23181D', fontWeight: '700', fontSize: 24 }}>
          ＋
        </Text>
      </Pressable>
    </Animated.View>
  );
}
