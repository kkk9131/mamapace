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
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Modal,
} from 'react-native';
import { useTheme } from '../theme/theme';
import * as ImagePicker from 'expo-image-picker';
import { uploadRoomImages } from '../services/storageService';
import { getSupabaseClient } from '../services/supabaseClient';
import { roomService } from '../services/roomService';
import { useAuth } from '../contexts/AuthContext';
import { chatService } from '../services/chatService';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { BlurView } from 'expo-blur';
import {
  useChannelMessages,
  useModeration,
  useSpaceOperations,
  useChannelMembers,
} from '../hooks/useRooms';
import { RoomMessageWithSender, ReportMessageRequest } from '../types/room';
import ExpandableText from '../components/ExpandableText';

interface ChannelScreenProps {
  channelId: string;
  spaceName: string;
  spaceId?: string; // Optional - if not provided, exit functionality is disabled
  isPrivateSpace?: boolean; // Whether this is a private space (enables invite functionality)
  onBack?: () => void;
  onExit?: () => void; // Called after successful exit
  onInvite?: () => void; // Called when invite button is pressed
  onMembers?: () => void; // Called when members button is pressed
  onNavigateToChat?: (chatId: string, userName: string) => void; // Navigate to direct chat
}

export default function ChannelScreen({
  channelId,
  spaceName,
  spaceId,
  isPrivateSpace,
  onBack,
  onExit,
  onInvite,
  onMembers,
  onNavigateToChat,
}: ChannelScreenProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { user } = useAuth();
  const { handPreference } = useHandPreference();

  // State
  const [messageText, setMessageText] = useState('');
  const [images, setImages] = useState<{ uri: string }[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const [showExitMenu, setShowExitMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [imageViewer, setImageViewer] = useState<{ visible: boolean; index: number; urls: string[] }>({ visible: false, index: 0, urls: [] });

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const membersSlide = useRef(new Animated.Value(0)).current; // 0: hidden, 1: shown

  // Hooks
  const {
    messages,
    loading,
    error,
    hasMore,
    sendMessage,
    loadMore,
    markSeen,
    refresh,
  } = useChannelMessages(channelId);

  const {
    loading: reportLoading,
    error: reportError,
    reportMessage,
  } = useModeration();

  const {
    loading: exitLoading,
    error: exitError,
    leaveSpace,
  } = useSpaceOperations();

  const {
    members,
    loading: membersLoading,
    error: membersError,
    refresh: refreshMembers,
  } = useChannelMembers(channelId);

  // Start direct chat with selected member
  const handleStartChat = async (targetUserId: string, userName: string) => {
    if (!targetUserId) return;
    if (!user) {
      Alert.alert('エラー', 'チャット機能を使用するにはログインが必要です。');
      return;
    }
    const res = await chatService.createOrGetChat({
      participantIds: [targetUserId],
      type: 'direct',
    });
    if (res.success && res.data) {
      setShowMembers(false);
      if (onNavigateToChat) {
        onNavigateToChat(res.data.id, userName);
      } else {
        Alert.alert('チャット', `${userName}とのチャットを開きました。チャットタブから確認できます。`);
      }
    } else {
      Alert.alert('エラー', res.error || 'チャットの作成に失敗しました');
    }
  };

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

  // Animate members sidebar
  useEffect(() => {
    const { width } = Dimensions.get('window');
    if (showMembers) {
      refreshMembers();
      Animated.timing(membersSlide, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(membersSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [showMembers, membersSlide, refreshMembers]);

  // Mark channel as seen when screen loads
  useEffect(() => {
    if (channelId) {
      markSeen();
    }
  }, [channelId, markSeen]);

  // Handle send message (bundle text + images into one message)
  const handleSendMessage = async () => {
    if (!messageText.trim() && images.length === 0) return;

    const content = messageText.trim();
    setMessageText('');

    let attachments: { url: string; width?: number; height?: number; mime?: string }[] = [];
    if (images.length > 0) {
      try {
        const client = getSupabaseClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) { Alert.alert('エラー', 'ログインが必要です'); return; }
        attachments = await uploadRoomImages(user.id, images.map(i => i.uri));
      } catch (e: any) {
        Alert.alert('エラー', e?.message || '画像の送信に失敗しました');
        return;
      } finally {
        setImages([]);
      }
    }

    const type: 'text' | 'image' | 'file' = (!content && attachments.length > 0) ? 'image' : 'text';
    const result = await sendMessage(content, type, attachments);
    if (result) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }

    // Close composer
    Keyboard.dismiss();
  };

  // Handle message report
  const handleReportMessage = async (
    messageId: string,
    reason: ReportMessageRequest['reason'],
    description?: string
  ) => {
    const success = await reportMessage({
      message_id: messageId,
      reason,
      description,
    });

    if (success) {
      Alert.alert('報告完了', 'メッセージを報告しました');
      setShowReportModal(false);
      setSelectedMessageId(null);
    } else if (reportError) {
      Alert.alert('エラー', reportError);
    }
  };

  // Handle room exit
  const handleExitRoom = async () => {
    if (!spaceId) return; // Exit functionality not available without spaceId

    setShowExitMenu(false);

    Alert.alert(
      'ルーム退出',
      `${spaceName}から退出しますか？\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            const success = await leaveSpace(spaceId);
            if (success) {
              Alert.alert('退出完了', `${spaceName}から退出しました`);
              if (onExit) {
                onExit();
              } else if (onBack) {
                onBack();
              }
            } else if (exitError) {
              Alert.alert('エラー', exitError);
            }
          },
        },
      ]
    );
  };

  // Render message item
  const renderMessage = ({
    item,
    index,
  }: {
    item: RoomMessageWithSender;
    index: number;
  }) => {
    const isOwnMessage = !!user && item.sender_id === user.id;
    const isDeleted = !!item.deleted_at;

    return (
      <Pressable
        onLongPress={() => {
          if (isDeleted) return;
          // Avoid actions for optimistic (unsaved) messages
          const isOptimistic = (item as any).isOptimistic || (typeof item.id === 'string' && item.id.startsWith('temp_'));
          if (isOptimistic) return;
          if (isOwnMessage) {
            Alert.alert('メッセージ削除', 'このメッセージを削除しますか？', [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: '削除',
                style: 'destructive',
                onPress: async () => {
                  const res = await roomService.deleteChannelMessage(item.id);
                  if (!res.success) {
                    Alert.alert('エラー', res.error || '削除に失敗しました');
                  } else {
                    // Refresh list to remove the message immediately
                    refresh();
                  }
                },
              },
            ]);
          } else {
            setSelectedMessageId(item.id);
            Alert.alert('メッセージ操作', 'このメッセージを報告しますか？', [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: '報告',
                style: 'destructive',
                onPress: () => handleReportMessage(item.id, 'inappropriate'),
              },
            ]);
          }
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
              backgroundColor: '#ffffff10',
              padding: theme.spacing(1.75),
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* アイコン左、名前右（画像優先） */}
                {item.sender?.avatar_url ? (
                  <Image
                    source={{ uri: item.sender.avatar_url }}
                    style={{ width: 18, height: 18, borderRadius: 9, marginRight: 8 }}
                  />
                ) : (
                  <Text style={{ color: colors.subtext, fontSize: 12, marginRight: 8 }}>
                    {item.sender_avatar_emoji || '👤'}
                  </Text>
                )}
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: 'bold',
                  }}
                >
                  {item.sender_display_name || item.sender_username}
                </Text>
              </View>

              {item.is_edited && (
                <Text
                  style={{
                    color: colors.subtext,
                    fontSize: 11,
                    fontStyle: 'italic',
                  }}
                >
                  (編集済み)
                </Text>
              )}
            </View>

            {/* Attachments (images) */}
            {!isDeleted && Array.isArray(item.attachments) && item.attachments.length > 0 && (
              <View style={{ marginBottom: 8, gap: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
                {item.attachments.map((att: any, idx: number) => (
                  <Pressable
                    key={idx}
                    onPress={() =>
                      setImageViewer({
                        visible: true,
                        index: idx,
                        urls: item.attachments.map((a: any) => a.url || a),
                      })
                    }
                    style={{ width: '48%', borderRadius: 10, overflow: 'hidden', backgroundColor: '#00000020' }}
                  >
                    <Image source={{ uri: att.url || att }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Text content (if any) */}
            {!isDeleted && !!(item.content && item.content.length) && (!item.message_type || item.message_type !== 'image' || (item.attachments?.length ?? 0) === 0) && (
              <ExpandableText
                text={item.content}
                maxLines={3}
                textStyle={{
                  color: item.is_masked ? colors.subtext : colors.text,
                  fontSize: 16,
                }}
                containerStyle={{ marginBottom: 8 }}
              />
            )}

            {/* Legacy single-image fallback: content is URL and no attachments */}
            {!isDeleted && !item.attachments?.length && item.message_type === 'image' && item.content?.startsWith('http') && (
              <Pressable
                onPress={() =>
                  setImageViewer({ visible: true, index: 0, urls: [item.content] })
                }
                style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', backgroundColor: '#00000020' }}
              >
                <Image source={{ uri: item.content }} style={{ width: '100%', aspectRatio: 16/9 }} resizeMode="cover" />
              </Pressable>
            )}

            {isDeleted && (
              <Text style={{ color: colors.subtext, fontSize: 13, fontStyle: 'italic' }}>
                このメッセージは削除されました
              </Text>
            )}

            <Text style={{ color: colors.subtext, fontSize: 12 }}>
              {new Date(item.created_at).toLocaleString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </BlurView>
        </View>
      </Pressable>
    );
  };

  return (
    <>
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
          <View style={{ 
            flexDirection: handPreference === 'left' ? 'row' : 'row-reverse', 
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {onBack && (
              <Pressable 
                onPress={onBack} 
                style={{ 
                  ...(handPreference === 'left' ? { marginRight: 12 } : { marginLeft: 12 })
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {handPreference === 'left' ? '←' : '→'}
                </Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                }}
              >
                {spaceName}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 14 }}>
                #general
              </Text>
            </View>

            {/* Three dots menu - only show if spaceId is available */}
            {spaceId && (
              <Pressable
                onPress={() => setShowMenu(true)}
                style={({ pressed }) => [
                  {
                    padding: 8,
                    marginRight: -8,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: 'bold',
                  }}
                >
                  •••
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages.filter(m => !m.deleted_at)}
          keyExtractor={item => item.id}
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
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 40,
              }}
            >
              <Text style={{ color: colors.subtext, fontSize: 16 }}>
                {loading
                  ? 'メッセージを読み込み中...'
                  : 'まだメッセージがありません'}
              </Text>
              {!loading && (
                <Text
                  style={{
                    color: colors.subtext,
                    fontSize: 14,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  最初のメッセージを送信してみましょう
                </Text>
              )}
            </View>
          )}
          ListHeaderComponent={() =>
            hasMore ? (
              <View style={{ alignItems: 'center', padding: 16 }}>
                <Text style={{ color: colors.subtext, fontSize: 14 }}>
                  過去のメッセージを読み込み中...
                </Text>
              </View>
            ) : null
          }
        />

        {/* Message Input */}
        <View
          style={{
            padding: theme.spacing(2),
            paddingBottom: Platform.OS === 'ios' ? 90 : 20,
          }}
        >
          <View
            style={{
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
            }}
          >
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                backgroundColor: '#ffffff10',
                flexDirection: handPreference === 'left' ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              {/* 添付ボタン */}
              <Pressable
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
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 16,
                  maxHeight: 100,
                  textAlignVertical: 'top',
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
                disabled={(!messageText.trim() && images.length === 0) || exitLoading}
                style={({ pressed }) => [
                  {
                    backgroundColor: (messageText.trim() || images.length > 0)
                      ? colors.pink
                      : colors.subtext + '40',
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    ...(handPreference === 'left' ? { marginRight: 8 } : { marginLeft: 8 }),
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <Text
                  style={{
                    color: (messageText.trim() || images.length > 0) ? 'white' : colors.subtext,
                    fontSize: 14,
                    fontWeight: 'bold',
                  }}
                >
                  送信
                </Text>
              </Pressable>
            </BlurView>
            {images.length > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {images.map((img, idx) => (
                  <Pressable key={idx} onPress={() => setImages(prev => prev.filter((_, i) => i !== idx))} style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: '#ffffff12' }}>
                    <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Menu Modal - only show if spaceId is available */}
        {showMenu && spaceId && (
          <Pressable
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setShowMenu(false)}
          >
            <Pressable
              style={{
                backgroundColor: colors.bg,
                borderRadius: theme.radius.lg,
                marginHorizontal: theme.spacing(4),
                paddingVertical: theme.spacing(3),
                paddingHorizontal: theme.spacing(2),
                minWidth: 200,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.subtext + '20',
              }}
              onPress={e => e.stopPropagation()}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                  marginBottom: theme.spacing(3),
                }}
              >
                {spaceName}
              </Text>

              {/* Members button - shows sidebar */}
              <Pressable
                onPress={() => {
                  setShowMenu(false);
                  setShowMembers(true);
                  if (onMembers) onMembers();
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: 'transparent',
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing(4),
                    paddingVertical: theme.spacing(1.5),
                    marginBottom: theme.spacing(2),
                    opacity: pressed ? 0.7 : 1,
                    minWidth: 120,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.subtext + '40',
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: 'bold',
                  }}
                >
                  メンバー
                </Text>
              </Pressable>

              {/* Invite button - only show for private spaces */}
              {isPrivateSpace && onInvite && (
                <Pressable
                  onPress={() => {
                    setShowMenu(false);
                    onInvite();
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.pink,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing(4),
                      paddingVertical: theme.spacing(1.5),
                      marginBottom: theme.spacing(2),
                      opacity: pressed ? 0.7 : 1,
                      minWidth: 120,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 16,
                      fontWeight: 'bold',
                    }}
                  >
                    招待
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleExitRoom}
                disabled={exitLoading}
                style={({ pressed }) => [
                  {
                    backgroundColor: exitLoading
                      ? colors.subtext + '40'
                      : 'transparent',
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing(4),
                    paddingVertical: theme.spacing(1.5),
                    marginBottom: theme.spacing(2),
                    opacity: pressed ? 0.7 : 1,
                    minWidth: 120,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.pink,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.pink,
                    fontSize: 16,
                    fontWeight: 'bold',
                  }}
                >
                  {exitLoading ? '退出中...' : '退出'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowMenu(false)}
                style={({ pressed }) => [
                  {
                    backgroundColor: 'transparent',
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing(4),
                    paddingVertical: theme.spacing(1.5),
                    opacity: pressed ? 0.7 : 1,
                    minWidth: 120,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.subtext + '40',
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                  }}
                >
                  キャンセル
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* Members Sidebar */}
        {showMembers && (
          <Pressable
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-start',
              alignItems: 'flex-end',
            }}
            onPress={() => setShowMembers(false)}
          >
            <Animated.View
              style={{
                width: '80%',
                height: '100%',
                backgroundColor: colors.bg,
                borderTopLeftRadius: theme.radius.lg,
                borderBottomLeftRadius: theme.radius.lg,
                transform: [
                  {
                    translateX: membersSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [Dimensions.get('window').width, 0],
                    }),
                  },
                ],
              }}
            >
              {/* Sidebar header */}
              <View
                style={{
                  paddingTop: 48,
                  paddingBottom: 16,
                  paddingHorizontal: theme.spacing(2),
                  borderBottomWidth: 1,
                  borderBottomColor: colors.subtext + '20',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}
                >
                  メンバー
                </Text>
                <Pressable onPress={() => setShowMembers(false)}>
                  <Text style={{ color: colors.text, fontSize: 18 }}>×</Text>
                </Pressable>
              </View>

              {/* Members list */}
              <FlatList
                data={members}
                keyExtractor={item => item.user_id}
                contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: 100 }}
                ListHeaderComponent={() => (
                  <View style={{ marginBottom: theme.spacing(1) }}>
                    <Text style={{ color: colors.subtext, fontSize: 14 }}>
                      参加メンバー（{members.length}）
                    </Text>
                  </View>
                )}
                ItemSeparatorComponent={() => (
                  <View style={{ height: theme.spacing(1) }} />
                )}
                renderItem={({ item }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: theme.radius.lg,
                      backgroundColor: '#ffffff10',
                    }}
                  >
                    {item.user?.avatar_url ? (
                      <Image
                        source={{ uri: item.user.avatar_url }}
                        style={{ width: 22, height: 22, borderRadius: 11, marginRight: 10 }}
                      />
                    ) : (
                      <Text style={{ fontSize: 18, marginRight: 10 }}>
                        {item.user?.avatar_emoji || '👤'}
                      </Text>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                        {item.user?.display_name || item.user?.username || 'ユーザー'}
                      </Text>
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>
                        {item.role === 'owner'
                          ? 'オーナー'
                          : item.role === 'moderator'
                          ? 'モデレーター'
                          : 'メンバー'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        handleStartChat(
                          item.user_id,
                          item.user?.display_name || item.user?.username || 'ユーザー'
                        )
                      }
                      style={({ pressed }) => ({
                        backgroundColor: colors.pink,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: theme.radius.md,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                        チャット
                      </Text>
                    </Pressable>
                  </View>
                )}
                ListEmptyComponent={() => (
                  <View style={{ padding: theme.spacing(2) }}>
                    <Text style={{ color: colors.subtext, fontSize: 14 }}>
                      {membersLoading ? 'メンバーを読み込み中...' : 'メンバーがいません'}
                    </Text>
                  </View>
                )}
                refreshing={membersLoading}
                onRefresh={refreshMembers}
              />

              {/* Error display for members */}
              {membersError && (
                <View
                  style={{
                    position: 'absolute',
                    top: 90,
                    left: theme.spacing(2),
                    right: theme.spacing(2),
                    backgroundColor: colors.pink + '20',
                    borderRadius: theme.radius.md,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.pink,
                  }}
                >
                  <Text style={{ color: colors.pink, fontSize: 14 }}>{membersError}</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>
        )}

        {/* Error display */}
        {(error || exitError) && (
          <View
            style={{
              position: 'absolute',
              top: 100,
              left: theme.spacing(2),
              right: theme.spacing(2),
              backgroundColor: colors.pink + '20',
              borderRadius: theme.radius.md,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.pink,
            }}
          >
            <Text style={{ color: colors.pink, fontSize: 14 }}>
              {error || exitError}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Animated.View>
      {/* Simple image viewer modal */}
      <Modal
        visible={imageViewer.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewer({ visible: false, index: 0, urls: [] })}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: '#000000CC', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setImageViewer({ visible: false, index: 0, urls: [] })}
        >
          {imageViewer.urls[imageViewer.index] ? (
            <Image source={{ uri: imageViewer.urls[imageViewer.index] }} style={{ width: '90%', height: '70%', resizeMode: 'contain' }} />
          ) : null}
        </Pressable>
      </Modal>
  </>
  );
}
