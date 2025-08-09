import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import Sidebar from './Sidebar';
import RoomsScreen from '../screens/RoomsScreen';
import CreateRoomScreen from '../screens/CreateRoomScreen';
import ChatsListScreen from '../screens/ChatsListScreen';
import ChatScreen from '../screens/ChatScreen';
import { Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import AuthGuard from '../components/AuthGuard';

import ComposeScreen from '../screens/ComposeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AnonFeedScreen from '../screens/AnonFeedScreen';
import RoomsListScreen from '../screens/RoomsListScreen';
import CommentComposeScreen from '../screens/CommentComposeScreen';
import CommentsListScreen from '../screens/CommentsListScreen';
import FollowersListScreen from '../screens/FollowersListScreen';
import FollowingListScreen from '../screens/FollowingListScreen';
import LikedPostsListScreen from '../screens/LikedPostsListScreen';
import LoginScreen from '../screens/LoginScreen';
import SearchScreen from '../screens/SearchScreen';
import SignUpScreen from '../screens/SignUpScreen';

const tabs = [
  { key: 'me', label: 'あなた', Component: ProfileScreen },
  { key: 'noti', label: '通知', Component: NotificationsScreen },
  { key: 'home', label: 'ホーム', Component: HomeScreen },
] as const;

const Hidden = { compose: ComposeScreen } as const;

function TextButton({ label, active, onPress, onLongPress }: { label: string; active: boolean; onPress: () => void; onLongPress?: () => void }) {
  const { colors } = useTheme();
  const scale = new Animated.Value(1);
  const pulse = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 14, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
    ]).start();
  };
  return (
    <Pressable onPress={async () => { pulse(); await Haptics.selectionAsync(); onPress(); }} onLongPress={onLongPress} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Text style={{ transform: [{ scale }], color: active ? colors.pink : colors.subtext, fontSize: 16, fontWeight: '700' }}>{label}</Animated.Text>
    </Pressable>
  );
}

export default function CustomTabs() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { isAuthenticated, isLoading, user } = useAuth();
  const [active, setActive] = useState<any>('home');
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
  if (active === 'compose') return <ComposeScreen onClose={() => setActive('home' as any)} />;

  return (
    <AuthGuard>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(key) => {
          setActive(key as any);
          setSidebarOpen(false);
        }} />
        <View style={{ flex: 1 }}>
          {active === 'home' ? (
            <HomeScreen onCompose={() => setActive('compose' as any)} onComment={() => setActive('comments' as any)} />
          ) : active === 'search' ? (
            <SearchScreen />
          ) : active === 'rooms' ? (
            <RoomsScreen />
          ) : active === 'createRoom' ? (
            <CreateRoomScreen />
          ) : active === 'chats' ? (
            <ChatsListScreen onOpen={() => setActive('chat' as any)} />
          ) : active === 'anon' ? (
            <AnonFeedScreen onComment={() => setActive('comment' as any)} onOpenPost={() => setActive('comments' as any)} />
          ) : active === 'chat' ? (
            <ChatScreen />
          ) : active === 'noti' ? (
            <NotificationsScreen />
          ) : active === 'settings' ? (
            <SettingsScreen onLogoutNavigate={() => {
              // Logout will be handled by AuthContext, which will trigger re-render
              // and show login screen due to !isAuthenticated check above
            }} />
          ) : active === 'roomsList' ? (
            <RoomsListScreen />
          ) : active === 'comment' ? (
            <CommentComposeScreen onClose={() => setActive('home' as any)} />
          ) : active === 'comments' ? (
            <CommentsListScreen onCompose={() => setActive('comment' as any)} />
          ) : active === 'followers' ? (
            <FollowersListScreen />
          ) : active === 'following' ? (
            <FollowingListScreen />
          ) : active === 'liked' ? (
            <LikedPostsListScreen onOpen={() => setActive('comments' as any)} />
          ) : (
            <ProfileScreen onNavigate={(key: string) => setActive(key as any)} />
          )}
        </View>
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 8, height: 56, borderRadius: 16, flexDirection: 'row', backgroundColor: colors.card + '88', borderColor: '#22252B', borderWidth: 1, overflow: 'hidden' }}>
          {(['me','noti','home'] as const).map((k) => (
            <TextButton key={k} label={k==='me'?'👤':k==='noti'?'🔔':'🏠'} active={active===k} onPress={() => k==='home'? setActive('home'): setActive(k)} onLongPress={k==='home'? () => setSidebarOpen(true): undefined} />
          ))}
        </View>
      </View>
    </AuthGuard>
  );
}
