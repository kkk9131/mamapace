import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';

import { SkeletonLine } from '../components/Skeleton';
import { useTheme } from '../theme/theme';
import { Comment } from '../types/post';
import {
  createComment,
  fetchComments,
  deleteComment,
} from '../services/postService';
import { notifyError } from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { getSupabaseClient } from '../services/supabaseClient';
import ExpandableText from '../components/ExpandableText';
import VerifiedBadge from '../components/VerifiedBadge';

export default function CommentsListScreen({
  postId,
  refreshKey,
  onCompose,
  onOpenUser,
}: {
  postId: string;
  refreshKey?: number;
  onCompose?: () => void;
  onOpenUser?: (userId: string) => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const { handPreference } = useHandPreference();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fade]);
  const [items, setItems] = useState<Comment[]>([]);
  const [viewer, setViewer] = useState<{ visible: boolean; url?: string }>({
    visible: false,
  });
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
      const res = await fetchComments(postId, {
        before: opts?.refresh ? null : cursor,
      });
      setItems(prev => (opts?.refresh ? res.items : [...prev, ...res.items]));
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ refresh: true });
  }, [postId, refreshKey]);

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

  // Realtime subscription for this post's comments
  useEffect(() => {
    let channel: any;
    (async () => {
      try {
        const client = getSupabaseClient();
        channel = client
          .channel(`comments-${postId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'post_comments',
              filter: `post_id=eq.${postId}`,
            },
            (payload: any) => {
              const pid = payload?.new?.post_id ?? payload?.old?.post_id;
              if (pid !== postId) {
                return;
              }
              // refetch list to include joined user fields consistently
              load({ refresh: true });
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
  }, [postId]);
  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: 'transparent',
        paddingTop: 40,
        opacity: fade,
      }}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing(2),
          marginBottom: theme.spacing(1.25),
        }}
      >
        <View style={{ borderRadius: 999, overflow: 'hidden' }}>
          <BlurView
            intensity={30}
            tint="dark"
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: '#ffffff10',
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
            >
              コメント
            </Text>
          </BlurView>
        </View>
      </View>
      <FlatList
        data={[...items].reverse()}
        keyExtractor={i => i.id}
        contentContainerStyle={{
          padding: theme.spacing(2),
          paddingBottom: theme.spacing(10),
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(1) }} />
        )}
        renderItem={({ item }) => (
          <View
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${item.user?.display_name || item.user?.username || '匿名'}のコメント`}
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
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.user?.display_name || item.user?.username || '匿名'}のプロフィールを開く`}
                  onPress={() => {
                    onOpenUser && onOpenUser(item.user_id);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  {item.user?.avatar_url ? (
                    <Image
                      source={{ uri: item.user.avatar_url }}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        marginRight: 6,
                      }}
                    />
                  ) : (
                    <Text style={{ fontSize: 14, marginRight: 6 }}>
                      {item.user?.avatar_emoji || '👤'}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      {item.user?.display_name || item.user?.username || '匿名'}
                    </Text>
                    {item.user?.maternal_verified && <VerifiedBadge size={14} />}
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      ・ {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                </Pressable>
                {item.user_id === user?.id && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="コメントを削除"
                    onPress={async () => {
                      try {
                        await deleteComment(item.id);
                        setItems(prev => prev.filter(c => c.id !== item.id));
                      } catch (e: any) {
                        notifyError(
                          e?.message || 'コメントの削除に失敗しました'
                        );
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: colors.surface,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <Text style={{ color: colors.pink }}>🗑</Text>
                  </Pressable>
                )}
              </View>
              {item.body && item.body !== '[image]' && (
                <ExpandableText
                  text={item.body}
                  maxLines={3}
                  textStyle={{ color: colors.text }}
                />
              )}
              {/* Attachments */}
              {Array.isArray(item.attachments) &&
                item.attachments.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <View
                      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                    >
                      {item.attachments
                        .slice(0, 4)
                        .map((att: any, idx: number) => (
                          <Pressable
                            key={idx}
                            onPress={() =>
                              setViewer({ visible: true, url: att.url })
                            }
                            style={{
                              width: '23%',
                              aspectRatio: 1,
                              borderRadius: 8,
                              overflow: 'hidden',
                              backgroundColor: '#ffffff12',
                            }}
                          >
                            <Image
                              source={{ uri: att.url }}
                              style={{ width: '100%', height: '100%' }}
                            />
                          </Pressable>
                        ))}
                    </View>
                  </View>
                )}
            </BlurView>
          </View>
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
                    まだコメントがありません
                  </Text>
                </View>
              )
            : () => (
                <View style={{ paddingHorizontal: theme.spacing(2) }}>
                  {[1, 2, 3, 4].map(i => (
                    <View key={i} style={{ marginBottom: theme.spacing(1) }}>
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
                          }}
                        >
                          <SkeletonLine
                            width={120}
                            height={10}
                            style={{ marginBottom: 6 }}
                          />
                          <SkeletonLine
                            height={12}
                            style={{ marginBottom: 6 }}
                          />
                          <SkeletonLine height={12} width={'90%'} />
                        </BlurView>
                      </View>
                    </View>
                  ))}
                </View>
              )
        }
      />
      {onCompose && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="コメントを作成"
          onPress={onCompose}
          style={({ pressed }) => [
            {
              position: 'absolute',
              ...(handPreference === 'left' ? { left: 20 } : { right: 20 }),
              bottom: 88,
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
      )}
      {/* Viewer */}
      <Modal
        visible={viewer.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer({ visible: false })}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: '#000000CC',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => setViewer({ visible: false })}
        >
          {viewer.url ? (
            <Image
              source={{ uri: viewer.url }}
              style={{ width: '90%', height: '70%', resizeMode: 'contain' }}
            />
          ) : null}
        </Pressable>
      </Modal>
    </Animated.View>
  );
}
