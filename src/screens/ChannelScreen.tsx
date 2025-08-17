/**
 * CHANNEL SCREEN
 * 
 * Screen for viewing and interacting with channel messages
 * Implements channel messaging with real-time updates and NEW badge functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  Pressable, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  RefreshControl,
  Animated
} from 'react-native';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';
import { useChannelMessages, useModeration } from '../hooks/useRooms';
import { RoomMessageWithSender, ReportMessageRequest } from '../types/room';

interface ChannelScreenProps {
  channelId: string;
  spaceName: string;
  onBack?: () => void;
}

export default function ChannelScreen({ channelId, spaceName, onBack }: ChannelScreenProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  
  // State
  const [messageText, setMessageText] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Hooks
  const {
    messages,
    loading,
    error,
    hasMore,
    sendMessage,
    loadMore,
    markSeen,
    refresh
  } = useChannelMessages(channelId);
  
  const { 
    loading: reportLoading, 
    error: reportError, 
    reportMessage 
  } = useModeration();

  // Animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Mark channel as seen when screen loads
  useEffect(() => {
    if (channelId) {
      markSeen();
    }
  }, [channelId, markSeen]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    const content = messageText.trim();
    setMessageText('');

    const result = await sendMessage(content);
    if (result) {
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Handle message report
  const handleReportMessage = async (messageId: string, reason: ReportMessageRequest['reason'], description?: string) => {
    const success = await reportMessage({
      message_id: messageId,
      reason,
      description
    });

    if (success) {
      Alert.alert('報告完了', 'メッセージを報告しました');
      setShowReportModal(false);
      setSelectedMessageId(null);
    } else if (reportError) {
      Alert.alert('エラー', reportError);
    }
  };

  // Render message item
  const renderMessage = ({ item, index }: { item: RoomMessageWithSender; index: number }) => {
    const isOwnMessage = item.sender_id === ''; // Will be replaced with actual user ID check
    const showAvatar = index === messages.length - 1 || 
                      (index < messages.length - 1 && messages[index + 1].sender_id !== item.sender_id);

    return (
      <View style={{ 
        paddingHorizontal: theme.spacing(2), 
        paddingVertical: theme.spacing(1),
        flexDirection: 'row',
        alignItems: 'flex-start'
      }}>
        {/* Avatar placeholder */}
        <View style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 18, 
          backgroundColor: colors.subtext + '20',
          marginRight: 12,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showAvatar ? 1 : 0
        }}>
          <Text style={{ fontSize: 16 }}>
            {item.sender_avatar_emoji || '👤'}
          </Text>
        </View>

        {/* Message content */}
        <View style={{ flex: 1 }}>
          {showAvatar && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ 
                color: colors.text, 
                fontSize: 14, 
                fontWeight: 'bold',
                marginRight: 8
              }}>
                {item.sender_display_name || item.sender_username}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>
                {new Date(item.created_at).toLocaleString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          )}

          <Pressable
            onLongPress={() => {
              if (!isOwnMessage) {
                setSelectedMessageId(item.id);
                Alert.alert(
                  'メッセージ操作',
                  'このメッセージを報告しますか？',
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    { 
                      text: '報告', 
                      style: 'destructive',
                      onPress: () => handleReportMessage(item.id, 'inappropriate')
                    }
                  ]
                );
              }
            }}
            style={({ pressed }) => [
              {
                backgroundColor: item.is_masked ? colors.subtext + '20' : 'transparent',
                borderRadius: theme.radius.md,
                padding: item.is_masked ? 8 : 0,
                opacity: pressed ? 0.7 : 1
              }
            ]}
          >
            <Text style={{ 
              color: item.is_masked ? colors.subtext : colors.text, 
              fontSize: 15,
              lineHeight: 20
            }}>
              {item.content}
            </Text>
          </Pressable>

          {item.is_edited && (
            <Text style={{ 
              color: colors.subtext, 
              fontSize: 11, 
              marginTop: 2,
              fontStyle: 'italic'
            }}>
              (編集済み)
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Animated.View style={{ 
      flex: 1, 
      backgroundColor: 'transparent',
      opacity: fadeAnim
    }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={{ 
          paddingTop: 48, 
          paddingBottom: 16, 
          paddingHorizontal: theme.spacing(2),
          borderBottomWidth: 1,
          borderBottomColor: colors.subtext + '20'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {onBack && (
              <Pressable onPress={onBack} style={{ marginRight: 12 }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>←</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ 
                color: colors.text, 
                fontSize: 18, 
                fontWeight: 'bold' 
              }}>
                {spaceName}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 14 }}>
                #general
              </Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
          inverted={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.text}
            />
          }
          onEndReached={() => {
            if (hasMore && !loading) {
              loadMore();
            }
          }}
          onEndReachedThreshold={0.1}
          ListEmptyComponent={() => (
            <View style={{ 
              alignItems: 'center', 
              justifyContent: 'center', 
              paddingVertical: 40 
            }}>
              <Text style={{ color: colors.subtext, fontSize: 16 }}>
                {loading ? 'メッセージを読み込み中...' : 'まだメッセージがありません'}
              </Text>
              {!loading && (
                <Text style={{ 
                  color: colors.subtext, 
                  fontSize: 14, 
                  marginTop: 8,
                  textAlign: 'center'
                }}>
                  最初のメッセージを送信してみましょう
                </Text>
              )}
            </View>
          )}
          ListHeaderComponent={() => (
            hasMore ? (
              <View style={{ alignItems: 'center', padding: 16 }}>
                <Text style={{ color: colors.subtext, fontSize: 14 }}>
                  過去のメッセージを読み込み中...
                </Text>
              </View>
            ) : null
          )}
        />

        {/* Message Input */}
        <View style={{ 
          padding: theme.spacing(2),
          paddingBottom: Platform.OS === 'ios' ? 34 : 16
        }}>
          <View style={{ 
            borderRadius: theme.radius.lg, 
            overflow: 'hidden' 
          }}>
            <BlurView 
              intensity={30} 
              tint="dark" 
              style={{ 
                backgroundColor: '#ffffff10',
                flexDirection: 'row',
                alignItems: 'flex-end',
                paddingHorizontal: 16,
                paddingVertical: 12
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 16,
                  maxHeight: 100,
                  textAlignVertical: 'top'
                }}
                placeholder="メッセージを入力..."
                placeholderTextColor={colors.subtext}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                blurOnSubmit={false}
              />
              
              <Pressable
                onPress={handleSendMessage}
                disabled={!messageText.trim()}
                style={({ pressed }) => [
                  {
                    backgroundColor: messageText.trim() ? colors.pink : colors.subtext + '40',
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    marginLeft: 8,
                    transform: [{ scale: pressed ? 0.95 : 1 }]
                  }
                ]}
              >
                <Text style={{ 
                  color: messageText.trim() ? 'white' : colors.subtext,
                  fontSize: 14,
                  fontWeight: 'bold'
                }}>
                  送信
                </Text>
              </Pressable>
            </BlurView>
          </View>
        </View>

        {/* Error display */}
        {error && (
          <View style={{ 
            position: 'absolute',
            top: 100,
            left: theme.spacing(2),
            right: theme.spacing(2),
            backgroundColor: colors.pink + '20',
            borderRadius: theme.radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.pink
          }}>
            <Text style={{ color: colors.pink, fontSize: 14 }}>
              {error}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}