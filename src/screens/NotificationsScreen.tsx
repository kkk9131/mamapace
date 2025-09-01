import { View, Text, FlatList, Pressable, Animated, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { notificationService, NotificationItem } from '../services/notificationService';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

const iconOf = (t: string) =>
  t === 'like' ? '💗' : t === 'comment' ? '💬' : '⭐️';

export default function NotificationsScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await notificationService.list(user.id);
      if (mounted) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);
  const fade = new Animated.Value(0);
  Animated.timing(fade, {
    toValue: 1,
    duration: 200,
    useNativeDriver: true,
  }).start();
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.pink} />
        </View>
      ) : (
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 8 }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(1) }} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={async () => {
              if (!user) return;
              if (!item.read) {
                // optimistic
                setItems(prev => prev.map(p => (p.id === item.id ? { ...p, read: true } : p)));
                const res = await notificationService.markRead(user.id, item.id);
                if (!res.ok) {
                  // revert on failure
                  setItems(prev => prev.map(p => (p.id === item.id ? { ...p, read: false } : p)));
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
                    <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>
                      <Text style={{ marginRight: 6 }}>
                        {iconOf(item.type as string)}
                      </Text>{' '}
                      {item.content}
                    </Text>
                    {/* Close button */}
                    <Pressable
                      onPress={async (e) => {
                        e.stopPropagation();
                        if (!user) return;
                        const id = item.id;
                        // optimistic remove
                        setItems(prev => prev.filter(p => p.id !== id));
                        const res = await notificationService.remove(user.id, id);
                        if (!res.ok) {
                          // revert by reloading latest page (simple fallback)
                          const { data } = await notificationService.list(user.id, { limit: 50 });
                          setItems(data);
                        }
                      }}
                      style={({ pressed }) => ({
                        marginLeft: 8,
                        opacity: pressed ? 0.6 : 0.9,
                      })}
                      hitSlop={8}
                    >
                      <Text style={{ color: colors.subtext, fontSize: 16 }}>✕</Text>
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
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ja })}
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
