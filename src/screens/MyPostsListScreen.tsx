import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { useTheme } from '../theme/theme';
import PostCard from '../components/PostCard';
import { PostWithMeta } from '../types/post';
import {
  fetchMyPosts,
  toggleReaction,
  deletePost,
} from '../services/postService';
import { notifyError } from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';

export default function MyPostsListScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, {
    toValue: 1,
    duration: 200,
    useNativeDriver: true,
  }).start();
  const [items, setItems] = useState<PostWithMeta[]>([]);
  const { user } = useAuth();
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const endReached = useRef(false);

  const load = async (opts?: { refresh?: boolean }) => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      if (!user?.id) {
        return;
      }
      const res = await fetchMyPosts({ before: opts?.refresh ? null : cursor });
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
      await toggleReaction(postId, current);
    } catch (e) {
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
    }
  };

  const handleDelete = async (postId: string) => {
    Alert.alert('投稿を削除', 'この投稿を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!user?.id) {
              return;
            }
            await deletePost(postId);
            setItems(prev => prev.filter(p => p.id !== postId));
          } catch (e: any) {
            notifyError(e?.message || '削除に失敗しました');
          }
        },
      },
    ]);
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
          <PostCard
            post={item}
            onOpenComments={() => {}}
            onToggleLike={handleToggleLike}
            isOwner={true}
            onDelete={handleDelete}
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
                    あなたのポストはまだありません
                  </Text>
                </View>
              )
            : null
        }
      />
    </Animated.View>
  );
}
