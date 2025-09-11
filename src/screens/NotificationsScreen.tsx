import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

import { NOTIFICATION_PAGE_SIZE } from '../config/notificationsConfig';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  notificationService,
  NotificationItem,
} from '../services/notificationService';

const iconOf = (t: string) => {
  switch (t) {
    case 'like':
      return '💗';
    case 'comment':
      return '💬';
    case 'message':
      return '✉️';
    case 'room':
      return '🗨️';
    case 'follow':
      return '➕';
    case 'system':
    default:
      return '⭐️';
  }
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadInitial = async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    const { data, nextCursor } = await notificationService.list(user.id, {
      limit: NOTIFICATION_PAGE_SIZE,
    });
    setItems(data);
    setNextCursor(nextCursor ?? null);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!user) {
        return;
      }
      await loadInitial();
    })();
  }, [user?.id]);

  const onRefresh = async () => {
    if (!user) {
      return;
    }
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!user || loadingMore || !nextCursor) {
      return;
    }
    setLoadingMore(true);
    const { data, nextCursor: next } = await notificationService.list(user.id, {
      limit: NOTIFICATION_PAGE_SIZE,
      cursor: nextCursor,
    });
    setItems(prev => [...prev, ...data]);
    setNextCursor(next ?? null);
    setLoadingMore(false);
  };
  // Prevent flash on enter with static opacity value
  const fade = useMemo(() => new Animated.Value(1), []);
  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: 'transparent',
        paddingTop: 40,
        opacity: fade,
      }}
    >
      {loading ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={colors.pink} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.pink}
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator color={colors.pink} />
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: theme.spacing(1) }} />
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={async () => {
                if (!user) {
                  return;
                }
                if (!item.read) {
                  // optimistic
                  setItems(prev =>
                    prev.map(p => (p.id === item.id ? { ...p, read: true } : p)),
                  );
                  const res = await notificationService.markRead(
                    user.id,
                    item.id,
                  );
                  if (!res.ok) {
                    // revert on failure
                    setItems(prev =>
                      prev.map(p =>
                        p.id === item.id ? { ...p, read: false } : p,
                      ),
                    );
                  }
                }
              }}
              style={({ pressed }) => [
                {
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: item.read ? 0.7 : 1,
                  ...theme.shadow.card,
                },
              ]}
            >
              <BlurView
                intensity={30}
                tint="dark"
                style={{
                  padding: theme.spacing(1.5),
                  backgroundColor: '#ffffff10',
                }}
              >
                <View style={{ flexDirection: 'row' }}>
                  <View
                    style={{
                      width: 4,
                      backgroundColor: item.read ? '#ffffff20' : colors.pink,
                      borderRadius: 2,
                      marginRight: 10,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{ color: colors.text, fontSize: 16, flex: 1 }}
                      >
                        <Text style={{ marginRight: 6 }}>
                          {iconOf(item.type as string)}
                        </Text>{' '}
                        {item.content}
                      </Text>
                      {/* Close button */}
                      <Pressable
                        onPress={async e => {
                          e.stopPropagation();
                          if (!user) {
                            return;
                          }
                          const id = item.id;
                          // optimistic remove
                          setItems(prev => prev.filter(p => p.id !== id));
                          const res = await notificationService.remove(
                            user.id,
                            id,
                          );
                          if (!res.ok) {
                            // revert by reloading latest page (simple fallback)
                            const { data } = await notificationService.list(
                              user.id,
                              { limit: 50 },
                            );
                            setItems(data);
                          }
                        }}
                        style={({ pressed }) => ({
                          marginLeft: 8,
                          opacity: pressed ? 0.6 : 0.9,
                        })}
                        hitSlop={8}
                      >
                        <Text style={{ color: colors.subtext, fontSize: 16 }}>
                          ✕
                        </Text>
                      </Pressable>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginBottom: 6 }}>
                      <Text
                        style={{
                          color: colors.subtext,
                          fontSize: 13,
                          opacity: 0.9,
                          backgroundColor: colors.surface,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 8,
                        }}
                      >
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                          locale: ja,
                        })}
                      </Text>
                    </View>
                    {!item.read && (
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          backgroundColor: colors.pink,
                          borderRadius: 10,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: '#23181D',
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          新着
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </BlurView>
            </Pressable>
          )}
        />
      )}
    </Animated.View>
  );
}
