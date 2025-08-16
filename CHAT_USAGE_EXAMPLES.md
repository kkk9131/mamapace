# MamaPace チャット機能 使用例・ドキュメント

MamaPaceアプリのチャット機能の実装ガイドと使用例です。

## 📁 ファイル構成

```
src/
├── types/
│   └── chat.ts              # チャット関連型定義
├── services/
│   └── chatService.ts       # チャットAPI通信層
└── hooks/
    ├── useChat.ts          # 個別チャット管理Hook
    └── useChatList.ts      # チャット一覧管理Hook
```

## 🔧 セットアップ

### 1. サービス初期化

```typescript
// App.tsx または適切な初期化場所
import { initializeChatService } from './src/services/chatService';
import { useAuth } from './src/contexts/AuthContext';

function App() {
  const { isAuthenticated, user } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated && user) {
      // 認証後にチャットサービスを初期化
      initializeChatService().catch(console.error);
    }
  }, [isAuthenticated, user]);

  // ...
}
```

## 📱 チャット一覧画面の実装

### 基本的な使用例

```typescript
// ChatListScreen.tsx
import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { useChatList } from '../hooks/useChatList';

function ChatListScreen() {
  const {
    chats,
    isLoading,
    error,
    searchQuery,
    searchChats,
    clearSearch,
    createChat,
    refreshChats,
    getTotalUnreadCount,
    canLoadMore,
    loadMoreChats
  } = useChatList();

  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // 新しいチャットを作成
  const handleCreateChat = async () => {
    if (!selectedUserId) return;
    
    const newChat = await createChat(selectedUserId, 'こんにちは！');
    if (newChat) {
      // チャット画面に遷移
      navigation.navigate('Chat', { chatId: newChat.id });
    }
  };

  // チャット検索
  const handleSearch = (query: string) => {
    searchChats(query);
  };

  // チャット項目のレンダリング
  const renderChatItem = ({ item }: { item: ChatWithParticipants }) => {
    const otherParticipant = item.participants.find(p => p.id !== user?.id);
    const lastMessagePreview = item.last_message?.content || 'メッセージはありません';
    
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('Chat', { chatId: item.id })}
      >
        <View style={styles.avatarContainer}>
          <Text style={styles.avatar}>{otherParticipant?.avatar_emoji || '👤'}</Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.chatInfo}>
          <Text style={styles.participantName}>
            {otherParticipant?.display_name || otherParticipant?.username}
          </Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {lastMessagePreview}
          </Text>
        </View>
        
        <Text style={styles.timestamp}>
          {formatTimestamp(item.last_message_at || item.updated_at)}
        </Text>
      </TouchableOpacity>
    );
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshChats}>
          <Text style={styles.retryText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 検索バー */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="チャットを検索..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={clearSearch}>
            <Text style={styles.clearSearch}>クリア</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 未読件数表示 */}
      {getTotalUnreadCount() > 0 && (
        <View style={styles.unreadSummary}>
          <Text style={styles.unreadSummaryText}>
            未読メッセージ: {getTotalUnreadCount()}件
          </Text>
        </View>
      )}

      {/* チャット一覧 */}
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        refreshing={isLoading}
        onRefresh={refreshChats}
        onEndReached={canLoadMore ? loadMoreChats : undefined}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>チャットがありません</Text>
          </View>
        }
      />

      {/* 新しいチャット作成ボタン */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => {/* ユーザー選択画面を表示 */}}
      >
        <Text style={styles.createButtonText}>+ 新しいチャット</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### フィルタリング機能付き

```typescript
// ChatListWithFilters.tsx
import { useUnreadChats, useDirectChats } from '../hooks/useChatList';

function UnreadChatsTab() {
  const { chats, isLoading, error, refreshChats } = useUnreadChats();
  
  return (
    <FlatList
      data={chats}
      renderItem={renderChatItem}
      refreshing={isLoading}
      onRefresh={refreshChats}
      ListEmptyComponent={
        <Text style={styles.emptyText}>未読のチャットはありません</Text>
      }
    />
  );
}

