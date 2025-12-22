import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen from '../screens/HomeScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RoomsScreen from '../screens/RoomsScreen';
import ChatsListScreen from '../screens/ChatsListScreen';
import ChatScreen from '../screens/ChatScreen';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import AuthGuard from '../components/AuthGuard';
import ComposeScreen from '../screens/ComposeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BlockedUsersListScreen from '../screens/BlockedUsersListScreen';
// import AnonFeedScreen from '../screens/AnonFeedScreen'; // Removed - now handled within RoomsScreen
import RoomsListScreen from '../screens/RoomsListScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import CommentComposeScreen from '../screens/CommentComposeScreen';
import CommentsListScreen from '../screens/CommentsListScreen';
import FollowersListScreen from '../screens/FollowersListScreen';
import FollowingListScreen from '../screens/FollowingListScreen';
import AIChatBotScreen from '../screens/AIChatBotScreen';
import LikedPostsListScreen from '../screens/LikedPostsListScreen';
import MyPostsListScreen from '../screens/MyPostsListScreen';
import LoginScreen from '../screens/LoginScreen';
import SearchScreen from '../screens/SearchScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChannelScreen from '../screens/ChannelScreen';
import CreateSpaceScreen from '../screens/CreateSpaceScreen';
import AnonRoomV2Screen from '../screens/AnonRoomV2Screen';
import TutorialScreen from '../screens/TutorialScreen';
import OnboardingPrompt from '../components/OnboardingPrompt';
import PaywallScreen from '../screens/PaywallScreen';

import Sidebar from './Sidebar';

import AnimatedScreenWrapper from '../components/AnimatedScreenWrapper';

