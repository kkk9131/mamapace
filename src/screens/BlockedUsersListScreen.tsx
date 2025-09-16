import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/theme';
import { useBlockedList } from '../hooks/useBlock';
import { getSupabaseClient } from '../services/supabaseClient';
import VerifiedBadge from '../components/VerifiedBadge';
import { notifyError } from '../utils/notify';

type ProfileLite = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  avatar_emoji?: string | null;
  maternal_verified?: boolean | null;
};

interface BlockedUsersListScreenProps {
  onBack?: () => void;
  onOpenUser?: (userId: string) => void;
}

export default function BlockedUsersListScreen({
  onBack,
  onOpenUser,
}: BlockedUsersListScreenProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { blocked, unblock, refresh } = useBlockedList();

  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [refreshing, setRefreshing] = useState(false);

  const ids = blocked;

  const loadProfiles = useCallback(async () => {
    if (!ids.length) {
      setProfiles({});
      return;
    }
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: base } = await supabase
        .from('user_profiles')
        .select('id, display_name, username, avatar_url, avatar_emoji')
        .in('id', ids);
      const { data: pubs } = await supabase
        .from('user_profiles_public')
        .select('id, maternal_verified')
        .in('id', ids);
      const badgeMap: Record<string, boolean> = {};
      (pubs || []).forEach(
        (p: any) => (badgeMap[p.id] = !!p.maternal_verified),
      );
      const map: Record<string, ProfileLite> = {};
      (base || []).forEach((p: any) => {
        map[p.id] = {
          id: p.id,
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
          avatar_emoji: p.avatar_emoji,
          maternal_verified: badgeMap[p.id] || false,
        };
      });
      setProfiles(map);
    } catch {
      // Show minimal feedback and keep degraded display
      notifyError('プロフィールの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const data = useMemo(
    () => ids.map(id => profiles[id] || { id }),
    [ids, profiles],
  );

  const handleUnblock = useCallback(
    (userId: string, label?: string | null) => {
      const name = label || 'ユーザー';
      Alert.alert('ブロック解除', `${name}のブロックを解除しますか？`, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解除',
          style: 'destructive',
          onPress: async () => {
            try {
              await unblock(userId);
            } catch {}
          },
        },
      ]);
    },
    [unblock]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 48 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#ffffff10',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
          ブロックしたユーザー
        </Text>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: colors.surface,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>戻る</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" color={colors.pink} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={i => i.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await refresh();
                  await loadProfiles();
                } catch {
                  notifyError('最新のブロック情報の取得に失敗しました');
                } finally {
                  setRefreshing(false);
                }
              }}
              tintColor={colors.pink}
            />
          }
          contentContainerStyle={{
            padding: theme.spacing(2),
            paddingBottom: theme.spacing(10),
          }}
          ListEmptyComponent={() => (
            <View style={{ padding: theme.spacing(4), alignItems: 'center' }}>
              <Text style={{ color: colors.subtext }}>
                ブロックしているユーザーはいません
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => (
            <View style={{ height: theme.spacing(1) }} />
          )}
          renderItem={({ item }) => {
            const displayName = item.display_name || item.username || item.id;
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
                  {item.avatar_url ? (
                    <Image
                      source={{ uri: item.avatar_url }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        marginRight: 10,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <Text>{item.avatar_emoji || '👤'}</Text>
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${displayName}のプロフィールを開く`}
                    onPress={() => onOpenUser && onOpenUser(item.id)}
                    style={{ flex: 1 }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '700' }}>
                        {displayName}
                      </Text>
                      {item.maternal_verified && <VerifiedBadge size={16} />}
                    </View>
                    {!!item.username && (
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>
                        @{item.username}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => handleUnblock(item.id, displayName)}
                    style={({ pressed }) => ({
                      backgroundColor: colors.surface,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing(1),
                      paddingVertical: 6,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      解除
                    </Text>
                  </Pressable>
                </BlurView>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