function DirectChatsTab() {
  const { chats, isLoading, error, refreshChats } = useDirectChats();
  
  return (
    <FlatList
      data={chats}
      renderItem={renderChatItem}
      refreshing={isLoading}
      onRefresh={refreshChats}
    />
  );
}
```

## 💬 個別チャット画面の実装

### 基本的な使用例

```typescript
// ChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView } from 'react-native';
import { useChat } from '../hooks/useChat';

interface ChatScreenProps {
  route: { params: { chatId: string } };
}

function ChatScreen({ route }: ChatScreenProps) {
  const { chatId } = route.params;
  const {
    chat,
    messages,
    isLoading,
    isSending,
    error,
    typingUsers,
    sendMessage,
    editMessage,
    deleteMessage,
    updateTypingStatus,
    loadMoreMessages,
    canLoadMore,
    clearError
  } = useChat(chatId);

  const [messageText, setMessageText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // メッセージ送信
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    if (editingMessageId) {
      // メッセージ編集
      await editMessage(editingMessageId, messageText);
      setEditingMessageId(null);
    } else {
      // 新規メッセージ送信
      await sendMessage(messageText);
    }

    setMessageText('');
    
    // リストを最下部にスクロール
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // タイピング状態の更新
  const handleTextChange = (text: string) => {
    setMessageText(text);

    // タイピング開始
    updateTypingStatus(true);

    // デバウンス処理でタイピング停止
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 1000);
  };

  // メッセージ項目のレンダリング
  const renderMessage = ({ item }: { item: MessageWithSender }) => {
    const isMyMessage = item.sender_id === user?.id;
    const isOptimistic = (item as any).isOptimistic;
    const hasError = (item as any).error;

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.otherMessage
      ]}>
        {!isMyMessage && (
          <Text style={styles.senderName}>{item.sender.display_name}</Text>
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myBubble : styles.otherBubble,
          isOptimistic && styles.optimisticMessage,
          hasError && styles.errorMessage
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          
          {item.edited_at && (
            <Text style={styles.editedLabel}>(編集済み)</Text>
          )}
        </View>

        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>
            {formatTimestamp(item.created_at)}
          </Text>
          
          {isMyMessage && item.is_read && (
            <Text style={styles.readStatus}>既読</Text>
          )}
          
          {hasError && (
            <TouchableOpacity onPress={() => {/* 再送信処理 */}}>
              <Text style={styles.retryText}>再送信</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 長押しメニュー */}
        {isMyMessage && (
          <TouchableOpacity
            style={styles.messageActions}
            onLongPress={() => showMessageActions(item)}
          >
            <Text>⋯</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // タイピングインジケーター
  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>
          {typingUsers.length === 1 ? '相手がタイピング中...' : 'タイピング中...'}
        </Text>
      </View>
    );
  };

  // メッセージアクション（編集・削除）
  const showMessageActions = (message: MessageWithSender) => {
    // ActionSheet または Modal でアクションを表示
    Alert.alert(
      'メッセージ',
      '',
      [
        { text: '編集', onPress: () => startEditMessage(message) },
        { text: '削除', onPress: () => confirmDeleteMessage(message.id) },
        { text: 'キャンセル', style: 'cancel' }
      ]
    );
  };

  const startEditMessage = (message: MessageWithSender) => {
    setEditingMessageId(message.id);
    setMessageText(message.content);
  };

  const confirmDeleteMessage = (messageId: string) => {
    Alert.alert(
      '削除確認',
      'このメッセージを削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', onPress: () => deleteMessage(messageId, true) }
      ]
    );
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={clearError}>
          <Text style={styles.retryText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      {/* チャットヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {chat?.participants.find(p => p.id !== user?.id)?.display_name || 'チャット'}
        </Text>
      </View>

      {/* メッセージ一覧 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        onEndReached={canLoadMore ? loadMoreMessages : undefined}
        onEndReachedThreshold={0.5}
        inverted={false}
        ListFooterComponent={renderTypingIndicator}
      />

      {/* メッセージ入力欄 */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={messageText}
          onChangeText={handleTextChange}
          placeholder={editingMessageId ? 'メッセージを編集...' : 'メッセージを入力...'}
          multiline
          maxLength={2000}
        />
        
        {editingMessageId && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setEditingMessageId(null);
              setMessageText('');
            }}
          >
            <Text>キャンセル</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || isSending) && styles.disabledButton]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>
            {isSending ? '送信中...' : editingMessageId ? '更新' : '送信'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
```

## 🔧 高度な使用例

### リアルタイム通知の実装

```typescript
// hooks/useRealTimeNotifications.ts
import { useEffect } from 'react';
import { useChatList } from './useChatList';
import * as Notifications from 'expo-notifications';

export function useRealTimeNotifications() {
  const { chats, getTotalUnreadCount } = useChatList();

  useEffect(() => {
    // アプリがバックグラウンドの時に新着メッセージの通知を送信
    const unreadCount = getTotalUnreadCount();
    
    if (unreadCount > 0) {
      Notifications.setBadgeCountAsync(unreadCount);
    }
  }, [chats, getTotalUnreadCount]);

  useEffect(() => {
    // チャット一覧の変更を監視して新着メッセージを通知
    const handleNewMessage = async () => {
      if (AppState.currentState === 'background') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '新しいメッセージ',
            body: '新しいメッセージが届きました',
            data: { type: 'new_message' }
          },
          trigger: null
        });
      }
    };

    // チャット一覧の変更を監視（実装は省略）
    
  }, [chats]);
}
```

### カスタムメッセージタイプの実装

```typescript
// components/MessageRenderer.tsx
import { MessageWithSender, MessageType } from '../types/chat';

