import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { sendAIChat } from '../services/aiChatService';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  listAISessions,
  fetchAIMessages,
  createAISession,
  deleteAISession,
  AIChatSession,
  updateAISessionTitle,
  getAISession,
} from '../services/aiChatSessionService';

interface AIChatBotScreenProps {
  onBack?: () => void;
  onOpenPaywall?: () => void;
}

interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChatBotScreen({ onBack, onOpenPaywall }: AIChatBotScreenProps) {
  const theme = useTheme();
  const { colors, spacing, radius, shadow } = theme;
  const insets = useSafeAreaInsets();
  const { canUseUnlimitedAIChat } = useSubscription();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<AIChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState<string>('');
  const [freeLimitReached, setFreeLimitReached] = useState(false);

  const showFreeLimitAlert = useCallback(() => {
    Alert.alert(
      'AIチャットの上限',
      '今日はこれ以上AIチャットを送信できません。プレミアム会員になると無制限でご利用いただけます。',
      [
        { text: 'あとで', style: 'cancel' },
        {
          text: 'プレミアムを見る',
          onPress: () => onOpenPaywall && onOpenPaywall(),
        },
      ]
    );
  }, [onOpenPaywall]);

  const send = async () => {
    if (!input.trim() || loading) {
      return;
    }
    // プレミアム会員は制限なし
    if (freeLimitReached && !canUseUnlimitedAIChat) {
      showFreeLimitAlert();
      return;
    }
    const userMsg: ChatItem = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };
    setMessages(prev => {
      const next = [...prev, userMsg];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
    setInput('');
    setLoading(true);
    try {
      const convo = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));
      const res = await sendAIChat(convo, sessionId);
      const content =
        res.ok && res.text
          ? res.text
          : '出力に失敗しました。時間をおいて再試行してください。';
      if (!res.ok) {
        if (res.error === 'free_daily_limit' && !canUseUnlimitedAIChat) {
          setFreeLimitReached(true);
          setMessages(prev => prev.filter(m => m.id !== userMsg.id));
          showFreeLimitAlert();
          return;
        }
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        Alert.alert('エラー', res.error || 'AI応答の生成に失敗しました');
        return;
      }
      const aiMsg: ChatItem = {
        id: `a_${Date.now() + 1}`,
        role: 'assistant',
        content,
      };
      setMessages(prev => {
        const next = [...prev, aiMsg];
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
      if (res.session_id && res.session_id !== sessionId) {
        setSessionId(res.session_id);
        try {
          const meta = await getAISession(res.session_id);
          setCurrentTitle(meta?.title || '');
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  const openSessions = useCallback(async () => {
    setSessionsOpen(true);
    setSessionsLoading(true);
    try {
      const list = await listAISessions();
      setSessions(list);
    } catch {
      Alert.alert('エラー', 'セッション一覧の取得に失敗しました');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const handleSelectSession = useCallback(
    async (id: string) => {
      try {
        setSessionsOpen(false);
        setSessionId(id);
        const found = sessions.find(s => s.id === id);
        setCurrentTitle(found?.title || '');
        setEditingTitle(false);
        const rows = await fetchAIMessages(id);
        const mapped: ChatItem[] = rows.map(r => ({
          id: r.id,
          role: r.role,
          content: r.content,
        }));
        setMessages(mapped);
      } catch {
        Alert.alert('エラー', '履歴の読み込みに失敗しました');
      }
    },
    [sessions]
  );

  const handleNewSession = useCallback(async () => {
    try {
      const lastLine = messages.length
        ? messages[messages.length - 1].content
        : '';
      const title = lastLine ? lastLine.slice(0, 60) : '新しいチャット';
      const sess = await createAISession(title);
      setSessionId(sess.id);
      setCurrentTitle(sess.title || '');
      setEditingTitle(false);
      setMessages([]);
      setSessionsOpen(false);
    } catch {
      Alert.alert('エラー', '新規セッションの作成に失敗しました');
    }
  }, [messages]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      Alert.alert('削除確認', 'このセッションを削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAISession(id);
              if (id === sessionId) {
                setSessionId(undefined);
                setMessages([]);
              }
              // refresh list if modal open
              if (sessionsOpen) {
                const list = await listAISessions();
                setSessions(list);
              }
            } catch {
              Alert.alert('エラー', 'セッションの削除に失敗しました');
            }
          },
        },
      ]);
    },
    [sessionId, sessionsOpen]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: 48,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#ffffff10',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>←</Text>
        </Pressable>
        <Text
          style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}
          accessibilityRole="header"
        >
          AIチャット{sessionId ? '（履歴）' : ''}
        </Text>
        <Pressable
          onPress={openSessions}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: colors.pink,
          }}
        >
          <Text style={{ color: '#23181D', fontWeight: '700' }}>履歴</Text>
        </Pressable>
      </View>

      {sessionId && !editingTitle && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#ffffff10',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: colors.subtext, fontSize: 12, marginRight: 8 }}>
            タイトル
          </Text>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{ color: colors.text, fontWeight: '700', flex: 1 }}
              numberOfLines={1}
            >
              {currentTitle || '無題'}
            </Text>
            <Pressable
              onPress={() => {
                setTitleInput(currentTitle || '');
                setEditingTitle(true);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: colors.surface,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                編集
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {sessionId && editingTitle && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#ffffff10',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8 as any,
          }}
        >
          <TextInput
            value={titleInput}
            onChangeText={setTitleInput}
            placeholder="タイトルを入力"
            placeholderTextColor={colors.subtext}
            style={{
              flex: 1,
              color: colors.text,
              backgroundColor: colors.surface,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
            maxLength={60}
          />
          <Pressable
            onPress={async () => {
              try {
                if (!sessionId) {
                  return;
                }
                const updated = await updateAISessionTitle(
                  sessionId,
                  titleInput.trim() || null
                );
                setCurrentTitle(updated.title || '');
                setSessions(prev =>
                  prev.map(s =>
                    s.id === updated.id
                      ? {
                          ...s,
                          title: updated.title || null,
                          updated_at: updated.updated_at,
                        }
                      : s
                  )
                );
                setEditingTitle(false);
              } catch {
                Alert.alert('エラー', 'タイトルの更新に失敗しました');
              }
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.pink,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#23181D', fontWeight: '800' }}>保存</Text>
          </Pressable>
          <Pressable
            onPress={() => setEditingTitle(false)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.surface,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>取消</Text>
          </Pressable>
        </View>
      )}

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={{
          padding: spacing(2),
          // Leave space for bottom tab bar (56), extra gap (12), and input area (~72)
          paddingBottom: spacing(2) + (insets.bottom || 0) + 56 + 12 + 72,
        }}
        renderItem={({ item }) => (
          <View
            style={{
              alignItems: item.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: spacing(1),
            }}
          >
            <View
              style={{
                maxWidth: '80%',
                backgroundColor:
                  item.role === 'user' ? colors.pink : colors.surface,
                paddingHorizontal: spacing(1.25),
                paddingVertical: spacing(1),
                borderRadius: radius.md,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  color: item.role === 'user' ? '#23181D' : colors.text,
                  fontSize: 14,
                }}
              >
                {item.content}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Composer */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          // Place composer above the bottom tab bar
          bottom: (insets.bottom || 0) + 56 + 12,
          padding: spacing(1.25),
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: '#ffffff10',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8 as any,
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="メッセージを入力"
          placeholderTextColor={colors.subtext}
          style={{
            flex: 1,
            color: colors.text,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            paddingHorizontal: spacing(1),
            paddingVertical: spacing(1),
          }}
          editable={!loading}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          onPress={send}
          style={{
            paddingHorizontal: spacing(1.25),
            paddingVertical: spacing(1),
            backgroundColor: loading ? colors.pink + '80' : colors.pink,
            borderRadius: radius.md,
          }}
          disabled={loading}
        >
          <Text style={{ color: '#23181D', fontWeight: '800' }}>
            {loading ? '送信中…' : '送信'}
          </Text>
        </Pressable>
      </View>

      {/* Sessions Modal */}
      <Modal visible={sessionsOpen} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: '#00000080',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              maxHeight: '70%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text
                style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}
              >
                セッション一覧
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 as any }}>
                <Pressable
                  onPress={handleNewSession}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: colors.pink,
                    borderRadius: 8,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: '#23181D', fontWeight: '700' }}>
                    新規
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSessionsOpen(false)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    閉じる
                  </Text>
                </Pressable>
              </View>
            </View>

            {sessionsLoading ? (
              <View style={{ alignItems: 'center', padding: 16 }}>
                <ActivityIndicator color={colors.pink} />
              </View>
            ) : sessions.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 16 }}>
                <Text style={{ color: colors.subtext }}>
                  セッションがありません
                </Text>
              </View>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={s => s.id}
                renderItem={({ item }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: '#ffffff10',
                    }}
                  >
                    <Pressable
                      onPress={() => handleSelectSession(item.id)}
                      style={{ flex: 1, paddingRight: 8 }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: item.id === sessionId ? '800' : '600',
                        }}
                        numberOfLines={1}
                      >
                        {item.title || '無題'}
                      </Text>
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>
                        {new Date(
                          item.updated_at || item.created_at
                        ).toLocaleString()}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteSession(item.id)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: '#ff555530',
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: '#ff6666', fontWeight: '700' }}>
                        削除
                      </Text>
                    </Pressable>
                  </View>
                )}
                style={{ maxHeight: '60%' }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
