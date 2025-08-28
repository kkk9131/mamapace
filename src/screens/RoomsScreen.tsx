import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';
import {
  useSpaceSearch,
  useSpaceOperations,
  useSpacePermissions,
  usePopularSpaces,
} from '../hooks/useRooms';
import { SpaceWithOwner } from '../types/room';
import AnonRoomScreen from './AnonRoomScreen';
import ChannelScreen from './ChannelScreen';
import CreateSpaceScreen from './CreateSpaceScreen';
import InviteFollowersScreen from './InviteFollowersScreen';

interface RoomsScreenProps {
  onNavigateToChannel?: (channelId: string, spaceName: string) => void;
}

export default function RoomsScreen({ onNavigateToChannel }: RoomsScreenProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = useRef(new Animated.Value(0)).current;

  // State management
  const [currentView, setCurrentView] = useState<
    'list' | 'search' | 'anonymous' | 'channel' | 'create' | 'invite' | 'directChat'
  >('list');
  const [selectedFilter, setSelectedFilter] = useState<string>('すべて');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatUserName, setActiveChatUserName] = useState<string | null>(
    null
  );

  // Hooks
  const {
    spaces: searchSpaces,
    loading: searchLoading,
    error: searchError,
    searchSpaces: doSearch,
    clearResults,
  } = useSpaceSearch();
  const {
    spaces: popularSpaces,
    loading: popularLoading,
    error: popularError,
    refresh: refreshPopular,
  } = usePopularSpaces();
  const {
    loading: operationLoading,
    error: operationError,
    joinSpace,
  } = useSpaceOperations();
  const { canCreateSpaces } = useSpacePermissions();

  // Animation - smart animation handling to prevent blank screen on back navigation
  useEffect(() => {
    if (currentView === 'list' || currentView === 'search') {
      // Only animate from 0 when switching to search view
      // For returning from anonymous/channel/create, fade should already be set to 1
      if (currentView === 'search' && fade._value === 0) {
        const timer = setTimeout(() => {
          fade.setValue(0);
          Animated.timing(fade, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }, 50);

        return () => clearTimeout(timer);
      } else if (currentView === 'list') {
        // Ensure immediate display when returning to list view
        fade.setValue(1);
      }
    }
  }, [currentView, fade]);

  // Filter categories
  const filterCategories = ['すべて', '育児', '相談', '月齢', '地域', '趣味'];

  // Handle search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      doSearch({
        query: searchQuery.trim(),
        limit: 20,
      });
      setCurrentView('search');
    }
  };

  // Handle join space
  const handleJoinSpace = async (space: SpaceWithOwner) => {
    if (!space.can_join) {
      Alert.alert('参加できません', 'このルームは満員かすでに参加済みです');
      return;
    }

    const result = await joinSpace(space.id);
    if (result) {
      Alert.alert('参加完了', `${space.name}に参加しました`);
      // Refresh popular spaces to update join status
      refreshPopular();
      setCurrentView('list');
    } else if (operationError) {
      Alert.alert('エラー', operationError);
    }
  };

  // Handle channel selection
  const handleChannelSelect = (
    channelId: string,
    spaceName: string,
    spaceId?: string
  ) => {
    setSelectedChannelId(channelId);
    setSelectedSpaceName(spaceName);
    setSelectedSpaceId(spaceId || '');
    if (onNavigateToChannel) {
      onNavigateToChannel(channelId, spaceName);
    } else {
      setCurrentView('channel');
    }
  };

  // Render different views
  if (currentView === 'anonymous') {
    return (
      <AnonRoomScreen
        onBack={() => {
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
        spaceId={selectedSpaceId || undefined}
        isPrivateSpace={true} // Temporarily always show invite button for testing
        onBack={() => {
          // Ensure immediate display when returning to prevent blank screen
          fade.setValue(1);
          setCurrentView('list');
        }}
        onExit={() => {
          // Handle exit - refresh popular spaces and return to list view
          refreshPopular();
          fade.setValue(1);
          setCurrentView('list');
        }}
        onInvite={() => {
          // Navigate to invite screen
          setCurrentView('invite');
        }}
        onNavigateToChat={(chatId: string, userName: string) => {
          setActiveChatId(chatId);
          setActiveChatUserName(userName);
          setCurrentView('directChat');
        }}
      />
    );
  }

  if (currentView === 'create') {
    return (
      <CreateSpaceScreen
        onSuccess={() => {
          fade.setValue(1);
          setCurrentView('list');
          refreshPopular();
        }}
        onCancel={() => {
          fade.setValue(1);
          setCurrentView('list');
        }}
      />
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
      />
    );
  }

  // Filter popular spaces based on selected filter
  const filteredPopularSpaces = popularSpaces.filter(space => {
    if (selectedFilter === 'すべて') return true;
    return (
      space.name.includes(selectedFilter) ||
      space.description?.includes(selectedFilter) ||
      space.tags.some(tag => tag.includes(selectedFilter))
    );
  });

  // Render space search results
  const renderSearchResults = () => (
    <View style={{ flex: 1, backgroundColor: colors.bg || '#000000' }}>
      {/* Search Header */}
      <View
        style={{
          paddingHorizontal: theme.spacing(2),
          paddingTop: 48,
          paddingBottom: 16,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Pressable
            onPress={() => {
              setCurrentView('list');
              clearResults();
              setSearchQuery('');
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>←</Text>
          </Pressable>
          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: 'bold',
              marginLeft: 16,
            }}
          >
            検索結果
          </Text>
        </View>

        {searchQuery && (
          <Text
            style={{ color: colors.subtext, fontSize: 14, marginBottom: 8 }}
          >
            「{searchQuery}」の検索結果 ({searchSpaces.length}件)
          </Text>
        )}
      </View>

      {/* Search Results */}
      <FlatList
        data={searchSpaces}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 0 }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(1.5) }} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleJoinSpace(item)}
            disabled={operationLoading}
            style={({ pressed }) => [
              {
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.shadow.card,
                opacity: operationLoading ? 0.6 : 1,
              },
            ]}
          >
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                padding: theme.spacing(1.75),
                backgroundColor: '#ffffff10',
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
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: 'bold',
                      marginBottom: 4,
                    }}
                  >
                    {item.name}
                  </Text>
                  {item.description && (
                    <Text
                      style={{
                        color: colors.subtext,
                        fontSize: 14,
                        marginBottom: 8,
                      }}
                    >
                      {item.description}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      {item.member_count}/{item.max_members}人
                    </Text>
                    <Text
                      style={{
                        color: colors.subtext,
                        fontSize: 12,
                        marginLeft: 8,
                      }}
                    >
                      by {item.owner.display_name || item.owner.username}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: item.can_join
                      ? colors.pinkSoft
                      : colors.subtext + '40',
                    borderRadius: theme.radius.sm,
                    paddingHorizontal: theme.spacing(1.25),
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      color: item.can_join ? '#302126' : colors.subtext,
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}
                  >
                    {item.can_join ? '参加' : '満員'}
                  </Text>
                </View>
              </View>

              {item.tags.length > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    marginTop: 8,
                  }}
                >
                  {item.tags.slice(0, 3).map((tag, index) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: colors.subtext + '20',
                        borderRadius: theme.radius.sm,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        marginRight: 4,
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ color: colors.subtext, fontSize: 10 }}>
                        #{tag}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </BlurView>
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: colors.subtext, fontSize: 16 }}>
              {searchLoading ? '検索中...' : '検索結果がありません'}
            </Text>
          </View>
        )}
      />
    </View>
  );

  // Render main room list
  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: colors.bg || '#000000',
        paddingTop: 48,
        opacity: fade,
      }}
    >
      {currentView === 'search' ? (
        renderSearchResults()
      ) : currentView === 'list' ? (
        <>
          {/* Header with search */}
          <View
            style={{ paddingHorizontal: theme.spacing(2), marginBottom: 16 }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <View style={{ flex: 1, borderRadius: 999, overflow: 'hidden' }}>
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{ backgroundColor: '#ffffff10' }}
                >
                  <TextInput
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                    }}
                    placeholder="ルームを検索..."
                    placeholderTextColor={colors.subtext}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                </BlurView>
              </View>

              <Pressable
                onPress={() => setCurrentView('create')}
                style={({ pressed }) => [
                  {
                    marginLeft: 12,
                    backgroundColor: colors.pinkSoft,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <Text
                  style={{ color: '#302126', fontSize: 14, fontWeight: 'bold' }}
                >
                  作成
                </Text>
              </Pressable>
            </View>

            {/* Filter tabs */}
            <View style={{ borderRadius: 999, overflow: 'hidden' }}>
              <BlurView
                intensity={30}
                tint="dark"
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  backgroundColor: '#ffffff10',
                }}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {filterCategories.map(category => (
                    <View key={category} style={{ marginRight: 8 }}>
                      <Pressable
                        onPress={() => setSelectedFilter(category)}
                        style={({ pressed }) => [
                          {
                            backgroundColor:
                              selectedFilter === category
                                ? '#ffffff24'
                                : '#ffffff12',
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontSize: 12 }}>
                          {category}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </BlurView>
            </View>
          </View>

          {/* Popular Rooms Header */}
          <View
            style={{ paddingHorizontal: theme.spacing(2), marginBottom: 16 }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 20,
                fontWeight: 'bold',
                marginBottom: 8,
              }}
            >
              人気ルーム
            </Text>
            <Text style={{ color: colors.subtext, fontSize: 14 }}>
              参加人数が多い順で表示しています
            </Text>
          </View>

          {/* Popular Rooms List */}
          <FlatList
            data={filteredPopularSpaces}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 8 }}
            ItemSeparatorComponent={() => (
              <View style={{ height: theme.spacing(1.5) }} />
            )}
            refreshControl={
              <RefreshControl
                refreshing={popularLoading}
                onRefresh={refreshPopular}
                tintColor={colors.text}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleJoinSpace(item)}
                disabled={operationLoading}
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
                    backgroundColor: '#ffffff10',
                    opacity: operationLoading ? 0.6 : 1,
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
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 16,
                          fontWeight: 'bold',
                          marginBottom: 4,
                        }}
                      >
                        {item.name}
                      </Text>
                      {item.description && (
                        <Text
                          style={{
                            color: colors.subtext,
                            fontSize: 14,
                            marginBottom: 8,
                          }}
                          numberOfLines={2}
                        >
                          {item.description}
                        </Text>
                      )}
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={{ color: colors.subtext, fontSize: 12 }}>
                          {item.member_count}/{item.max_members}人
                        </Text>
                        <Text
                          style={{
                            color: colors.subtext,
                            fontSize: 12,
                            marginLeft: 8,
                          }}
                        >
                          by {item.owner.display_name || item.owner.username}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        backgroundColor: item.can_join
                          ? colors.pinkSoft
                          : colors.subtext + '40',
                        borderRadius: theme.radius.sm,
                        paddingHorizontal: theme.spacing(1.25),
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: item.can_join ? '#302126' : colors.subtext,
                          fontSize: 12,
                          fontWeight: 'bold',
                        }}
                      >
                        {item.can_join ? '参加' : '満員'}
                      </Text>
                    </View>
                  </View>

                  {item.tags.length > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        marginTop: 8,
                      }}
                    >
                      {item.tags.slice(0, 3).map((tag, index) => (
                        <View
                          key={index}
                          style={{
                            backgroundColor: colors.subtext + '20',
                            borderRadius: theme.radius.sm,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            marginRight: 4,
                            marginBottom: 4,
                          }}
                        >
                          <Text style={{ color: colors.subtext, fontSize: 10 }}>
                            #{tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
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
                  {popularLoading
                    ? '人気ルームを読み込み中...'
                    : '人気ルームがありません'}
                </Text>
                {!popularLoading && (
                  <Text
                    style={{
                      color: colors.subtext,
                      fontSize: 14,
                      textAlign: 'center',
                    }}
                  >
                    検索で新しいルームを見つけて参加してみましょう
                  </Text>
                )}
              </View>
            )}
          />
        </>
      ) : null}
    </Animated.View>
  );
}
