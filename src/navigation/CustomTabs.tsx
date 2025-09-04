import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import Sidebar from './Sidebar';
import RoomsScreen from '../screens/RoomsScreen';
import ChatsListScreen from '../screens/ChatsListScreen';
import ChatScreen from '../screens/ChatScreen';
import { Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import AuthGuard from '../components/AuthGuard';

import ComposeScreen from '../screens/ComposeScreen';
import SettingsScreen from '../screens/SettingsScreen';
// import AnonFeedScreen from '../screens/AnonFeedScreen'; // Removed - now handled within RoomsScreen
import RoomsListScreen from '../screens/RoomsListScreen';
import CommentComposeScreen from '../screens/CommentComposeScreen';
import CommentsListScreen from '../screens/CommentsListScreen';
import FollowersListScreen from '../screens/FollowersListScreen';
import FollowingListScreen from '../screens/FollowingListScreen';
import LikedPostsListScreen from '../screens/LikedPostsListScreen';
import MyPostsListScreen from '../screens/MyPostsListScreen';
import LoginScreen from '../screens/LoginScreen';
// import SearchScreen from '../screens/SearchScreen'; // Removed - now handled within RoomsScreen
import SignUpScreen from '../screens/SignUpScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChannelScreen from '../screens/ChannelScreen';
import CreateSpaceScreen from '../screens/CreateSpaceScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type TabKey =
  | 'me' | 'noti' | 'home' | 'rooms'
  | 'compose' | 'anon' | 'chat' | 'settings'
  | 'roomsList' | 'comment' | 'comments'
  | 'followers' | 'following' | 'liked' | 'myPosts'
  | 'profileEdit' | 'userProfile';

const tabs = [
  { key: 'me', label: 'あなた', Component: ProfileScreen },
  { key: 'noti', label: '通知', Component: NotificationsScreen },
  { key: 'home', label: 'ホーム', Component: HomeScreen },
  { key: 'rooms', label: 'ルーム', Component: RoomsScreen },
] as const;

const Hidden = { compose: ComposeScreen } as const;

function IconTab({
  icon,
  iconOutline,
  active,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const scale = new Animated.Value(1);
  const pulse = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.9,
        useNativeDriver: true,
        speed: 16,
        bounciness: 10,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 16,
        bounciness: 10,
      }),
    ]).start();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={async () => {
        pulse();
        await Haptics.selectionAsync();
        onPress();
      }}
      onLongPress={onLongPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 56 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={active ? icon : iconOutline}
          size={26}
          color={active ? colors.pink : colors.subtext}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function CustomTabs({ navigateTo, onNavigateConsumed }: { navigateTo?: string | null; onNavigateConsumed?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { handPreference } = useHandPreference();
  const [active, setActive] = useState<TabKey>('home');
  const [roomsListKey, setRoomsListKey] = useState<number>(0);

  useEffect(() => {
    if (active === 'roomsList') {
      setRoomsListKey(k => k + 1);
    }
  }, [active]);

  // React to external navigation requests (e.g., notification tap)
  useEffect(() => {
    if (!navigateTo) return;
    try {
      let parsed: any = undefined;
      try { parsed = JSON.parse(navigateTo); } catch {}
      if (parsed && parsed.screen) {
        const s = String(parsed.screen);
        if (s === 'chat' && parsed.chat_id) {
          setActiveChatId(String(parsed.chat_id));
          setActive('chat' as any);
        } else if (s === 'comments' && parsed.post_id) {
          setActivePostId(String(parsed.post_id));
          setActive('comments' as any);
        } else if (s === 'userProfile' && parsed.user_id) {
          setActiveUserId(String(parsed.user_id));
          setActive('userProfile' as any);
        } else if (s === 'rooms') {
          setActive('rooms' as any);
        } else {
          setActive(s as any);
        }
      } else {
        // Simple tab name
        setActive(navigateTo as any);
      }
    } finally {
      onNavigateConsumed && onNavigateConsumed();
    }
  }, [navigateTo, onNavigateConsumed]);
  const [homeRefreshKey, setHomeRefreshKey] = useState<number>(0);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatUserName, setActiveChatUserName] = useState<string | null>(
    null
  );
  const [chatReturnTo, setChatReturnTo] = useState<string>('chats'); // Track where to return from chat
  const [commentsRefreshKey, setCommentsRefreshKey] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Authentication flow - show login/signup screens when not authenticated
  if (!isLoading && !isAuthenticated) {
    if (active === 'signup') {
      return <SignUpScreen onLogin={() => setActive('login' as any)} />;
    } else {
      return <LoginScreen onSignup={() => setActive('signup' as any)} />;
    }
  }

  // Handle compose screen (no auth guard needed as it's already protected by the above check)
  if (active === 'compose')
    return (
      <ComposeScreen
        onPosted={() => {
          setActive('home' as any);
          setHomeRefreshKey((k: number) => k + 1);
        }}
        onClose={() => setActive('home' as any)}
      />
    );

  return (
    <AuthGuard>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNavigate={key => {
            setActive(key as any);
            setSidebarOpen(false);
          }}
        />
        <View style={{ flex: 1 }}>
          {active === 'home' ? (
            <HomeScreen
              refreshKey={homeRefreshKey}
              onCompose={() => setActive('compose' as any)}
              onOpenPost={postId => {
                setActivePostId(postId);
                setActive('comments' as any);
              }}
              onOpenProfileEdit={() => setActive('profileEdit' as any)}
              onOpenUser={userId => {
                setActiveUserId(userId);
                setActive('userProfile' as any);
              }}
            />
          ) : active === 'search' ? (
            // Redirect to home if search is accessed directly
            (() => {
              setActive('home');
              return (
                <HomeScreen
                  refreshKey={homeRefreshKey}
                  onCompose={() => setActive('compose' as any)}
                  onOpenPost={postId => {
                    setActivePostId(postId);
                    setActive('comments' as any);
                  }}
                  onOpenProfileEdit={() => setActive('profileEdit' as any)}
                  onOpenUser={userId => {
                    setActiveUserId(userId);
                    setActive('userProfile' as any);
                  }}
                />
              );
            })()
          ) : active === 'rooms' ? (
            <RoomsScreen />
          ) : active === 'createRoom' ? (
            <CreateSpaceScreen
              onSuccess={() => {
                setActive('rooms' as any);
              }}
              onCancel={() => setActive('rooms' as any)}
            />
          ) : active === 'chats' ? (
            <ChatsListScreen
              onOpen={(chatId: string, userName: string) => {
                setActiveChatId(chatId);
                setActiveChatUserName(userName);
                setChatReturnTo('chats');
                setActive('chat' as any);
              }}
            />
          ) : active === 'anon' ? (
            // Redirect to home if anon is accessed directly
            (() => {
              setActive('home');
              return (
                <HomeScreen
                  refreshKey={homeRefreshKey}
                  onCompose={() => setActive('compose' as any)}
                  onOpenPost={postId => {
                    setActivePostId(postId);
                    setActive('comments' as any);
                  }}
                  onOpenProfileEdit={() => setActive('profileEdit' as any)}
                  onOpenUser={userId => {
                    setActiveUserId(userId);
                    setActive('userProfile' as any);
                  }}
                />
              );
            })()
          ) : active === 'chat' ? (
            activeChatId ? (
              <ChatScreen
                chatId={activeChatId}
                userName={activeChatUserName || 'ユーザー'}
                onBack={() => {
                  setActiveChatId(null);
                  setActiveChatUserName(null);
                  setActive(chatReturnTo as any);
                }}
                onNavigateToUser={(userId: string) => {
                  setActiveUserId(userId);
                  setActive('userProfile' as any);
                }}
              />
            ) : (
              <ChatsListScreen
                onOpen={(chatId: string, userName: string) => {
                  setActiveChatId(chatId);
                  setActiveChatUserName(userName);
                  setChatReturnTo('chats');
                  setActive('chat' as any);
                }}
              />
            )
          ) : active === 'noti' ? (
            <NotificationsScreen />
          ) : active === 'settings' ? (
            <SettingsScreen
              onLogoutNavigate={() => {
                // Logout will be handled by AuthContext, which will trigger re-render
                // and show login screen due to !isAuthenticated check above
              }}
            />
          ) : active === 'roomsList' ? (
            <RoomsListScreen refreshKey={roomsListKey} onBack={() => setActive('me' as any)} />
          ) : active === 'comment' ? (
            activePostId ? (
              <CommentComposeScreen
                postId={activePostId}
                onPosted={() => {
                  setActive('comments' as any);
                  setCommentsRefreshKey((k: number) => k + 1);
                }}
                onClose={() => setActive('comments' as any)}
              />
            ) : null
          ) : active === 'comments' ? (
            activePostId ? (
              <CommentsListScreen
                refreshKey={commentsRefreshKey}
                postId={activePostId}
                onCompose={() => setActive('comment' as any)}
                onOpenUser={(userId: string) => {
                  setActiveUserId(userId);
                  setActive('userProfile' as any);
                }}
              />
            ) : null
          ) : active === 'followers' ? (
            <FollowersListScreen
              onNavigateToChat={(chatId: string, userName: string) => {
                setActiveChatId(chatId);
                setActiveChatUserName(userName);
                setChatReturnTo('followers');
                setActive('chat' as any);
              }}
              onOpenUser={(userId: string) => {
                setActiveUserId(userId);
                setActive('userProfile' as any);
              }}
            />
          ) : active === 'following' ? (
            <FollowingListScreen
              onNavigateToChat={(chatId: string, userName: string) => {
                setActiveChatId(chatId);
                setActiveChatUserName(userName);
                setChatReturnTo('following');
                setActive('chat' as any);
              }}
              onOpenUser={(userId: string) => {
                setActiveUserId(userId);
                setActive('userProfile' as any);
              }}
            />
          ) : active === 'liked' ? (
            <LikedPostsListScreen
              onOpen={postId => {
                setActivePostId(postId);
                setActive('comments' as any);
              }}
            />
          ) : active === 'myPosts' ? (
            <MyPostsListScreen />
          ) : active === 'profileEdit' ? (
            <ProfileEditScreen
              navigation={{ goBack: () => setActive('me' as any) }}
            />
          ) : active === 'userProfile' ? (
            activeUserId ? (
              <UserProfileScreen
                userId={activeUserId}
                onBack={() => {
                  setActiveUserId(null);
                  setActive('home' as any);
                }}
                onNavigateToChat={(chatId: string, userName: string) => {
                  setActiveChatId(chatId);
                  setActiveChatUserName(userName);
                  setChatReturnTo('userProfile');
                  setActive('chat' as any);
                }}
              />
            ) : null
          ) : (
            <ProfileScreen
              onNavigate={(key: string) => setActive(key as TabKey)}
            />
          )}
        </View>
        {/* Hide tab bar when in chat mode */}
        {active !== 'chat' && (
          <View
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: Math.max(8, insets.bottom ? 4 : 8),
              height: 56 + (insets.bottom || 0),
              borderRadius: 16,
              flexDirection: 'row',
              backgroundColor: colors.cardAlpha,
              borderColor: colors.border,
              borderWidth: 1,
              overflow: 'hidden',
              paddingBottom: insets.bottom || 0,
            }}
          >
            {(['me', 'noti', 'home'] as const).map(k => (
              <IconTab
                key={k}
                icon={k === 'me' ? 'person' : k === 'noti' ? 'notifications' : 'home'}
                iconOutline={k === 'me' ? 'person-outline' : k === 'noti' ? 'notifications-outline' : 'home-outline'}
                accessibilityLabel={k === 'me' ? 'あなた' : k === 'noti' ? '通知' : 'ホーム'}
                active={active === k}
                onPress={() => setActive(k as any)}
                onLongPress={
                  (handPreference === 'right' && k === 'home') ||
                  (handPreference === 'left' && k === 'me')
                    ? () => setSidebarOpen(true)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </View>
    </AuthGuard>
  );
}
