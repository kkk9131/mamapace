import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/theme';
import { useAuthReady } from '../contexts/AuthContext';
import BubbleField from '../ui/anonymousRoomV2/BubbleField';
import {
  fetchLiveMessages,
  sendAnonMessage,
  getCurrentAnonSlotId,
} from '../services/anonV2Service';
import { getSupabaseClient } from '../services/supabaseClient';
import { notifyError } from '../utils/notify';

// V2ではライブメッセージのみを表示（モックは使用しない）

export default function AnonRoomV2Screen({
  onCompose: _onCompose,
  onBack,
}: {
  onCompose?: () => void;
  onBack?: () => void;
}) {
  const servicesReady = useAuthReady();
  const { colors, spacing, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const [liveMessages, setLiveMessages] = useState<
    Array<{
      id: string;
      content: string;
      display_name: string;
      created_at: string;
      expires_at?: string;
    }>
  >([]);
  const [messageText, setMessageText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const formSlide = useRef(new Animated.Value(8)).current; // unfocused slightly lowered
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const realtimeRef = useRef<ReturnType<
    ReturnType<typeof getSupabaseClient>['channel']
  > | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (!servicesReady) {
      return;
    } // Wait until Supabase and services are ready
    let mounted = true;
    const load = async () => {
      const rows = await fetchLiveMessages();
      if (!mounted) {
        return;
      }
      setLiveMessages(rows);
    };
    load();
    (async () => {
      const id = await getCurrentAnonSlotId();
      if (mounted) {
        setSlotId(id);
      }
    })();
    const t = setInterval(load, 15000);
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [servicesReady]);

  // Secure realtime subscription scoped to current slot id
  useEffect(() => {
    if (!slotId) {
      return;
    }
    if (realtimeRef.current) {
      try {
        getSupabaseClient().removeChannel(realtimeRef.current);
      } catch {}
      realtimeRef.current = null;
    }
    const channel = getSupabaseClient()
      .channel(`anonymous_room:${slotId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `anonymous_room_id=eq.${slotId}`,
        },
        payload => {
          const row = payload.new as Record<string, unknown>;
          const msg = {
            id: String(row.id ?? ''),
            content: String(row.content ?? ''),
            display_name: String(row.display_name ?? ''),
            created_at: String(row.created_at ?? ''),
            expires_at: row.expires_at ? String(row.expires_at) : undefined,
          } as const;
          setLiveMessages(prev => {
            const byId: Record<string, (typeof prev)[number]> = {};
            for (const m of prev) {
              byId[String(m.id)] = m;
            }
            byId[String(msg.id)] = msg;
            return Object.values(byId);
          });
        }
      )
      .subscribe();
    realtimeRef.current = channel;
    return () => {
      if (realtimeRef.current) {
        try {
          getSupabaseClient().removeChannel(realtimeRef.current);
        } catch {}
        realtimeRef.current = null;
      }
    };
  }, [slotId]);

  const showForm = () => {
    setInputFocused(true);
    Animated.parallel([
      Animated.timing(formSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };
  const hideForm = () => {
    setInputFocused(false);
    Animated.parallel([
      Animated.timing(formSlide, {
        toValue: 8,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };
  if (!servicesReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.subtext }}>読み込み中…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View
        style={{
          paddingTop: 48,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          zIndex: 2,
        }}
      >
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="戻る"
            onPress={e => {
              e.stopPropagation();
              if (onBack) {
                onBack();
              }
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginRight: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        )}
        <View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
            愚痴もたまには、、、
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 4 }}>
            完全匿名・1時間で消えます
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {/* Background overlay to dismiss keyboard when input focused */}
        {(() => {
          const gap = (insets.bottom || 0) + 56 + 12 + 72; // leave space for input area
          return (
            <Animated.View
              pointerEvents={inputFocused ? 'box-none' : 'none'}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                opacity: overlayOpacity,
                zIndex: 1,
              }}
            >
              <Pressable
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: gap,
                }}
                onPress={() => {
                  Keyboard.dismiss();
                  hideForm();
                }}
              />
            </Animated.View>
          );
        })()}
        <BubbleField
          posts={(liveMessages || []).map(m => ({
            id: m.id,
            title: (m.content ?? '').slice(0, 18),
            body: m.content ?? '',
            created_at: m.created_at,
            expires_at: m.expires_at,
          }))}
        />
      </View>

      {/* 匿名ルームのメッセージ入力フォーム（FABの代替） */}
      {/* 入力フォーム（Phase 2: 送信対応） */}
      <KeyboardAvoidingView
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: (insets.bottom || 0) + 56 + 12,
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <Animated.View
          style={{
            padding: spacing(1.5),
            paddingBottom: spacing(1),
            transform: [{ translateY: formSlide }],
            zIndex: 3,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              ...shadow.card,
            }}
          >
            <TextInput
              ref={inputRef}
              placeholder="いまの気持ちを匿名で…"
              placeholderTextColor={colors.subtext}
              value={messageText}
              onChangeText={setMessageText}
              style={{ flex: 1, color: colors.text, paddingVertical: 6 }}
              multiline
              onFocus={showForm}
              onBlur={hideForm}
              returnKeyType="send"
              onSubmitEditing={async () => {
                const text = messageText.trim();
                if (!text) {
                  return;
                }
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const res = await sendAnonMessage(text);
                if (res.ok) {
                  setMessageText('');
                  inputRef.current?.clear();
                  setLiveMessages(prev => {
                    const byId: Record<string, any> = {};
                    for (const m of prev) {
                      byId[String(m.id)] = m;
                    }
                    byId[String(res.data.id)] = res.data as any;
                    return Object.values(byId) as any;
                  });
                  Keyboard.dismiss();
                  hideForm();
                } else {
                  const s = res.retryAfterSeconds;
                  notifyError(
                    typeof s === 'number' && s > 0
                      ? `レート制限: あと${s}秒お待ちください`
                      : res.message ||
                          '送信に失敗しました。時間をおいて再試行してください'
                  );
                }
              }}
            />
            <Pressable
              onPress={async () => {
                const text = messageText.trim();
                if (!text) {
                  return;
                }
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const res = await sendAnonMessage(text);
                if (res.ok) {
                  setMessageText('');
                  inputRef.current?.clear();
                  setLiveMessages(prev => {
                    const byId: Record<string, any> = {};
                    for (const m of prev) {
                      byId[String(m.id)] = m;
                    }
                    byId[String(res.data.id)] = res.data as any;
                    return Object.values(byId) as any;
                  });
                  Keyboard.dismiss();
                  hideForm();
                } else {
                  const s = res.retryAfterSeconds;
                  notifyError(
                    typeof s === 'number' && s > 0
                      ? `レート制限: あと${s}秒お待ちください`
                      : res.message ||
                          '送信に失敗しました。時間をおいて再試行してください'
                  );
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="送信"
              style={({ pressed }) => [
                { transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="send" size={18} color={colors.pink} />
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
