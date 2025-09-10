import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../theme/theme';
import { useChatList } from '../hooks/useChatList';
import { useAuth } from '../contexts/AuthContext';
import { ChatWithParticipants } from '../types/chat';
import { getSupabaseClient } from '../services/supabaseClient';
// import { chatService } from '../services/chatService';
import VerifiedBadge from '../components/VerifiedBadge';
import { useBlockedList } from '../hooks/useBlock';

interface ChatsListScreenProps {
  onOpen?: (chatId: string, userName: string) => void;
  onOpenFollowers?: () => void;
  onOpenAIChat?: () => void;
  filters?: {
    hasUnread?: boolean;
    chatType?: 'direct' | 'group';
    participantId?: string;
  };
}

export default function ChatsListScreen({
  onOpen,
  onOpenFollowers,
  onOpenAIChat,
  filters = {},
}: ChatsListScreenProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { user } = useAuth();
  const { blocked } = useBlockedList();
  // AI FAB icon (fixed)

  // 開いたチャットの最終確認時刻を記録（NEWタグ管理用）
  const [lastViewedTimes, setLastViewedTimes] = useState<Map<string, string>>(
    new Map()
  );

  // 初期ロード完了フラグ（空のMapを保存しないため）
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // 画面フォーカス時の強制再レンダリング用
  const [renderKey, setRenderKey] = useState(0);

  // AsyncStorageから最終確認時刻を復元
  useEffect(() => {
    const loadLastViewedTimes = async () => {
      try {
        const stored = await AsyncStorage.getItem(
          `last_viewed_times_${user?.id}`
        );
        if (stored) {
          const parsedTimes = JSON.parse(stored);
          setLastViewedTimes(new Map(Object.entries(parsedTimes)));
        }
        setIsInitialLoadComplete(true);
      } catch (error) {
        // Error restoring last viewed times
        setIsInitialLoadComplete(true);
      }
    };

    if (user?.id) {
      loadLastViewedTimes();
    }
  }, [user?.id]);

  // 最終確認時刻の変更を監視・保存（初期ロード完了後のみ）
  useEffect(() => {
    const saveLastViewedTimes = async () => {
      try {
        const timesObject = Object.fromEntries(lastViewedTimes);
        const key = `last_viewed_times_${user?.id}`;
        await AsyncStorage.setItem(key, JSON.stringify(timesObject));
      } catch (error) {
        // Error saving last viewed times
      }
    };

    if (user?.id && isInitialLoadComplete) {
      saveLastViewedTimes();
    }
  }, [lastViewedTimes, user?.id, isInitialLoadComplete]);

  // 新規メッセージがあるかチェック（時刻ベース）
  const hasNewMessage = useCallback(
    (chat: ChatWithParticipants) => {
      // 最終メッセージがない場合は新規なし
      if (!chat.last_message?.content) {
        return false;
      }

      // 送信者情報がない場合は新規なし
      if (!chat.last_message.sender_id) {
        return false;
      }

      // 自分が送信者の場合は新規なし
      if (chat.last_message.sender_id === user?.id) {
        return false;
      }

      // 最終確認時刻を取得
      const lastViewedTime = lastViewedTimes.get(chat.id);
      if (!lastViewedTime) {
        return true; // 初回確認
      }

      // 最終メッセージの時刻と最終確認時刻を比較
      const lastMessageTime = chat.last_message.created_at || '';
      return lastMessageTime > lastViewedTime;
    },
    [user?.id, lastViewedTimes]
  );

  // Use chat list hook
  const { chats, isLoading, error, refreshChats, clearError, retry, isEmpty } =
    useChatList(filters);

  // 補完: 参加者のavatar_urlを一括取得
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const [badgeMap, setBadgeMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    (async () => {
      try {
        const ids = Array.from(
          new Set(
            (chats || [])
              .map(c => c.participants?.find(p => p.id !== user?.id)?.id)
              .filter(Boolean) as string[]
          )
        );
        if (ids.length) {
          const { data: profiles } = await getSupabaseClient()
            .from('user_profiles')
            .select('id, avatar_url')
            .in('id', ids);
          const map: Record<string, string | null> = {};
          (profiles || []).forEach((p: any) => (map[p.id] = p.avatar_url));
          setAvatarMap(map);

          const { data: pubs } = await getSupabaseClient()
            .from('user_profiles_public')
            .select('id, maternal_verified')
            .in('id', ids);
          const bmap: Record<string, boolean> = {};
          (pubs || []).forEach(
            (p: any) => (bmap[p.id] = !!p.maternal_verified),
          );
          setBadgeMap(bmap);
        }
      } catch {}
    })();
  }, [chats, user?.id]);

  // シンプル版：新規メッセージ検出は無効化し、チャットを開いた時のみNEW表示を消去

  // 時刻ベースの判定なので、新しいメッセージ検出の処理は不要

  // 画面にフォーカスが戻った時に再レンダリングを強制
  useFocusEffect(
    useCallback(() => {
      setRenderKey(prev => prev + 1);
    }, [lastViewedTimes])
  );

  // Handle chat press
  const handleChatPress = useCallback(
    async (chat: ChatWithParticipants) => {
      // 現在の時刻を記録（NEW表示を消すため）
      const currentTime = new Date().toISOString();

      // 状態とAsyncStorageの両方を更新
      const newMap = new Map(lastViewedTimes);
      newMap.set(chat.id, currentTime);

      // 状態を更新
      setLastViewedTimes(newMap);

      // AsyncStorageに直接保存（状態更新を待たない）
      try {
        const timesObject = Object.fromEntries(newMap);
        const key = `last_viewed_times_${user?.id}`;
        await AsyncStorage.setItem(key, JSON.stringify(timesObject));
      } catch (error) {
        // AsyncStorage save error
      }

      if (onOpen) {
        const otherParticipant = chat.participants?.find(
          p => p.id !== user?.id
        );
        const userName =
          otherParticipant?.display_name ||
          otherParticipant?.username ||
          'ユーザー';
        onOpen(chat.id, userName);
      }
    },
    [onOpen, user?.id, lastViewedTimes]
  );

  // Handle error retry
  const handleRetry = useCallback(() => {
    clearError();
    retry();
  }, [clearError, retry]);

  // Show error alert
  useEffect(() => {
    if (error) {
      Alert.alert('エラー', error, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '再試行', onPress: handleRetry },
      ]);
    }
  }, [error, handleRetry]);

  // 最終メッセージのプレビュー表示
  const getLastMessagePreview = useCallback((chat: ChatWithParticipants) => {
    if (!chat.last_message) {
      return 'まだメッセージがありません';
    }
    const message = chat.last_message;
    if (message.deleted_at) {
      return 'メッセージが削除されました';
    }
    return message.content.length > 30
      ? message.content.substring(0, 30) + '...'
      : message.content;
  }, []);

  // 簡易チャットアイテム
  const renderChatItem = ({ item }: { item: ChatWithParticipants }) => {
    try {
      const otherParticipant = item.participants?.find(p => p.id !== user?.id);
      const displayName =
        otherParticipant?.display_name ||
        otherParticipant?.username ||
        'ユーザー';
      const isNew = hasNewMessage(item);
      const lastMessage = getLastMessagePreview(item);

      return (
        <Pressable
          onPress={() => handleChatPress(item)}
          style={({ pressed }) => ({
            padding: 16,
            backgroundColor: pressed
              ? colors.surface
              : isNew
                ? '#ffffff05'
                : 'transparent',
            borderBottomWidth: 1,
            borderBottomColor: isNew ? colors.pink + '20' : '#ffffff10',
            borderLeftWidth: isNew ? 3 : 0,
            borderLeftColor: isNew ? colors.pink : 'transparent',
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* アバター */}
            {otherParticipant?.id && avatarMap[otherParticipant.id] ? (
              <Image
                source={{ uri: avatarMap[otherParticipant.id]! }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  marginRight: 12,
                  borderWidth: isNew ? 2 : 0,
                  borderColor: isNew ? colors.pink + '40' : 'transparent',
                }}
              />
            ) : (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isNew ? colors.pink + '20' : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                  borderWidth: isNew ? 2 : 0,
                  borderColor: isNew ? colors.pink + '40' : 'transparent',
                }}
              >
                <Text style={{ fontSize: isNew ? 18 : 16 }}>
                  {otherParticipant?.avatar_emoji || '👤'}
                </Text>
              </View>
            )}

            {/* メイン情報エリア */}
            <View style={{ flex: 1 }}>
              {/* ユーザー名とNEWタグ */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    color: isNew ? colors.text : colors.text,
                    fontSize: 16,
                    fontWeight: isNew ? '700' : '600',
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                {otherParticipant?.id && badgeMap[otherParticipant.id] && (
                  <VerifiedBadge size={16} />
                )}

                {/* NEWタグ */}
                {isNew && (
                  <View
                    style={{
                      backgroundColor: colors.pink,
                      borderRadius: 12,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      marginLeft: 8,
                      shadowColor: colors.pink,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: '#23181D',
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                      }}
                    >
                      NEW
                    </Text>
                  </View>
                )}
              </View>

              {/* メッセージプレビュー */}
              <Text
                style={{
                  color: isNew ? colors.text + 'CC' : colors.subtext,
                  fontSize: 13,
                  fontWeight: isNew ? '500' : 'normal',
                  lineHeight: 18,
                }}
                numberOfLines={1}
              >
                {lastMessage}
              </Text>
            </View>

            {/* 未読数バッジ（NEWタグと同じ条件で表示） */}
            {isNew && (
              <View
                style={{
                  backgroundColor: colors.pink + '40',
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  minWidth: 20,
                  alignItems: 'center',
                  marginLeft: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.pink,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  •
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      );
    } catch (error) {
      // Error rendering chat item
      // フォールバック表示
      return (
        <View style={{ padding: 16, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text }}>
            エラー: チャットアイテムの表示に失敗
          </Text>
        </View>
      );
    }
  };

  // 簡易空状態表示
  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 100,
          }}
        >
          <ActivityIndicator size="large" color={colors.pink} />
          <Text style={{ color: colors.subtext, marginTop: 16 }}>
            チャットを読み込んでいます...
          </Text>
        </View>
      );
    }

    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 100,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 8,
          }}
        >
          メッセージがありません
        </Text>
        <Text
          style={{
            color: colors.subtext,
            textAlign: 'center',
            paddingHorizontal: 32,
          }}
        >
          新しいメッセージを初めてみましょう
        </Text>
      </View>
    );
  }, [isLoading, colors, chats.length, error]);

  // クライアント側でブロック相手を除外
  const displayedChats = chats.filter(c => {
    const other = c.participants?.find(p => p.id !== user?.id);
    return other?.id ? !blocked.includes(other.id) : true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 48 }}>
      {/* シンプルヘッダー */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#ffffff10',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: '700',
            }}
          >
            メッセージ ({chats.length})
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="フォロワー一覧へ"
            onPress={() => onOpenFollowers && onOpenFollowers()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: colors.pink,
              transform: [{ translateY: -2 }],
            }}
          >
            <Text style={{ color: '#23181D', fontWeight: '800', fontSize: 16 }}>
              ↑
            </Text>
          </Pressable>
        </View>
        {error && (
          <Text style={{ color: '#ff4444', fontSize: 14, marginTop: 4 }}>
            エラー: {error}
          </Text>
        )}
      </View>

      <FlatList
        data={displayedChats}
        keyExtractor={item => item.id}
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={renderChatItem}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        extraData={[lastViewedTimes.size, chats.length, renderKey]} // 確認時刻数、チャット数、フォーカス状態が変更された時に再レンダリング
        onLayout={() => {
          // FlatList layout complete
        }}
      />

      {/* AI Chatbot FAB */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="AIチャットボットを開く"
        onPress={() => onOpenAIChat && onOpenAIChat()}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 88, // keep above bottom tab bar
          backgroundColor: colors.pink,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Ionicons name="heart-outline" size={26} color="#23181D" />
      </Pressable>
    </View>
  );
}