type TabKey =
  | 'me'
  | 'noti'
  | 'home'
  | 'rooms'
  | 'compose'
  | 'anon'
  | 'chat'
  | 'settings'
  | 'blockedList'
  | 'roomsList'
  | 'comment'
  | 'comments'
  | 'followers'
  | 'following'
  | 'liked'
  | 'myPosts'
  | 'profileEdit'
  | 'userProfile'
  | 'devAnonV2'
  | 'aiChat'
  | 'tutorial'
  | 'search'
  | 'createRoom'
  | 'chats'
  | 'login'
  | 'signup'
  | 'paywall';

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
  accessibilityHint,
  sublabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  sublabel?: string;
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
      accessibilityHint={accessibilityHint}
      onPress={async () => {
        pulse();
        await Haptics.selectionAsync();
        onPress();
      }}
      onLongPress={onLongPress}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 68,
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={active ? icon : iconOutline}
          size={26}
          color={active ? colors.pink : colors.subtext}
        />
      </Animated.View>
      {sublabel ? (
        <Text
          style={{
            color: colors.subtext,
            fontSize: 10,
            marginTop: 4,
          }}
        >
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function CustomTabs({
  navigateTo,
  onNavigateConsumed,
}: {
  navigateTo?: string | null;
  onNavigateConsumed?: () => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { handPreference } = useHandPreference();
  const [showSidebarHint, setShowSidebarHint] = useState(false);
  const [active, setActive] = useState<TabKey>('home');
  const [roomsListKey, setRoomsListKey] = useState<number>(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const ONBOARDING_KEY = 'mamapace_onboarding_completed_v1';

  // Show onboarding once after first successful auth
  useEffect(() => {
    (async () => {
      if (!isLoading && isAuthenticated) {
        try {
          const flag = await AsyncStorage.getItem(ONBOARDING_KEY);
          if (!flag) {
            setShowOnboarding(true);
          }
        } catch { }
      }
    })();
  }, [isLoading, isAuthenticated]);

  // One-time hint for long-press to open sidebar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const flag = await AsyncStorage.getItem('has_seen_sidebar_hint_v1');
        if (!flag && mounted) {
          setShowSidebarHint(true);
          setTimeout(async () => {
            if (!mounted) {
              return;
            }
            setShowSidebarHint(false);
            try {
              await AsyncStorage.setItem('has_seen_sidebar_hint_v1', '1');
            } catch { }
          }, 5000);
        }
      } catch { }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (active === 'roomsList') {
      setRoomsListKey(k => k + 1);
    }
  }, [active]);

  // React to external navigation requests (e.g., notification tap)
  useEffect(() => {
    if (!navigateTo) {
      return;
    }
    try {
      let parsedUnknown: unknown;
      try {
        parsedUnknown = JSON.parse(navigateTo);
      } catch { }
      const parsed = parsedUnknown as
        | {
          screen?: string;
          chat_id?: string;
          post_id?: string;
          user_id?: string;
        }
        | undefined;
      if (parsed && parsed.screen) {
        const s = String(parsed.screen);
        if (s === 'chat' && parsed.chat_id) {
          setActiveChatId(String(parsed.chat_id));
          setActive('chat');
        } else if (s === 'comments' && parsed.post_id) {
          setActivePostId(String(parsed.post_id));
          setActive('comments');
        } else if (s === 'userProfile' && parsed.user_id) {
          setActiveUserId(String(parsed.user_id));
          setActive('userProfile');
        } else if (s === 'rooms') {
          setActive('rooms');
        } else {
          setActive(s as TabKey);
        }
      } else {
        // Simple tab name
        setActive(navigateTo as TabKey);
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
      return <SignUpScreen onLogin={() => setActive('login')} />;
    } else {
      return <LoginScreen onSignup={() => setActive('signup')} />;
    }
  }

  // Handle compose screen (no auth guard needed as it's already protected by the above check)
  if (active === 'compose') {
    return (
      <ComposeScreen
        onPosted={() => {
          setActive('home');
          setHomeRefreshKey((k: number) => k + 1);
        }}
        onClose={() => setActive('home')}
      />
    );
  }

  return (
    <AuthGuard>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <OnboardingPrompt
          visible={showOnboarding}
          onGoProfile={async () => {
            await AsyncStorage.setItem(ONBOARDING_KEY, '1');
            setShowOnboarding(false);
            setActive('profileEdit');
          }}
          onGoTutorial={async () => {
            await AsyncStorage.setItem(ONBOARDING_KEY, '1');
            setShowOnboarding(false);
            setActive('tutorial');
          }}
          onSkip={async () => {
            await AsyncStorage.setItem(ONBOARDING_KEY, '1');
            setShowOnboarding(false);
          }}
        />
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNavigate={key => {
            setActive(key as TabKey);
            setSidebarOpen(false);
          }}
        />
        <View style={{ flex: 1 }}>
          <AnimatedScreenWrapper
            key={active}
            type={
              // Customize animation type based on transition if needed
              // For now, default fade is subtle and nice for tabs
              // Use slide for 'chat' or detail views if desired
              ['loading', 'splash'].includes(active) ? 'none' : 'fade'
            }
          >
            {active === 'home' ? (
              <HomeScreen
                refreshKey={homeRefreshKey}
                onCompose={() => setActive('compose')}
                onOpenPost={postId => {
                  setActivePostId(postId);
                  setActive('comments');
                }}
                onOpenProfileEdit={() => setActive('profileEdit')}
                onOpenUser={userId => {
                  setActiveUserId(userId);
                  setActive('userProfile');
                }}
              />
            ) : active === 'search' ? (
              <SearchScreen
                onOpenUser={userId => {
                  setActiveUserId(userId);
                  setActive('userProfile');
                }}
                onOpenPost={postId => {
                  setActivePostId(postId);
                  setActive('comments');
                }}
              />
            ) : active === 'rooms' ? (
              <ErrorBoundary>
                <RoomsScreen />
              </ErrorBoundary>
            ) : active === 'createRoom' ? (
              <CreateSpaceScreen
                onSuccess={() => {
                  setActive('rooms');
                }}
                onCancel={() => setActive('rooms')}
              />
            ) : active === 'chats' ? (
              <ErrorBoundary>
                <ChatsListScreen
                  onOpen={(chatId: string, userName: string) => {
                    setActiveChatId(chatId);
                    setActiveChatUserName(userName);
                    setChatReturnTo('chats');
                    setActive('chat');
                  }}
                  onOpenFollowers={() => setActive('followers')}
                  onOpenAIChat={() => setActive('aiChat')}
                />
              </ErrorBoundary>
            ) : active === 'anon' ? (
              // Redirect to home if anon is accessed directly
              (() => {
                setActive('home');
                return (
                  <HomeScreen
                    refreshKey={homeRefreshKey}
                    onCompose={() => setActive('compose')}
                    onOpenPost={postId => {
                      setActivePostId(postId);
                      setActive('comments');
                    }}
                    onOpenProfileEdit={() => setActive('profileEdit')}
                    onOpenUser={userId => {
                      setActiveUserId(userId);
                      setActive('userProfile');
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
                    setActive(chatReturnTo as TabKey);
                  }}
                  onNavigateToUser={(userId: string) => {
                    setActiveUserId(userId);
                    setActive('userProfile');
                  }}
                />
              ) : (
                <ChatsListScreen
                  onOpen={(chatId: string, userName: string) => {
                    setActiveChatId(chatId);
                    setActiveChatUserName(userName);
                    setChatReturnTo('chats');
                    setActive('chat');
                  }}
                />
              )
            ) : active === 'devAnonV2' ? (
              __DEV__ ? (
                <AnonRoomV2Screen onCompose={() => setActive('compose')} />
              ) : (
                <HomeScreen />
              )
            ) : active === 'noti' ? (
              <NotificationsScreen />
            ) : active === 'settings' ? (
              <SettingsScreen
                onLogoutNavigate={() => {
                  // Logout will be handled by AuthContext, which will trigger re-render
                  // and show login screen due to !isAuthenticated check above
                }}
                onOpenBlockedUsers={() => setActive('blockedList')}
                onOpenPaywall={() => setActive('paywall')}
              />
            ) : active === 'blockedList' ? (
              <BlockedUsersListScreen
                onBack={() => setActive('settings')}
                onOpenUser={(userId: string) => {
                  setActiveUserId(userId);
                  setActive('userProfile');
                }}
              />
            ) : active === 'paywall' ? (
              <PaywallScreen onClose={() => setActive('settings')} />
            ) : active === 'roomsList' ? (
              <ErrorBoundary>
                <RoomsListScreen
                  refreshKey={roomsListKey}
                  onBack={() => setActive('me')}
                />
              </ErrorBoundary>
            ) : active === 'comment' ? (
              activePostId ? (
                <CommentComposeScreen
                  postId={activePostId}
                  onPosted={() => {
                    setActive('comments');
                    setCommentsRefreshKey((k: number) => k + 1);
                  }}
                  onClose={() => setActive('comments')}
                />
              ) : null
            ) : active === 'comments' ? (
              activePostId ? (
                <CommentsListScreen
                  refreshKey={commentsRefreshKey}
                  postId={activePostId}
                  onCompose={() => setActive('comment')}
                  onOpenUser={(userId: string) => {
                    setActiveUserId(userId);
                    setActive('userProfile');
                  }}
                />
              ) : null
            ) : active === 'followers' ? (
              <FollowersListScreen
                onNavigateToChat={(chatId: string, userName: string) => {
                  setActiveChatId(chatId);
                  setActiveChatUserName(userName);
                  setChatReturnTo('followers');
                  setActive('chat');
                }}
                onOpenUser={(userId: string) => {
                  setActiveUserId(userId);
                  setActive('userProfile');
                }}
              />
            ) : active === 'following' ? (
              <FollowingListScreen
                onNavigateToChat={(chatId: string, userName: string) => {
                  setActiveChatId(chatId);
                  setActiveChatUserName(userName);
                  setChatReturnTo('following');
                  setActive('chat');
                }}
                onOpenUser={(userId: string) => {
                  setActiveUserId(userId);
                  setActive('userProfile');
                }}
              />
            ) : active === 'liked' ? (
              <LikedPostsListScreen
                onOpen={postId => {
                  setActivePostId(postId);
                  setActive('comments');
                }}
              />
            ) : active === 'myPosts' ? (
              <MyPostsListScreen />
            ) : active === 'profileEdit' ? (
              <ProfileEditScreen navigation={{ goBack: () => setActive('me') }} />
            ) : active === 'userProfile' ? (
              activeUserId ? (
                <UserProfileScreen
                  userId={activeUserId}
                  onBack={() => {
                    setActiveUserId(null);
                    setActive('home');
                  }}
                  onNavigateToChat={(chatId: string, userName: string) => {
                    setActiveChatId(chatId);
                    setActiveChatUserName(userName);
                    setChatReturnTo('userProfile');
                    setActive('chat');
                  }}
                />
              ) : null
            ) : active === 'aiChat' ? (
              <ErrorBoundary>
                <AIChatBotScreen
                  onBack={() => setActive('chats')}
                  onOpenPaywall={() => setActive('paywall')}
                />
              </ErrorBoundary>
            ) : active === 'tutorial' ? (
              <TutorialScreen onClose={() => setActive('home')} />
            ) : (
              <ProfileScreen
                onNavigate={(key: string) => setActive(key as TabKey)}
              />
            )}
          </AnimatedScreenWrapper>

          {/* Hide tab bar when in chat mode */}
          {active !== 'chat' && (
            <View
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: Math.max(8, insets.bottom ? 4 : 8),
                height: 72 + (insets.bottom || 0),
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
                  icon={
                    k === 'me'
                      ? 'person'
                      : k === 'noti'
                        ? 'notifications'
                        : 'home'
                  }
                  iconOutline={
                    k === 'me'
                      ? 'person-outline'
                      : k === 'noti'
                        ? 'notifications-outline'
                        : 'home-outline'
                  }
                  accessibilityLabel={
                    k === 'me' ? 'あなた' : k === 'noti' ? '通知' : 'ホーム'
                  }
                  accessibilityHint={
                    (handPreference === 'right' && k === 'home') ||
                      (handPreference === 'left' && k === 'me')
                      ? '長押しでサイドバーを開きます'
                      : undefined
                  }
                  sublabel={
                    (handPreference === 'right' && k === 'home') ||
                      (handPreference === 'left' && k === 'me')
                      ? '長押しでサイドバー'
                      : undefined
                  }
                  active={active === k}
                  onPress={() => setActive(k as TabKey)}
                  onLongPress={
                    (handPreference === 'right' && k === 'home') ||
                      (handPreference === 'left' && k === 'me')
                      ? () => setSidebarOpen(true)
                      : __DEV__ && k === 'noti'
                        ? () => setActive('devAnonV2')
                        : undefined
                  }
                />
              ))}
            </View>
          )}
        </View>
        {/* One-time coach mark bubble */}
        {showSidebarHint && (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: Math.max(92, (insets.bottom || 0) + 92),
              alignItems: handPreference === 'right' ? 'flex-end' : 'flex-start',
            }}
          >
            <View
              style={{
                maxWidth: 320,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                ...theme.shadow.card,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                長押しでメニュー
              </Text>
              <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 12 }}>
                {handPreference === 'right'
                  ? 'ホームを長押しでサイドバーが開きます'
                  : 'あなたを長押しでサイドバーが開きます'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  setShowSidebarHint(false);
                  try {
                    await AsyncStorage.setItem('has_seen_sidebar_hint_v1', '1');
                  } catch { }
                }}
                style={({ pressed }) => ({
                  alignSelf: 'flex-end',
                  marginTop: 8,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.pink, fontWeight: '700' }}>OK</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </AuthGuard>
  );
}
