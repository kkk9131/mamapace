import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
  Animated,
  Image,
  Keyboard,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadChatImages } from '../services/storageService';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { useChat } from '../hooks/useChat';
import { MessageType, OptimisticMessage } from '../types/chat';
import { chatService } from '../services/chatService';
import { getSupabaseClient } from '../services/supabaseClient';

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

export default function ChatScreen({
  chatId: propChatId,
  userName,
  onBack,
  route,
}: ChatScreenProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { handPreference } = useHandPreference();
  const [inputMessage, setInputMessage] = useState('');
  const [images, setImages] = useState<{ uri: string }[]>([]);
  const [viewer, setViewer] = useState<{ visible: boolean; index: number; urls: string[] }>({ visible: false, index: 0, urls: [] });
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
    isLoadingMessages,
  } = useChat(chatId || '');

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if ((!inputMessage.trim() && images.length === 0) || isSending) {
      return;
    }

    const messageToSend = inputMessage.trim();
    setInputMessage('');

    try {
      // Upload selected images (if any) and bundle as attachments
      let attachments: { url: string; width?: number; height?: number; mime?: string }[] = [];
      if (images.length > 0) {
        const client = getSupabaseClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error('ログインが必要です');
        attachments = await uploadChatImages(user.id, images.map(i => i.uri));
        setImages([]);
      }

      const type = (!messageToSend && attachments.length > 0) ? MessageType.IMAGE : MessageType.TEXT;
      const metadata = attachments.length > 0 ? { attachments } : undefined;
      await sendMessage(messageToSend, type, undefined, metadata);
      Keyboard.dismiss();
    } catch (error) {
      // Error is handled by the error state
      setInputMessage(messageToSend); // Restore message on error
    }
  }, [inputMessage, images, isSending, sendMessage]);

  // Auto-scroll to bottom on new messages (LINE style)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle input change with typing indicators
  const handleInputChange = useCallback(
    (text: string) => {
      setInputMessage(text);

      // Update typing status
      if (text.trim()) {
        updateTypingStatus(true);
      } else {
        updateTypingStatus(false);
      }
    },
    [updateTypingStatus]
  );

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
      Alert.alert('エラー', error, [
        { text: 'キャンセル', style: 'cancel', onPress: clearError },
        {
          text: '再試行',
          onPress: () => {
            clearError();
            retry();
          },
        },
      ]);
    }
  }, [error, clearError, retry]);

  // Handle invitation response
  const handleInvitationResponse = useCallback(async (messageId: string, response: 'accept' | 'decline', spaceId: string, spaceName: string, invitationId?: string) => {
    try {
      console.log('🔍 Debug: Handling invitation response', {
        messageId,
        response,
        spaceId,
        spaceName,
        invitationId,
      });

      // Try to manually add user to space/channel since database functions may not exist
      if (response === 'accept' && spaceId) {
        try {
          const client = getSupabaseClient();
          
          // Get current user
          const { data: { user }, error: authError } = await client.auth.getUser();
          if (authError || !user) {
            throw new Error('認証エラー');
          }

          console.log('🔍 Debug: Current user', { userId: user.id });

          // First, try using existing join_public_space RPC function
          console.log('🔍 Debug: Attempting to join space via RPC', { spaceId });
          const { data: rpcResult, error: rpcError } = await client
            .rpc('join_public_space', { p_space_id: spaceId });
          
          console.log('🔍 Debug: RPC join result', { data: rpcResult, error: rpcError });
          
          if (rpcResult && rpcResult.success) {
            // Send confirmation message
            const responseText = `ルーム「${spaceName}」への招待を受け入れました！`;
            await sendMessage(responseText, MessageType.TEXT);
            
            Alert.alert('参加完了', `ルーム「${spaceName}」に参加しました！チャット一覧を更新してください。`);
            return;
          } else {
            console.log('🔍 Debug: RPC failed, trying direct database access as fallback', { error: rpcResult?.error || rpcError });
          }

          // Fallback: Direct database access - try to get the channel for this space
          const { data: channels, error: channelError } = await client
            .from('channels')
            .select('id')
            .eq('space_id', spaceId)
            .limit(1);

          console.log('🔍 Debug: Channel query result', { channels, error: channelError });

          if (channels && channels.length > 0) {
            const channelId = channels[0].id;
            
            // Add user to channel_members
            const { error: memberError } = await client
              .from('channel_members')
              .upsert({
                channel_id: channelId,
                user_id: user.id,
                role: 'member',
                joined_at: new Date().toISOString(),
                is_active: true,
              }, {
                onConflict: 'channel_id,user_id'
              });

            console.log('🔍 Debug: Add member result', { error: memberError });

            if (!memberError) {
              // Member count will be automatically updated by database trigger
              console.log('🔍 Debug: Member successfully added, trigger will update count automatically');

              // Send confirmation message
              const responseText = `ルーム「${spaceName}」への招待を受け入れました！`;
              await sendMessage(responseText, MessageType.TEXT);
              
              Alert.alert('参加完了', `ルーム「${spaceName}」に参加しました！チャット一覧を更新してください。`);
              return;
            }
          }
        } catch (dbError) {
          console.error('Failed to add user to space:', dbError);
        }
      }
      
      // Fallback: Just send a response message
      const responseText = response === 'accept' 
        ? `ルーム「${spaceName}」への招待を受け入れました！` 
        : `ルーム「${spaceName}」への招待を辞退しました。`;
      
      await sendMessage(responseText, MessageType.TEXT);
      
      if (response === 'accept') {
        Alert.alert('参加意思表示完了', `ルーム「${spaceName}」への参加意思を表明しました。管理者による承認をお待ちください。`);
      } else {
        Alert.alert('辞退完了', `ルーム「${spaceName}」への招待を辞退しました。`);
      }
    } catch (error) {
      console.error('Invitation response error:', error);
      Alert.alert('エラー', '応答の送信に失敗しました');
    }
  }, [sendMessage]);

  // メッセージをレンダリングする関数
  const renderMessage = useCallback(
    ({ item }: { item: OptimisticMessage }) => {
      const isMe = item.sender_id === user?.id;
      const isOptimistic = item.isOptimistic;
      const hasError = item.error;
      const isDeleted = item.deleted_at;
      const senderName = item.sender?.display_name || item.sender?.username || '匿名';
      
      // Check if this is an invitation message (check metadata for both text and system types)
      const isInvitation = (item.message_type === MessageType.SYSTEM || item.message_type === MessageType.TEXT) && 
                          item.metadata?.type === 'room_invitation' &&
                          item.metadata?.status === 'pending';

      return (
        <Pressable
          onLongPress={() => {
            if (isMe && !isDeleted && !isOptimistic) {
              // Unified simple delete dialog (same style as room)
              Alert.alert('メッセージ削除', 'このメッセージを削除しますか？', [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: '削除',
                  style: 'destructive',
                  onPress: () => deleteMessage(item.id),
                },
              ]);
            }
          }}
          style={{
            alignItems: isMe ? 'flex-end' : 'flex-start',
            marginBottom: 10,
            opacity: isOptimistic ? 0.7 : isDeleted ? 0.5 : 1,
          }}
        >
          <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
            <View
              style={{
                backgroundColor: isInvitation ? '#F6C6D020' : isMe ? colors.pink : '#ffffff10',
                padding: isInvitation ? 16 : 10,
                borderRadius: 14,
                borderWidth: hasError ? 1 : isInvitation ? 1 : 0,
                borderColor: hasError ? '#ff4444' : isInvitation ? colors.pink + '40' : 'transparent',
                maxWidth: isInvitation ? '90%' : '80%',
              }}
            >
              {/* アイコン + ユーザー名（左にアイコン、右にユーザー名） */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                {item.sender?.avatar_url ? (
                  <Image
                    source={{ uri: item.sender.avatar_url }}
                    style={{ width: 20, height: 20, borderRadius: 10, marginRight: 6 }}
                  />
                ) : (
                  <Text style={{ fontSize: 14, marginRight: 6 }}>
                    {item.sender?.avatar_emoji || '👤'}
                  </Text>
                )}
                <Text style={{ color: isMe ? '#23181D' : colors.subtext, fontSize: 11 }}>
                  {senderName}
                </Text>
              </View>
              {/* Attachments (images) */}
              {Array.isArray(item.metadata?.attachments) && item.metadata!.attachments!.length > 0 && (
                <View style={{ marginBottom: 8, gap: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
                  {item.metadata!.attachments!.map((att: any, idx: number) => (
                    <Pressable
                      key={idx}
                      onPress={() => setViewer({ visible: true, index: idx, urls: item.metadata!.attachments!.map((a: any) => a.url || a) })}
                      style={{ width: 220, height: 220, borderRadius: 8, overflow: 'hidden', backgroundColor: '#00000020', marginRight: 6 }}
                    >
                      <Image source={{ uri: att.url || att }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Text content or legacy image-only content */}
              {(() => {
                if (!isDeleted && item.message_type === MessageType.IMAGE && (!item.content || item.content.startsWith('http'))) {
                  // Legacy single-image message: show image if no attachments
                  if (!item.metadata?.attachments || item.metadata.attachments.length === 0) {
                    return (
                      <Pressable onPress={() => setViewer({ visible: true, index: 0, urls: [item.content] })}>
                        <Image source={{ uri: item.content }} style={{ width: 220, height: 220, borderRadius: 8, resizeMode: 'cover' }} />
                      </Pressable>
                    );
                }
                }
                // Otherwise show text if exists
                if (item.content && item.content.length) {
                  return (
                    <Text
                      style={{
                        color: isMe ? '#23181D' : colors.text,
                        fontStyle: isDeleted ? 'italic' : 'normal',
                        fontSize: isInvitation ? 14 : undefined,
                      }}
                    >
                      {isDeleted ? 'このメッセージは削除されました' : item.content}
                    </Text>
                  );
                }
                return null;
              })()}
            
            {/* Invitation response buttons */}
            {isInvitation && !isMe && !isDeleted && (
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                <Pressable
                  onPress={() => handleInvitationResponse(
                    item.id, 
                    'accept', 
                    item.metadata?.space_id, 
                    item.metadata?.space_name,
                    item.metadata?.invitation_id
                  )}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.pink,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 16,
                      flex: 1,
                      alignItems: 'center',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
                    ✅ 参加する
                  </Text>
                </Pressable>
                
                <Pressable
                  onPress={() => handleInvitationResponse(
                    item.id, 
                    'decline', 
                    item.metadata?.space_id, 
                    item.metadata?.space_name,
                    item.metadata?.invitation_id
                  )}
                  style={({ pressed }) => [
                    {
                      backgroundColor: '#ffffff20',
                      borderWidth: 1,
                      borderColor: colors.subtext + '40',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 16,
                      flex: 1,
                      alignItems: 'center',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                    ❌ 辞退する
                  </Text>
                </Pressable>
              </View>
            )}
            
            {item.is_edited && !isDeleted && (
              <Text
                style={{ color: colors.subtext, fontSize: 10, marginTop: 2 }}
              >
                編集済み
              </Text>
            )}
            {hasError && (
              <Text style={{ color: '#ff4444', fontSize: 10, marginTop: 2 }}>
                送信に失敗しました
              </Text>
            )}
            </View>
          </View>
        </Pressable>
      );
    },
    [
      user?.id,
      colors.pink,
      colors.text,
      colors.subtext,
      editMessage,
      deleteMessage,
      handleInvitationResponse,
    ]
  );

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
      <View
        style={{
          alignItems: 'flex-start',
          marginBottom: 10,
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            backgroundColor: '#ffffff10',
            padding: 12,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.subtext, fontSize: 12, marginRight: 4 }}>
            入力中
          </Text>
          <View style={{ flexDirection: handPreference === 'left' ? 'row' : 'row-reverse', alignItems: 'center' }}>
            <Animated.View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.subtext,
                marginHorizontal: 1,
                opacity: dot1,
              }}
            />
            <Animated.View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.subtext,
                marginHorizontal: 1,
                opacity: dot2,
              }}
            />
            <Animated.View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.subtext,
                marginHorizontal: 1,
                opacity: dot3,
              }}
            />
          </View>
        </View>
      </View>
    );
  }, [typingUsers, colors.subtext]);

  if (!chatId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 100,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16 }}>
          チャットが選択されていません
        </Text>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 8,
              backgroundColor: colors.surface,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>
              ←
            </Text>
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#ffffff10',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {onBack && (
              <Pressable
                onPress={onBack}
                style={({ pressed }) => ({
                  marginRight: 12,
                  padding: 6,
                  borderRadius: 6,
                  backgroundColor: pressed ? colors.surface : 'transparent',
                })}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {handPreference === 'left' ? '←' : '→'}
                </Text>
              </Pressable>
            )}
            <Text
              style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}
            >
              {userName || 'チャット'}
            </Text>
          </View>
        </View>
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: colors.subtext }}>
            データベースから読み込み中...
          </Text>
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
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
        }}
      >
        {/* ヘッダー部分 */}
        <View
          style={{
            paddingTop: 60,
            paddingHorizontal: 16,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#ffffff10',
          }}
        >
          <View style={{ flexDirection: handPreference === 'left' ? 'row' : 'row-reverse', alignItems: 'center' }}>
            {onBack && (
              <Pressable
                onPress={onBack}
                style={{
                  marginRight: 12,
                  padding: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {handPreference === 'left' ? '←' : '→'}
                </Text>
              </Pressable>
            )}
            <Text
              style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}
            >
              {userName || 'チャット'}
            </Text>
          </View>
        </View>

        {/* メッセージリスト */}
        <FlatList
          ref={flatListRef}
          data={[
            ...messages.filter((m: any) => !m.deleted_at),
            ...(typingUsers.length > 0
              ? [{ id: 'typing', isTyping: true }]
              : []),
          ]}
          keyExtractor={item => item.id || 'typing'}
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
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: 12,
            backgroundColor: colors.card + 'EE',
            borderTopColor: '#22252B',
            borderTopWidth: 1,
          }}
        >
          <View
            style={{
              backgroundColor: '#ffffff10',
              borderRadius: 14,
              paddingHorizontal: 12,
              flexDirection: handPreference === 'left' ? 'row-reverse' : 'row',
              alignItems: 'center',
            }}
          >
            {/* 添付ボタン群 */}
            <Pressable
              disabled={images.length >= 4}
              onPress={async () => {
                try {
                  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!perm.granted) { Alert.alert('権限', '写真ライブラリへのアクセスが必要です'); return; }
                  const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ImagePicker.MediaTypeOptions.Images, selectionLimit: 4, quality: 1 });
                  if (res.canceled) return;
                  const picked = res.assets?.map(a => ({ uri: a.uri })) || [];
                  setImages(prev => [...prev, ...picked].slice(0, 4));
                } catch {}
              }}
              style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: pressed ? '#ffffff20' : '#ffffff14' })}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>🖼️</Text>
            </Pressable>
            <Pressable
              disabled={images.length >= 4}
              onPress={async () => {
                try {
                  const perm = await ImagePicker.requestCameraPermissionsAsync();
                  if (!perm.granted) { Alert.alert('権限', 'カメラへのアクセスが必要です'); return; }
                  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
                  if (res.canceled) return;
                  const picked = res.assets?.map(a => ({ uri: a.uri })) || [];
                  setImages(prev => [...prev, ...picked].slice(0, 4));
                } catch {}
              }}
              style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: pressed ? '#ffffff20' : '#ffffff14' })}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>📷</Text>
            </Pressable>
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
              disabled={(!inputMessage.trim() && images.length === 0) || isSending}
              style={({ pressed }) => ({
                ...(handPreference === 'left' ? { marginRight: 8 } : { marginLeft: 8 }),
                padding: 8,
                borderRadius: 20,
                backgroundColor:
                  (inputMessage.trim() || images.length > 0) && !isSending
                    ? colors.pink
                    : colors.surface,
                opacity: pressed ? 0.7 : 1,

              })}
            >
              <Text
                style={{
                  color:
                    (inputMessage.trim() || images.length > 0) && !isSending
                      ? '#23181D'
                      : colors.subtext,
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                {isSending ? '...' : '送信'}
              </Text>
            </Pressable>
          </View>
        </View>
        {images.length > 0 && (
          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {images.map((img, idx) => (
              <Pressable key={idx} onPress={() => setImages(prev => prev.filter((_, i) => i !== idx))} style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: '#ffffff12' }}>
                <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {/* Simple image viewer modal */}
      <Modal
        visible={viewer.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer({ visible: false, index: 0, urls: [] })}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: '#000000CC', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setViewer({ visible: false, index: 0, urls: [] })}
        >
          {viewer.urls[viewer.index] ? (
            <Image source={{ uri: viewer.urls[viewer.index] }} style={{ width: '90%', height: '70%', resizeMode: 'contain' }} />
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