function MessageRenderer({ message }: { message: MessageWithSender }) {
  switch (message.message_type) {
    case MessageType.TEXT:
      return <TextMessage message={message} />;
    
    case MessageType.IMAGE:
      return <ImageMessage message={message} />;
    
    case MessageType.FILE:
      return <FileMessage message={message} />;
    
    case MessageType.SYSTEM:
      return <SystemMessage message={message} />;
    
    default:
      return <TextMessage message={message} />;
  }
}

function ImageMessage({ message }: { message: MessageWithSender }) {
  const imageUrl = message.metadata?.file_url;
  
  return (
    <View style={styles.imageContainer}>
      <Image source={{ uri: imageUrl }} style={styles.messageImage} />
      {message.content && (
        <Text style={styles.imageCaption}>{message.content}</Text>
      )}
    </View>
  );
}
```

### エラーハンドリングとオフライン対応

```typescript
// hooks/useOfflineChat.ts
import { useNetInfo } from '@react-native-async-storage/async-storage';
import { useChat } from './useChat';

export function useOfflineChat(chatId: string) {
  const netInfo = useNetInfo();
  const chat = useChat(chatId);

  const sendMessageOffline = async (content: string) => {
    if (netInfo.isConnected) {
      return chat.sendMessage(content);
    } else {
      // オフライン時はローカルに保存して後で同期
      await saveMessageForLaterSync(chatId, content);
      return Promise.resolve();
    }
  };

  return {
    ...chat,
    sendMessage: sendMessageOffline,
    isOffline: !netInfo.isConnected
  };
}
```

## 🎨 スタイリング例

```typescript
// styles/chatStyles.ts
import { StyleSheet } from 'react-native';

export const chatListStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12
  },
  avatar: {
    fontSize: 32,
    width: 48,
    height: 48,
    textAlign: 'center',
    lineHeight: 48
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold'
  }
});

