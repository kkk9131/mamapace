import { View, Text, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, Alert, RefreshControl, Animated } from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { MessageType, OptimisticMessage } from '../types/chat';

interface ChatScreenProps {
  chatId?: string;
  userName?: string;
  onBack?: () => void;
  route?: {
    params?: {
      chatId?: string;
    };
  };
}

export default function ChatScreen({ chatId: propChatId, userName, onBack, route }: ChatScreenProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [inputMessage, setInputMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);
  
  // Get chatId from props or route params
  const chatId = propChatId || route?.params?.chatId;
  
  // Use chat hook with actual chatId
  const {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    updateTypingStatus,
    clearError,
    retry,
    loadMoreMessages,
    canLoadMore,
    typingUsers,
    isLoadingMessages
  } = useChat(chatId || '');
  
  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isSending) {
      return;
    }
    
    const messageToSend = inputMessage.trim();
    setInputMessage('');
    
    try {
      await sendMessage(messageToSend, MessageType.TEXT);
    } catch (error) {
      // Error is handled by the error state
      setInputMessage(messageToSend); // Restore message on error
    }
  }, [inputMessage, isSending, sendMessage]);
  
  // Auto-scroll to bottom on new messages (LINE style)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);
  
  // Handle input change with typing indicators
  const handleInputChange = useCallback((text: string) => {
    setInputMessage(text);
    
    // Update typing status
    if (text.trim()) {
      updateTypingStatus(true);
    } else {
      updateTypingStatus(false);
    }
  }, [updateTypingStatus]);
  
  // Clear typing status when unfocused
  const handleInputBlur = useCallback(() => {
    updateTypingStatus(false);
  }, [updateTypingStatus]);
  
  // Handle refresh (load more messages)
  const handleRefresh = useCallback(() => {
    if (canLoadMore) {
      loadMoreMessages();
    }
  }, [canLoadMore, loadMoreMessages]);
  
  // Show error alert
  useEffect(() => {
    if (error) {
      Alert.alert(
        'エラー',
        error,
        [
          { text: 'キャンセル', style: 'cancel', onPress: clearError },
          { text: '再試行', onPress: () => {
            clearError();
            retry();
          }}
        ]
      );
    }
  }, [error, clearError, retry]);
  
  // メッセージをレンダリングする関数
  const renderMessage = useCallback(({ item }: { item: OptimisticMessage }) => {
    const isMe = item.sender_id === user?.id;
    const isOptimistic = item.isOptimistic;
    const hasError = item.error;
    const isDeleted = item.deleted_at;
    
    return (
      <Pressable
        onLongPress={() => {
          if (isMe && !isDeleted && !isOptimistic) {
            Alert.alert(
              'メッセージオプション',
              '',
              [
                {
                  text: '編集',
                  onPress: () => {
                    Alert.prompt(
                      'メッセージを編集',
                      '',
                      [
                        { text: 'キャンセル', style: 'cancel' },
                        { 
                          text: '更新', 
                          onPress: (newText) => {
                            if (newText && newText.trim()) {
                              editMessage(item.id, newText.trim());
                            }
                          }
                        }
                      ],
                      'plain-text',
                      item.content
                    );
                  }
                },
                {
                  text: '削除',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      '確認',
                      'このメッセージを削除しますか？',
                      [
                        { text: 'キャンセル', style: 'cancel' },
                        { 
                          text: '削除', 
                          style: 'destructive',
                          onPress: () => deleteMessage(item.id)
                        }
                      ]
                    );
                  }
                },
                { text: 'キャンセル', style: 'cancel' }
              ]
            );
          }
        }}
        style={{ 
          alignItems: isMe ? 'flex-end' : 'flex-start', 
          marginBottom: 10,
          opacity: isOptimistic ? 0.7 : (isDeleted ? 0.5 : 1)
        }}
      >
        <View style={{ 
          backgroundColor: isMe ? colors.pink : '#ffffff10', 
          padding: 10, 
          borderRadius: 14,
          borderWidth: hasError ? 1 : 0,
          borderColor: hasError ? '#ff4444' : 'transparent',
          maxWidth: '80%'
        }}>
          <Text style={{ 
            color: isMe ? '#23181D' : colors.text,
            fontStyle: isDeleted ? 'italic' : 'normal'
          }}>
            {isDeleted ? 'このメッセージは削除されました' : item.content}
          </Text>
          {item.is_edited && !isDeleted && (
            <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 2 }}>
              編集済み
            </Text>
          )}
          {hasError && (
            <Text style={{ color: '#ff4444', fontSize: 10, marginTop: 2 }}>
              送信に失敗しました
            </Text>
          )}
        </View>
      </Pressable>
    );
  }, [user?.id, colors.pink, colors.text, colors.subtext, editMessage, deleteMessage]);
  
  // Render typing indicator with animation
  const renderTypingIndicator = useCallback(() => {
    if (typingUsers.length === 0) return null;
    
    const [dot1] = useState(new Animated.Value(0));
    const [dot2] = useState(new Animated.Value(0));
    const [dot3] = useState(new Animated.Value(0));
    
    useEffect(() => {
      const animateDots = () => {
        const createAnimation = (dot: Animated.Value, delay: number) => 
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]);
        
        Animated.loop(
          Animated.parallel([
            createAnimation(dot1, 0),
            createAnimation(dot2, 150),
            createAnimation(dot3, 300),
          ])
        ).start();
      };
      
      animateDots();
    }, []);
    
    return (
      <View style={{ alignItems: 'flex-start', marginBottom: 10, paddingHorizontal: 16 }}>
        <View style={{ 
          backgroundColor: '#ffffff10', 
          padding: 12, 
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center'
        }}>
          <Text style={{ color: colors.subtext, fontSize: 12, marginRight: 4 }}>
            入力中
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.subtext,
              marginHorizontal: 1,
              opacity: dot1,
            }} />
            <Animated.View style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.subtext,
              marginHorizontal: 1,
              opacity: dot2,
            }} />
            <Animated.View style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.subtext,
              marginHorizontal: 1,
              opacity: dot3,
            }} />
          </View>
        </View>
      </View>
    );
  }, [typingUsers, colors.subtext]);
  
  if (!chatId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>チャットが選択されていません</Text>
        {onBack && (
          <Pressable 
            onPress={onBack}
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 8,
              backgroundColor: colors.surface
            }}
          >
            <Text style={{ color: colors.text }}>戻る</Text>
          </Pressable>
        )}
      </View>
    );
  }
  
  // Show loading state while chat is being loaded
  if (isLoading && messages.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60 }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingHorizontal: 16, 
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#ffffff10'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {onBack && (
              <Pressable 
                onPress={onBack}
                style={({ pressed }) => ({
                  marginRight: 12,
                  padding: 6,
                  borderRadius: 6,
                  backgroundColor: pressed ? colors.surface : 'transparent'
                })}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>←</Text>
              </Pressable>
            )}
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              {userName || 'チャット'}
            </Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.subtext }}>データベースから読み込み中...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={{ 
        flex: 1, 
        backgroundColor: colors.bg
      }}>
        {/* ヘッダー部分 */}
        <View style={{ 
          paddingTop: 60, 
          paddingHorizontal: 16, 
          paddingBottom: 16, 
          borderBottomWidth: 1, 
          borderBottomColor: '#ffffff10' 
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {onBack && (
              <Pressable 
                onPress={onBack}
                style={{ 
                  marginRight: 12, 
                  padding: 8, 
                  backgroundColor: colors.surface, 
                  borderRadius: 8 
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>←</Text>
              </Pressable>
            )}
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              {userName || 'チャット'}
            </Text>
          </View>
        </View>
        
        {/* メッセージリスト */}
        <FlatList
          ref={flatListRef}
          data={[...messages, ...(typingUsers.length > 0 ? [{ id: 'typing', isTyping: true }] : [])]}
          keyExtractor={(item) => item.id || 'typing'}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => 
            item.isTyping ? renderTypingIndicator() : renderMessage({ item })
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoadingMessages}
              onRefresh={handleRefresh}
              tintColor={colors.pink}
              colors={[colors.pink]}
            />
          }
          onContentSizeChange={() => {
            // Scroll to bottom when new messages are added
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
          onLayout={() => {
            // Scroll to bottom on initial layout
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }, 100);
          }}
        />
        
        {/* 入力欄 */}
        <View style={{ 
          position: 'absolute', 
          left: 0, 
          right: 0, 
          bottom: 0, 
          padding: 12, 
          backgroundColor: colors.card + 'EE', 
          borderTopColor: '#22252B', 
          borderTopWidth: 1 
        }}>
          <View style={{ 
            backgroundColor: '#ffffff10', 
            borderRadius: 14, 
            paddingHorizontal: 12, 
            flexDirection: 'row', 
            alignItems: 'center' 
          }}>
            <TextInput 
              placeholder="メッセージを入力" 
              placeholderTextColor={colors.subtext} 
              style={{ color: colors.text, height: 44, flex: 1 }}
              value={inputMessage}
              onChangeText={handleInputChange}
              onBlur={handleInputBlur}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
              multiline
              maxLength={1000}
              editable={!isSending}
            />
            <Pressable
              onPress={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              style={({ pressed }) => ({
                marginLeft: 8,
                padding: 8,
                borderRadius: 20,
                backgroundColor: inputMessage.trim() && !isSending ? colors.pink : colors.surface,
                opacity: pressed ? 0.7 : 1
              })}
            >
              <Text style={{ 
                color: inputMessage.trim() && !isSending ? '#23181D' : colors.subtext, 
                fontSize: 16, 
                fontWeight: '600' 
              }}>
                {isSending ? '...' : '送信'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}