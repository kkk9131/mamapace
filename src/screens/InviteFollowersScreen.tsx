/**
 * INVITE FOLLOWERS SCREEN
 *
 * Screen for selecting followers to invite to a private room
 * Implements follower selection with checkboxes and invite sending functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  Alert,
} from 'react-native';
import { useTheme } from '../theme/theme';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { BlurView } from 'expo-blur';
import { getFollowList } from '../services/profileService';
import { PublicUserProfile } from '../types/auth';
import { useAuth } from '../contexts/AuthContext';
import { secureLogger } from '../utils/privacyProtection';
import { chatService } from '../services/chatService';
import Avatar from '../components/Avatar';

interface InviteFollowersScreenProps {
  spaceName: string;
  spaceId: string;
  onBack: () => void;
  onInviteSent?: (selectedUsers: PublicUserProfile[], spaceName: string) => void;
}

interface FollowerWithSelection extends PublicUserProfile {
  selected: boolean;
}

export default function InviteFollowersScreen({
  spaceName,
  spaceId,
  onBack,
  onInviteSent,
}: InviteFollowersScreenProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { handPreference } = useHandPreference();
  const { user } = useAuth();

  // State
  const [followers, setFollowers] = useState<FollowerWithSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Refs
  const fadeAnim = useRef(new Animated.Value(1)).current; // Start visible to prevent flash

  // Load followers on mount
  useEffect(() => {
    loadFollowers();
  }, []);

  const loadFollowers = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const followerList = await getFollowList(user.id, 'followers');
      setFollowers(
        followerList.map(follower => ({
          ...follower,
          selected: false,
        }))
      );
    } catch (error) {
      secureLogger.error('Failed to load followers:', error);
      Alert.alert('エラー', 'フォロワー一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // Toggle follower selection
  const toggleFollowerSelection = (userId: string) => {
    setFollowers(prev =>
      prev.map(follower =>
        follower.id === userId
          ? { ...follower, selected: !follower.selected }
          : follower
      )
    );
  };

  // Get selected followers
  const selectedFollowers = followers.filter(f => f.selected);
  const selectedCount = selectedFollowers.length;

  // Handle invite sending
  const handleSendInvites = async () => {
    if (selectedCount === 0) {
      Alert.alert('選択エラー', '招待するフォロワーを選択してください');
      return;
    }

    Alert.alert(
      '招待送信',
      `${selectedCount}人のフォロワーに「${spaceName}」への招待を送信しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '送信',
          onPress: async () => {
            try {
              setSending(true);
              
              // Get user's display name for invitation message
              const currentUserName = user?.user_metadata?.display_name || user?.email || 'ユーザー';
              
              // Send invitation messages via chat service
              const result = await chatService.sendInvitationMessage({
                userIds: selectedFollowers.map(f => f.id),
                spaceName,
                spaceId,
                inviterName: currentUserName,
              });
              
              if (result.success) {
                const { successful, failed } = result.data;
                const successCount = successful.length;
                const failCount = failed.length;
                
                if (failCount === 0) {
                  Alert.alert('送信完了', `${successCount}人に招待を送信しました`);
                } else {
                  Alert.alert(
                    '一部送信完了', 
                    `${successCount}人に招待を送信しました。${failCount}人への送信に失敗しました。`
                  );
                }
                
                // Call the callback with selected users
                if (onInviteSent) {
                  onInviteSent(selectedFollowers, spaceName);
                }
                
                // Return to previous screen
                onBack();
              } else {
                Alert.alert('エラー', result.error || '招待の送信に失敗しました');
              }
            } catch (error) {
              secureLogger.error('Failed to send invites:', error);
              Alert.alert('エラー', '招待の送信に失敗しました');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  // Render follower item
  const renderFollowerItem = ({ item }: { item: FollowerWithSelection }) => {
    return (
      <Pressable
        onPress={() => toggleFollowerSelection(item.id)}
        style={({ pressed }) => [
          {
            transform: [{ scale: pressed ? 0.98 : 1 }],
            marginHorizontal: theme.spacing(2),
            marginVertical: theme.spacing(0.5),
          },
        ]}
      >
        <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
          <BlurView
            intensity={30}
            tint="dark"
            style={{
              backgroundColor: item.selected ? '#ffffff20' : '#ffffff10',
              padding: theme.spacing(1.75),
              borderWidth: item.selected ? 1 : 0,
              borderColor: item.selected ? colors.pink : 'transparent',
            }}
          >
            <View
              style={{
                flexDirection: handPreference === 'left' ? 'row' : 'row',
                alignItems: 'center',
              }}
            >
              {/* Checkbox */}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: item.selected ? colors.pink : 'transparent',
                  borderWidth: 2,
                  borderColor: item.selected ? colors.pink : colors.subtext,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                {item.selected && (
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                    ✓
                  </Text>
                )}
              </View>

              {/* Avatar */}
              <Avatar uri={(item as any).avatar_url} emoji={item.avatar_emoji || '👤'} size={48} style={{ marginRight: 12 }} />

              {/* User info */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                  }}
                >
                  {item.display_name}
                </Text>
                <Text style={{ color: colors.subtext, fontSize: 14 }}>
                  @{item.username}
                </Text>
                {item.bio && (
                  <Text
                    style={{
                      color: colors.subtext,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                    numberOfLines={1}
                  >
                    {item.bio}
                  </Text>
                )}
              </View>
            </View>
          </BlurView>
        </View>
      </Pressable>
    );
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: colors.bg || '#000000',
        opacity: fadeAnim,
      }}
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
            flexDirection: handPreference === 'left' ? 'row' : 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={onBack}
            style={{
              ...(handPreference === 'left' ? { marginRight: 12 } : { marginLeft: 12 }),
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>
              {handPreference === 'left' ? '←' : '→'}
            </Text>
          </Pressable>
          
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              フォロワーを招待
            </Text>
            <Text
              style={{
                color: colors.subtext,
                fontSize: 14,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              ルーム「{spaceName}」に招待
            </Text>
          </View>

          {/* Placeholder for balance */}
          <View style={{ width: 16 }} />
        </View>
      </View>

      {/* Followers List */}
      <FlatList
        data={followers}
        keyExtractor={item => item.id}
        renderItem={renderFollowerItem}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 60,
              paddingHorizontal: theme.spacing(4),
            }}
          >
            <Text style={{ color: colors.subtext, fontSize: 16, textAlign: 'center' }}>
              {loading
                ? 'フォロワーを読み込み中...'
                : 'フォロワーがいません'}
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
                フォロワーがいる場合のみ招待機能が利用できます
              </Text>
            )}
          </View>
        )}
      />

      {/* Bottom Action Panel */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: theme.spacing(2),
          paddingVertical: theme.spacing(2),
          paddingBottom: 90, // Account for tab bar
        }}
      >
        <View
          style={{
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
          }}
        >
          <BlurView
            intensity={40}
            tint="dark"
            style={{
              backgroundColor: '#ffffff15',
              padding: theme.spacing(2),
            }}
          >
            {/* Selection count */}
            <Text
              style={{
                color: colors.text,
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
                marginBottom: theme.spacing(1.5),
              }}
            >
              {selectedCount > 0 ? `${selectedCount}人選択中` : '招待する人を選択してください'}
            </Text>

            {/* Action buttons */}
            <View style={{ flexDirection: 'column', gap: theme.spacing(1) }}>
              {/* Debug: Reset invitations button */}
              {__DEV__ && (
                <Pressable
                  onPress={async () => {
                    Alert.alert('開発機能', 'テスト用に招待状態をリセットしますか？', [
                      { text: 'キャンセル', style: 'cancel' },
                      {
                        text: 'リセット',
                        onPress: async () => {
                          try {
                            // This is just a visual reset for testing
                            Alert.alert('リセット完了', '招待を再送信できます（開発モード）');
                          } catch (error) {
                            Alert.alert('エラー', 'リセットに失敗しました');
                          }
                        },
                      },
                    ]);
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: '#FF6B35',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: theme.radius.md,
                      alignItems: 'center',
                      opacity: pressed ? 0.7 : 1,
                      marginBottom: theme.spacing(1),
                    },
                  ]}
                >
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
                    🔧 招待状態リセット（開発用）
                  </Text>
                </Pressable>
              )}
              
              <View style={{ flexDirection: 'row', gap: theme.spacing(1) }}>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.subtext + '40',
                    borderRadius: theme.radius.md,
                    paddingVertical: theme.spacing(1.5),
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                >
                  キャンセル
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSendInvites}
                disabled={selectedCount === 0 || sending}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor:
                      selectedCount === 0 || sending
                        ? colors.subtext + '40'
                        : colors.pink,
                    borderRadius: theme.radius.md,
                    paddingVertical: theme.spacing(1.5),
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selectedCount === 0 || sending ? colors.subtext : 'white',
                    fontSize: 16,
                    fontWeight: '700',
                  }}
                >
                  {sending ? '送信中...' : '招待送信'}
                </Text>
              </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      </View>
    </Animated.View>
  );
}