export const chatScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  messageContainer: {
    padding: 8,
    maxWidth: '80%'
  },
  myMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end'
  },
  otherMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start'
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: '100%'
  },
  myBubble: {
    backgroundColor: '#007AFF'
  },
  otherBubble: {
    backgroundColor: 'white'
  },
  optimisticMessage: {
    opacity: 0.7
  },
  errorMessage: {
    backgroundColor: '#ffebee'
  }
});
```

## 🔒 セキュリティ考慮事項

### 1. データサニタイゼーション

```typescript
// services/chatService.ts での実装例
import { sanitizeChatForLogging, sanitizeMessageForLogging } from '../types/chat';

// ログ出力時は必ずサニタイズ
secureLogger.info('Sending message', sanitizeMessageForLogging(request));
```

### 2. 入力値検証

```typescript
// メッセージ送信前の検証
const validateMessageContent = (content: string): boolean => {
  // 長さチェック
  if (content.length > ChatConstraints.message.maxLength) {
    return false;
  }
  
  // 不正文字チェック
  const dangerousPatterns = [/<script>/gi, /javascript:/gi];
  return !dangerousPatterns.some(pattern => pattern.test(content));
};
```

### 3. レート制限

```typescript
// chatService.ts で実装されているレート制限の使用
// 1分間に30メッセージ、1時間に10チャット作成まで
const rateLimitConfig = ChatConstraints.rateLimit;
```

## 📊 パフォーマンス最適化

### 1. メッセージリストの最適化

```typescript
// React.memo を使用してメッセージコンポーネントの再レンダリングを防ぐ
const MessageItem = React.memo(({ message }: { message: MessageWithSender }) => {
  return <MessageRenderer message={message} />;
}, (prevProps, nextProps) => {
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.updated_at === nextProps.message.updated_at;
});
```

### 2. 無限スクロール

```typescript
// FlatList の onEndReached で実装
<FlatList
  data={messages}
  renderItem={renderMessage}
  onEndReached={canLoadMore ? loadMoreMessages : undefined}
  onEndReachedThreshold={0.1}
  getItemLayout={(data, index) => ({
    length: ESTIMATED_MESSAGE_HEIGHT,
    offset: ESTIMATED_MESSAGE_HEIGHT * index,
    index
  })}
/>
```

## 🧪 テスト例

### 1. Hookのテスト

```typescript
// __tests__/useChat.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useChat } from '../hooks/useChat';

jest.mock('../services/chatService');

describe('useChat', () => {
  it('should send message successfully', async () => {
    const { result } = renderHook(() => useChat('chat-123'));
    
    await act(async () => {
      await result.current.sendMessage('Hello, World!');
    });
    
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello, World!');
  });

  it('should handle send message error', async () => {
    const { result } = renderHook(() => useChat('chat-123'));
    
    // Mock service error
    chatService.sendMessage.mockRejectedValue(new Error('Network error'));
    
    await act(async () => {
      await result.current.sendMessage('Hello');
    });
    
    expect(result.current.error).toBeTruthy();
  });
});
```

## 🚀 今後の拡張機能

1. **グループチャット**: 複数人でのチャット機能
2. **メッセージの既読リスト**: 誰がメッセージを読んだかの詳細表示
3. **メッセージの暗号化**: エンドツーエンド暗号化対応
4. **ファイル共有**: 画像・ドキュメントの共有機能
5. **音声メッセージ**: 音声録音・再生機能
6. **メッセージ検索**: 全文検索機能
7. **チャットのアーカイブ**: 古いチャットのアーカイブ機能

## ⚠️ 注意事項

1. **リアルタイム機能**: Supabaseのリアルタイム機能が有効である必要があります
2. **認証**: チャット機能を使用する前に認証が完了している必要があります
3. **データベース設計**: 適切なRLS（Row Level Security）ポリシーの設定が必要です
4. **パフォーマンス**: 大量のメッセージがある場合は仮想化リストの使用を検討してください

このドキュメントを参考にして、MamaPaceアプリに安全で使いやすいチャット機能を実装してください。