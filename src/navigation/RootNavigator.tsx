import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

import { AuthProvider } from '../contexts/AuthContext';

import CustomTabs from './CustomTabs';

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

  return (
    <AuthProvider>
      <NavigationContainer>
        <CustomTabs
          navigateTo={navigateTo}
          onNavigateConsumed={() => setNavigateTo(null)}
        />
      </NavigationContainer>
    </AuthProvider>
  );
}
