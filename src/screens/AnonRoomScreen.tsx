/**
 * ANONYMOUS ROOM SCREEN
 *
 * Screen for anonymous room with ephemeral messages and rate limiting
 * Implements the anonymous room requirements from room-feature-requirements-v1.md
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  Animated,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { BlurView } from 'expo-blur';
import { useAnonymousRoom, useModeration } from '../hooks/useRooms';
import { AnonymousMessage } from '../types/room';
import ExpandableText from '../components/ExpandableText';

interface AnonRoomScreenProps {
  onBack?: () => void;
}

export default function AnonRoomScreen({ onBack }: AnonRoomScreenProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { handPreference } = useHandPreference();

  // State
  const [messageText, setMessageText] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sendScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const {
    room,
    messages,
    loading,
    error,
    rateLimitError,
    enterRoom,
    sendMessage,
  } = useAnonymousRoom();

  const { reportMessage } = useModeration();

  // Animation - smart animation handling to prevent blank screen on back navigation
  useEffect(() => {
    // Ensure immediate display for smooth navigation experience
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 50);

    return () => clearTimeout(timer);
  }, [fadeAnim]);

  // Enter room on mount
  useEffect(() => {
    enterRoom();
  }, [enterRoom]);

  // Update time left countdown
  useEffect(() => {
    if (!room) return;

    const updateTimeLeft = () => {
      const now = new Date();
      const expiryTime = new Date(room.expires_at);
      const diffMs = expiryTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft('期限切れ');
        // Room expired, try to get new room
        enterRoom();
        return;
      }

      const minutes = Math.floor(diffMs / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}分${seconds}秒`);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [room, enterRoom]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !room) return;

    const content = messageText.trim();
    setMessageText('');

    const result = await sendMessage(content);
    if (result) {
      // Scroll to bottom after sending
      if (sendScrollTimerRef.current) clearTimeout(sendScrollTimerRef.current);
      sendScrollTimerRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Cleanup pending send scroll timer on unmount
  useEffect(() => {
    return () => {
      if (sendScrollTimerRef.current) clearTimeout(sendScrollTimerRef.current);
    };
  }, []);

  // Handle message report
  const handleReportMessage = async (messageId: string) => {
    const success = await reportMessage({
      message_id: messageId,
      reason: 'inappropriate',
    });

    if (success) {
      Alert.alert('報告完了', 'メッセージを報告しました');
    }
  };

  // Render message item
  const renderMessage = ({ item }: { item: AnonymousMessage }) => (
    <Pressable
      onLongPress={() => {
        Alert.alert('メッセージ操作', 'このメッセージを報告しますか？', [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '報告',
            style: 'destructive',
            onPress: () => handleReportMessage(item.id),
          },
        ]);
      }}
      style={({ pressed }) => [
        {
          transform: [{ scale: pressed ? 0.98 : 1 }],
          marginHorizontal: theme.spacing(2),
          marginVertical: theme.spacing(1),
        },
      ]}
    >
      <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
        <BlurView
          intensity={30}
          tint="dark"
          style={{
            backgroundColor: '#F6C6D020',
            padding: theme.spacing(1.75),
          }}
        >
          {/* 匿名性を保つため、投稿カードの表示名は非表示にする */}

          <ExpandableText
            text={item.content || ''}
            maxLines={3}
            textStyle={{
              color: item.is_masked ? colors.subtext : colors.text,
              fontSize: 16,
            }}
            containerStyle={{ marginBottom: 8 }}
          />

          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {new Date(item.created_at).toLocaleString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>

          {item.report_count > 0 && (
            <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 4 }}>
              報告数: {item.report_count}
            </Text>
          )}
        </BlurView>
      </View>
    </Pressable>
  );

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: colors.bg || '#000000',
        opacity: fadeAnim,
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: 48,
            paddingBottom: 16,
            paddingHorizontal: theme.spacing(2),
            borderBottomWidth: 1,
            borderBottomColor: colors.subtext + '20',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {onBack && (
              <Pressable onPress={onBack}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
            )}

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                }}
              >
                愚痴もたまには、、、
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 14 }}>
                完全匿名・1時間で消えます
              </Text>
            </View>

            <View style={{ width: 50 }} />
          </View>

          {room && (
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              {/* 匿名名表示を削除し、残り時間のみ表示 */}
              <Text
                style={{ color: colors.subtext, fontSize: 12 }}
              >
                ルーム期限: {timeLeft}
              </Text>
            </View>
          )}
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={enterRoom}
              tintColor={colors.text}
            />
          }
          ListEmptyComponent={() => (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 40,
              }}
            >
              <Text
                style={{ color: colors.subtext, fontSize: 16, marginBottom: 8 }}
              >
                {loading
                  ? 'メッセージを読み込み中...'
                  : 'まだメッセージがありません'}
              </Text>
              {!loading && (
                <Text
                  style={{
                    color: colors.subtext,
                    fontSize: 14,
                    textAlign: 'center',
                    paddingHorizontal: 40,
                  }}
                >
                  匿名でメッセージを送信してみましょう{'\n'}
                  すべてのメッセージは1時間後に自動削除されます
                </Text>
              )}
            </View>
          )}
        />

        {/* Message Input */}
        <View
          style={{
            padding: theme.spacing(1.5),
            paddingBottom: Platform.OS === 'ios' ? 100 : 80,
          }}
        >
          {/* Rate limit error */}
          {rateLimitError && (
            <View
              style={{
                backgroundColor: colors.pink + '20',
                borderRadius: theme.radius.md,
                padding: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.pink,
              }}
            >
              <Text style={{ color: colors.pink, fontSize: 14 }}>
                {rateLimitError}
              </Text>
            </View>
          )}

          <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                backgroundColor: '#F6C6D020',
                padding: theme.spacing(1.5),
              }}
            >
              <TextInput
                placeholder="ここでは完全匿名。気持ちを吐き出してね"
                placeholderTextColor={colors.subtext}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={2000}
                style={{
                  maxHeight: 120,
                  color: colors.text,
                  fontSize: 16,
                  textAlignVertical: 'top',
                }}
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                blurOnSubmit={false}
              />

              <View
                style={{
                  flexDirection: handPreference === 'left' ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  {messageText.length}/2000文字
                </Text>

                <Pressable
                  onPress={handleSendMessage}
                  disabled={!messageText.trim() || !room}
                  style={({ pressed }) => [
                    {
                      backgroundColor:
                        messageText.trim() && room
                          ? colors.pink
                          : colors.subtext + '40',
                      borderRadius: theme.radius.md,
                      paddingVertical: 10,
                      paddingHorizontal: theme.spacing(2),
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                      opacity: !messageText.trim() || !room ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        messageText.trim() && room ? 'white' : colors.subtext,
                      fontWeight: 'bold',
                    }}
                  >
                    匿名で投稿
                  </Text>
                </Pressable>
              </View>
            </BlurView>
          </View>
        </View>

        {/* Error display */}
        {error && (
          <View
            style={{
              position: 'absolute',
              top: 120,
              left: theme.spacing(2),
              right: theme.spacing(2),
              backgroundColor: colors.pink + '20',
              borderRadius: theme.radius.md,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.pink,
            }}
          >
            <Text style={{ color: colors.pink, fontSize: 14 }}>{error}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
