import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, Animated, ScrollView, TextInput, Alert, RefreshControl } from 'react-native';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';
import { useSpaceSearch, useSpaceOperations, useSpacePermissions, useChatList } from '../hooks/useRooms';
import { SpaceWithOwner, ChatListItem } from '../types/room';
import AnonRoomScreen from './AnonRoomScreen';
import ChannelScreen from './ChannelScreen';
import CreateSpaceScreen from './CreateSpaceScreen';

interface RoomsScreenProps {
  onNavigateToChannel?: (channelId: string, spaceName: string) => void;
}

export default function RoomsScreen({ onNavigateToChannel }: RoomsScreenProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  
  // State management
  const [currentView, setCurrentView] = useState<'list' | 'search' | 'anonymous' | 'channel' | 'create'>('list');
  const [selectedFilter, setSelectedFilter] = useState<string>('すべて');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
  
  // Hooks
  const { spaces, loading: searchLoading, error: searchError, searchSpaces, clearResults } = useSpaceSearch();
  const { loading: operationLoading, error: operationError, joinSpace } = useSpaceOperations();
  const { canCreateSpaces } = useSpacePermissions();
  const { chatList, loading: chatLoading, refresh: refreshChatList } = useChatList();

  // Animation
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  // Filter categories
  const filterCategories = ['すべて', '育児', '相談', '月齢', '地域', '趣味'];

  // Handle search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchSpaces({ 
        query: searchQuery.trim(),
        limit: 20
      });
      setCurrentView('search');
    }
  };

  // Handle join space
  const handleJoinSpace = async (space: SpaceWithOwner) => {
    if (!space.can_join) {
      Alert.alert('参加できません', 'このスペースは満員かすでに参加済みです');
      return;
    }

    const result = await joinSpace(space.id);
    if (result) {
      Alert.alert('参加完了', `${space.name}に参加しました`);
      // Refresh chat list to show new space
      refreshChatList();
      setCurrentView('list');
    } else if (operationError) {
      Alert.alert('エラー', operationError);
    }
  };

  // Handle channel selection
  const handleChannelSelect = (channelId: string, spaceName: string) => {
    setSelectedChannelId(channelId);
    setSelectedSpaceName(spaceName);
    if (onNavigateToChannel) {
      onNavigateToChannel(channelId, spaceName);
    } else {
      setCurrentView('channel');
    }
  };

  // Render different views
  if (currentView === 'anonymous') {
    return <AnonRoomScreen onBack={() => setCurrentView('list')} />;
  }

  if (currentView === 'channel' && selectedChannelId) {
    return (
      <ChannelScreen 
        channelId={selectedChannelId}
        spaceName={selectedSpaceName}
        onBack={() => setCurrentView('list')}
      />
    );
  }

  if (currentView === 'create') {
    return (
      <CreateSpaceScreen
        onSuccess={() => {
          setCurrentView('list');
          refreshChatList();
        }}
        onCancel={() => setCurrentView('list')}
      />
    );
  }

  // Filter chat list based on selected filter
  const filteredChatList = chatList.filter(item => {
    if (selectedFilter === 'すべて') return true;
    return item.space_name.includes(selectedFilter) || 
           item.channel_name.includes(selectedFilter);
  });

  // Render space search results
  const renderSearchResults = () => (
    <View style={{ flex: 1 }}>
      {/* Search Header */}
      <View style={{ paddingHorizontal: theme.spacing(2), paddingTop: 48, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Pressable onPress={() => { setCurrentView('list'); clearResults(); setSearchQuery(''); }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>← 戻る</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginLeft: 16 }}>
            検索結果
          </Text>
        </View>
        
        {searchQuery && (
          <Text style={{ color: colors.subtext, fontSize: 14, marginBottom: 8 }}>
            「{searchQuery}」の検索結果 ({spaces.length}件)
          </Text>
        )}
      </View>

      {/* Search Results */}
      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 0 }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
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
                opacity: operationLoading ? 0.6 : 1
              }
            ]}
          >
            <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.75), backgroundColor: '#ffffff10' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>
                    {item.name}
                  </Text>
                  {item.description && (
                    <Text style={{ color: colors.subtext, fontSize: 14, marginBottom: 8 }}>
                      {item.description}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      {item.member_count}/{item.max_members}人
                    </Text>
                    <Text style={{ color: colors.subtext, fontSize: 12, marginLeft: 8 }}>
                      by {item.owner_display_name || item.owner_username}
                    </Text>
                  </View>
                </View>
                
                <View style={{ 
                  backgroundColor: item.can_join ? colors.pinkSoft : colors.subtext + '40', 
                  borderRadius: theme.radius.sm, 
                  paddingHorizontal: theme.spacing(1.25), 
                  paddingVertical: 4 
                }}>
                  <Text style={{ 
                    color: item.can_join ? '#302126' : colors.subtext, 
                    fontSize: 12, 
                    fontWeight: 'bold' 
                  }}>
                    {item.can_join ? '参加' : '満員'}
                  </Text>
                </View>
              </View>
              
              {item.tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  {item.tags.slice(0, 3).map((tag, index) => (
                    <View 
                      key={index}
                      style={{ 
                        backgroundColor: colors.subtext + '20', 
                        borderRadius: theme.radius.sm, 
                        paddingHorizontal: 8, 
                        paddingVertical: 2, 
                        marginRight: 4,
                        marginBottom: 4
                      }}
                    >
                      <Text style={{ color: colors.subtext, fontSize: 10 }}>#{tag}</Text>
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
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: 48, opacity: fade }}>
      {currentView === 'search' ? renderSearchResults() : (
        <>
          {/* Header with search */}
          <View style={{ paddingHorizontal: theme.spacing(2), marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flex: 1, borderRadius: 999, overflow: 'hidden' }}>
                <BlurView intensity={30} tint="dark" style={{ backgroundColor: '#ffffff10' }}>
                  <TextInput
                    style={{ 
                      color: colors.text, 
                      fontSize: 16, 
                      paddingVertical: 12, 
                      paddingHorizontal: 16 
                    }}
                    placeholder="スペースを検索..."
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
                    transform: [{ scale: pressed ? 0.95 : 1 }]
                  }
                ]}
              >
                <Text style={{ color: '#302126', fontSize: 14, fontWeight: 'bold' }}>作成</Text>
              </Pressable>
            </View>

            {/* Filter tabs */}
            <View style={{ borderRadius: 999, overflow: 'hidden' }}>
              <BlurView intensity={30} tint="dark" style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#ffffff10' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {filterCategories.map((category) => (
                    <View key={category} style={{ marginRight: 8 }}>
                      <Pressable 
                        onPress={() => setSelectedFilter(category)} 
                        style={({ pressed }) => [{ 
                          backgroundColor: selectedFilter === category ? '#ffffff24' : '#ffffff12', 
                          paddingVertical: 6, 
                          paddingHorizontal: 12, 
                          borderRadius: 999, 
                          transform: [{ scale: pressed ? 0.97 : 1 }] 
                        }]}
                      >
                        <Text style={{ color: colors.text, fontSize: 12 }}>{category}</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </BlurView>
            </View>
          </View>

          {/* Content */}
          <FlatList
            data={[
              // Anonymous room (always first)
              { 
                id: 'anonymous', 
                type: 'anonymous' as const,
                name: '愚痴もたまには、、、', 
                desc: '完全匿名・1時間でポストが消えます', 
                badge: '匿名' 
              },
              // User's spaces
              ...filteredChatList.map(item => ({
                id: item.channel_id,
                type: 'channel' as const,
                name: item.space_name,
                desc: item.latest_message_content || 'メッセージがありません',
                badge: item.space_is_public ? '公開' : '非公開',
                has_new: item.has_new,
                unread_count: item.unread_count,
                latest_message_at: item.latest_message_at,
                space_name: item.space_name
              }))
            ]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 8 }}
            ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
            refreshControl={
              <RefreshControl
                refreshing={chatLoading}
                onRefresh={refreshChatList}
                tintColor={colors.text}
              />
            }
            renderItem={({ item }) => (
              <Pressable 
                onPress={() => {
                  if (item.type === 'anonymous') {
                    setCurrentView('anonymous');
                  } else {
                    handleChannelSelect(item.id, item.space_name || item.name);
                  }
                }}
                style={({ pressed }) => [
                  { 
                    borderRadius: theme.radius.lg, 
                    overflow: 'hidden', 
                    transform: [{ scale: pressed ? 0.98 : 1 }], 
                    ...theme.shadow.card 
                  }
                ]}
              >
                <BlurView 
                  intensity={30} 
                  tint="dark" 
                  style={{ 
                    padding: theme.spacing(1.75), 
                    backgroundColor: item.type === 'anonymous' ? '#F6C6D040' : '#ffffff10' 
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: colors.text, fontSize: 16, marginBottom: 6, fontWeight: 'bold' }}>
                          {item.name}
                        </Text>
                        {item.type === 'channel' && item.has_new && (
                          <View style={{ 
                            backgroundColor: colors.pink, 
                            borderRadius: 8, 
                            width: 16, 
                            height: 16, 
                            marginLeft: 8,
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                              {item.unread_count > 9 ? '9+' : item.unread_count}
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <Text style={{ color: colors.subtext, fontSize: 14 }} numberOfLines={2}>
                        {item.desc}
                      </Text>
                      
                      {item.type === 'channel' && item.latest_message_at && (
                        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                          {new Date(item.latest_message_at).toLocaleString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      )}
                    </View>
                    
                    <View style={{ 
                      backgroundColor: colors.pinkSoft, 
                      borderRadius: theme.radius.sm, 
                      paddingHorizontal: theme.spacing(1.25), 
                      paddingVertical: 4 
                    }}>
                      <Text style={{ color: '#302126', fontSize: 12 }}>{item.badge}</Text>
                    </View>
                  </View>
                </BlurView>
              </Pressable>
            )}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: colors.subtext, fontSize: 16, marginBottom: 8 }}>
                  参加しているスペースがありません
                </Text>
                <Text style={{ color: colors.subtext, fontSize: 14, textAlign: 'center' }}>
                  検索でスペースを見つけて参加してみましょう
                </Text>
              </View>
            )}
          />
        </>
      )}
    </Animated.View>
  );
}
