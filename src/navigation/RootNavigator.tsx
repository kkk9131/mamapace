import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AuthProvider } from '../contexts/AuthContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';

import CustomTabs from './CustomTabs';
import { getSupabaseClient } from '../services/supabaseClient';
import { getMyProfile } from '../services/profileService';
import { useAuth } from '../contexts/AuthContext';

function AuthLinkHandler({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { dispatch } = useAuth();

  useEffect(() => {
    const parseParamsFromUrl = (url: string): Record<string, string> => {
      try {
        const hashIndex = url.indexOf('#');
        const queryIndex = url.indexOf('?');
        const fragment =
          hashIndex >= 0
            ? url.substring(hashIndex + 1)
            : queryIndex >= 0
              ? url.substring(queryIndex + 1)
              : '';
        if (!fragment) return {};
        return fragment.split('&').reduce<Record<string, string>>((acc, pair) => {
          const [k, v] = pair.split('=');
          if (k) acc[decodeURIComponent(k)] = decodeURIComponent(v || '');
          return acc;
        }, {});
      } catch {
        return {};
      }
    };

    const handleAuthCallback = async (url: string) => {
      if (!url || !url.startsWith('mamapace://')) return;
      if (!/auth-callback/.test(url)) return;

      const params = parseParamsFromUrl(url);
      const access_token = params['access_token'];
      const refresh_token = params['refresh_token'];
      const type = params['type'];

      if (access_token && refresh_token) {
        try {
          const client = getSupabaseClient();
          await client.auth.setSession({ access_token, refresh_token });

          // Warm profile into context state
          try {
            const profile = await getMyProfile();
            dispatch({ type: 'SET_USER', payload: profile });
          } catch {}

          Alert.alert('登録が完了しました', 'ようこそ Mamapace へ！');
          onNavigate('me');
        } catch (e) {
          Alert.alert('認証エラー', 'メール確認は完了しました。ログインをお試しください。');
          onNavigate('login');
        }
      } else if (type === 'signup') {
        // PKCE-style template without tokens
        Alert.alert('メール確認が完了しました', 'ログインして登録を完了してください。');
        onNavigate('login');
      }
    };

    const onUrl = ({ url }: { url: string }) => {
      handleAuthCallback(url);
    };

    (async () => {
      try {
        const initial = await Linking.getInitialURL();
        if (initial) {
          await handleAuthCallback(initial);
        }
      } catch {}
    })();

    const sub = Linking.addEventListener('url', onUrl);
    return () => {
      sub.remove();
    };
  }, [dispatch, onNavigate]);

  return null;
}

/**
 * Root navigation component that provides authentication context
 * and handles the main app navigation flow
 */
export default function RootNavigator() {
  const [navigateTo, setNavigateTo] = useState<string | null>(null);

  useEffect(() => {
    const handle = (resp: Notifications.NotificationResponse) => {
      try {
        const data: any = resp?.notification?.request?.content?.data || {};
        const t = data?.type as string | undefined;
        if (t === 'message' && data.chat_id) {
          setNavigateTo(
            JSON.stringify({
              screen: 'chat',
              chat_id: String(data.chat_id),
              sender_name: String(data.sender_name || ''),
            }),
          );
        } else if ((t === 'like' || t === 'comment') && data.post_id) {
          setNavigateTo(
            JSON.stringify({
              screen: 'comments',
              post_id: String(data.post_id),
            }),
          );
        } else if (t === 'follow' && data.follower_id) {
          setNavigateTo(
            JSON.stringify({
              screen: 'userProfile',
              user_id: String(data.follower_id),
            }),
          );
        } else if (t === 'room') {
          // Optionally include channel_id for future deep navigation
          setNavigateTo(
            JSON.stringify({
              screen: 'rooms',
              channel_id: data.channel_id ? String(data.channel_id) : undefined,
            }),
          );
        } else {
          setNavigateTo('noti');
        }
      } catch {
        setNavigateTo('noti');
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    (async () => {
      try {
        const last = await (
          Notifications as any
        ).getLastNotificationResponseAsync?.();
        if (last) {
          handle(last as Notifications.NotificationResponse);
        }
      } catch {}
    })();

    return () => {
      sub.remove();
    };
  }, []);

  // Render a child that handles deep links within Auth context

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <NavigationContainer>
          <AuthLinkHandler onNavigate={tab => setNavigateTo(tab)} />
          <CustomTabs
            navigateTo={navigateTo}
            onNavigateConsumed={() => setNavigateTo(null)}
          />
        </NavigationContainer>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
