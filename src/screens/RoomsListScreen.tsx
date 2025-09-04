import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useChatList } from '../hooks/useRooms';
import AnonRoomScreen from './AnonRoomScreen';
import ChannelScreen from './ChannelScreen';
import InviteFollowersScreen from './InviteFollowersScreen';

interface RoomsListScreenProps {
  onNavigateToChannel?: (channelId: string, spaceName: string) => void;
  onBack?: () => void;
  refreshKey?: number;
}

export default function RoomsListScreen({
  onNavigateToChannel,
  onBack,
  refreshKey,
}: RoomsListScreenProps) {
  const theme = useTheme();
  const { colors } = theme;
  const fade = useRef(new Animated.Value(0)).current;

  // State management
  const [currentView, setCurrentView] = useState<
    'list' | 'anonymous' | 'channel' | 'space' | 'invite' | 'directChat'
  >('list');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatUserName, setActiveChatUserName] = useState<string | null>(
    null
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Animation - smart animation handling to prevent blank screen on back navigation
  React.useEffect(() => {
    if (currentView === 'list') {
      // Ensure immediate display when returning to list view
      fade.setValue(1);
    } else {
      // Animate in for initial load
      const timer = setTimeout(() => {
        Animated.timing(fade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [currentView, fade]);

  // Hooks: channel-based chat list (chat experience)
  const { chatList, loading, error, refresh } = useChatList();

  // Refresh when navigated to this screen
  React.useEffect(() => {
    refresh();
  }, [refreshKey]);

  // Handle navigation
  const handleChannelSelect = (
    channelId: string,
    spaceName: string,
    spaceId: string,
    space?: any
  ) => {
    setSelectedChannelId(channelId);
    setSelectedSpaceName(spaceName);
    setSelectedSpaceId(spaceId);
    setSelectedSpace(space || { id: spaceId, name: spaceName, is_public: false }); // Default to private for testing
    if (onNavigateToChannel) {
      onNavigateToChannel(channelId, spaceName);
    } else {
      setCurrentView('channel');
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setCurrentView('list');
    }
  };

  // Different views
  if (currentView === 'anonymous') {
    return (
      <AnonRoomScreen
        onBack={() => {
          // Ensure immediate display when returning to list view
          fade.setValue(1);
          setCurrentView('list');
        }}
      />
    );
  }

  if (currentView === 'channel' && selectedChannelId) {
    return (
      <ChannelScreen
        channelId={selectedChannelId}
        spaceName={selectedSpaceName}
        spaceId={selectedSpaceId}
        isPrivateSpace={true} // Temporarily always show invite button for testing
        onBack={() => {
          // Ensure immediate display when returning to list view
          fade.setValue(1);
          // Always return to the room list view, not to the parent screen
          setCurrentView('list');
        }}
        onInvite={() => {
          // Navigate to invite screen
          setCurrentView('invite');
        }}
        onExit={() => {
          // Handle exit - refresh the room list and return to list view
          refresh();
          fade.setValue(1);
          setCurrentView('list');
        }}
        onNavigateToChat={(chatId: string, userName: string) => {
          setActiveChatId(chatId);
          setActiveChatUserName(userName);
          setCurrentView('directChat');
        }}
        onOpenUser={(userId: string) => {
          setSelectedUserId(userId);
          setCurrentView('userProfile');
        }}
      />
    );
  }
  if (currentView === 'space' && selectedSpaceId) {
    return (
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'transparent',
          paddingTop: 40,
          opacity: fade,
        }}
      >
        <View style={{ paddingHorizontal: theme.spacing(2), marginBottom: 16 }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
            {selectedSpaceName}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 14, marginTop: 8 }}>
            現在このルームではチャンネル機能が無効です。参加状態のみ保持しています。
          </Text>
        </View>

        <View style={{ paddingHorizontal: theme.spacing(2) }}>
          <Pressable
            onPress={() => setCurrentView('list')}
            style={({ pressed }) => [{
              backgroundColor: colors.surface,
              paddingVertical: 12,
              borderRadius: theme.radius.md,
              alignItems: 'center',
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }]}
          >
            <Text style={{ color: colors.text, fontWeight: 'bold' }}>戻る</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  if (currentView === 'invite') {
    return (
      <InviteFollowersScreen
        spaceName={selectedSpaceName}
        spaceId={selectedSpaceId || ''}
        onBack={() => {
          fade.setValue(1);
          setCurrentView('channel');
        }}
        onInviteSent={(selectedUsers, spaceName) => {
          // Handle successful invite sending
          console.log(`Sent invites to ${selectedUsers.length} users for space: ${spaceName}`);
          fade.setValue(1);
          setCurrentView('channel');
        }}
      />
    );
  }

  if (currentView === 'directChat') {
    const ChatScreen = require('./ChatScreen').default;
    return (
      <ChatScreen
        chatId={activeChatId || undefined}
        userName={activeChatUserName || 'ユーザー'}
        onBack={() => {
          setActiveChatId(null);
          setActiveChatUserName(null);
          setCurrentView('channel');
        }}
        onNavigateToUser={(userId: string) => {
          setSelectedUserId(userId);
          setCurrentView('userProfile');
        }}
      />
    );
  }

  if (currentView === 'userProfile' && selectedUserId) {
    const UserProfileScreen = require('./UserProfileScreen').default;
    return (
      <UserProfileScreen
        userId={selectedUserId}
        onBack={() => {
          setSelectedUserId(null);
          setCurrentView('channel');
        }}
        onNavigateToChat={(chatId: string, userName: string) => {
          setActiveChatId(chatId);
          setActiveChatUserName(userName);
          setCurrentView('directChat');
        }}
      />
    );
  }

  // Main room list view
  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: 'transparent',
        paddingTop: 40,
        opacity: fade,
      }}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: theme.spacing(2), marginBottom: 16 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: 'bold',
            marginBottom: 8,
          }}
        >
          参加ルーム
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 14 }}>
          あなたが参加しているルーム一覧
        </Text>
      </View>

      {/* Room List */}
      <FlatList
        data={[
          {
            id: 'anonymous',
            type: 'anonymous' as const,
            name: '愚痴もたまには、、、',
            desc: '完全匿名・1時間でポストが消えます',
            badge: '匿名',
            has_new: false,
            unread_count: 0,
          },
          ...chatList.map(item => ({
            id: item.channel_id,
            type: 'channel' as const,
            name: item.space_name,
            desc: item.latest_message_content || 'メッセージがありません',
            badge: item.space_is_public ? '公開' : '非公開',
            has_new: item.has_new,
            unread_count: item.unread_count,
            latest_message_at: item.latest_message_at,
            space_name: item.space_name,
            space_id: item.space_id,
          })),
        ]}
        keyExtractor={item => item.id}
        contentContainerStyle={{
          padding: theme.spacing(2),
          paddingTop: 0,
          paddingBottom: theme.spacing(10),
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(1.5) }} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.text}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            testID={item.type === 'anonymous' ? 'anonymous-room-entry' : undefined}
            onPress={() => {
              if (item.type === 'anonymous') {
                setCurrentView('anonymous');
              } else {
                handleChannelSelect(
                  item.id,
                  item.space_name || item.name,
                  item.space_id
                );
              }
            }}
            style={({ pressed }) => [
              {
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.shadow.card,
              },
            ]}
          >
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                padding: theme.spacing(1.75),
                backgroundColor:
                  item.type === 'anonymous' ? '#F6C6D040' : '#ffffff10',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 16,
                        marginBottom: 6,
                        fontWeight: 'bold',
                      }}
                    >
                      {item.name}
                    </Text>
                    {item.type === 'channel' && item.has_new && (
                      <View
                        style={{
                          backgroundColor: colors.pink,
                          borderRadius: 8,
                          width: 16,
                          height: 16,
                          marginLeft: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 'bold',
                          }}
                        >
                          {item.unread_count > 9 ? '9+' : item.unread_count}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={{ color: colors.subtext, fontSize: 14 }}
                    numberOfLines={2}
                  >
                    {item.desc}
                  </Text>

                  {item.type === 'channel' && item.latest_message_at && (
                    <Text
                      style={{
                        color: colors.subtext,
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {new Date(item.latest_message_at).toLocaleString(
                        'ja-JP',
                        {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </Text>
                  )}
                </View>

                <View
                  style={{
                    backgroundColor: colors.pinkSoft,
                    borderRadius: theme.radius.sm,
                    paddingHorizontal: theme.spacing(1.25),
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: '#302126', fontSize: 12 }}>
                    {item.badge}
                  </Text>
                </View>
              </View>
            </BlurView>
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text
              style={{
                color: colors.subtext,
                fontSize: 16,
                marginBottom: 8,
              }}
            >
              参加しているルームがありません
            </Text>
            <Text
              style={{
                color: colors.subtext,
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              ルームタブで人気ルームを見つけて参加してみましょう
            </Text>
          </View>
        )}
        ListHeaderComponent={
          error ? (
            <View style={{ padding: theme.spacing(2), alignItems: 'center' }}>
              <Text style={{ color: colors.error, fontSize: 14 }}>
                エラーが発生しました: {error}
              </Text>
            </View>
          ) : null
        }
      />
    </Animated.View>
  );
}
